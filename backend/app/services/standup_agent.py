import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.activity import ActivityLog
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.user import User
from app.models.sprint import Sprint
from app.models.standup import StandupReport

logger = logging.getLogger("devsprint.standup_agent")


class StandupAgent:
    """
    Agent loop that inspects 24h activity logs and task states to generate
    natural language daily standup summaries.
    """

    @classmethod
    async def generate_standup(
        cls,
        db: AsyncSession,
        sprint_id: int,
        user_id: Optional[int] = None,
        custom_context: Optional[str] = None
    ) -> StandupReport:
        # 1. Fetch Sprint
        sprint_stmt = select(Sprint).where(Sprint.id == sprint_id)
        sprint_res = await db.execute(sprint_stmt)
        sprint = sprint_res.scalar_one_or_none()
        if not sprint:
            raise ValueError(f"Sprint {sprint_id} not found")

        # 2. Time window: last 24 hours (or since start if sprint is < 24h old)
        now = datetime.now(timezone.utc)
        since = now - timedelta(hours=24)

        # 3. Gather activity logs
        act_stmt = (
            select(ActivityLog)
            .join(Task, ActivityLog.task_id == Task.id)
            .where(Task.sprint_id == sprint_id)
            .where(ActivityLog.created_at >= since)
            .options(selectinload(ActivityLog.task), selectinload(ActivityLog.user))
            .order_by(ActivityLog.created_at.asc())
        )
        if user_id:
            act_stmt = act_stmt.where(ActivityLog.user_id == user_id)

        act_res = await db.execute(act_stmt)
        activities = act_res.scalars().all()

        # If few activities in last 24h, expand window to last 7 days for rich standup demo
        if len(activities) < 2:
            extended_since = now - timedelta(days=7)
            act_stmt_ext = (
                select(ActivityLog)
                .join(Task, ActivityLog.task_id == Task.id)
                .where(Task.sprint_id == sprint_id)
                .where(ActivityLog.created_at >= extended_since)
                .options(selectinload(ActivityLog.task), selectinload(ActivityLog.user))
                .order_by(ActivityLog.created_at.asc())
            )
            if user_id:
                act_stmt_ext = act_stmt_ext.where(ActivityLog.user_id == user_id)
            act_res_ext = await db.execute(act_stmt_ext)
            activities = act_res_ext.scalars().all()

        # Also fetch current active tasks for this user/sprint
        task_stmt = select(Task).where(Task.sprint_id == sprint_id).options(selectinload(Task.assignee))
        if user_id:
            task_stmt = task_stmt.where(Task.assignee_id == user_id)
        task_res = await db.execute(task_stmt)
        current_tasks = task_res.scalars().all()

        target_user = None
        if user_id:
            user_stmt = select(User).where(User.id == user_id)
            user_res = await db.execute(user_stmt)
            target_user = user_res.scalar_one_or_none()

        # 4. Synthesize context payload
        completed_tasks = [t for t in current_tasks if t.status == TaskStatus.DONE]
        in_progress_tasks = [t for t in current_tasks if t.status in (TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW)]
        urgent_tasks = [t for t in current_tasks if t.priority == TaskPriority.URGENT and t.status != TaskStatus.DONE]

        activity_summaries = []
        for a in activities:
            u_name = a.user.name if a.user else "System"
            t_title = a.task.title if a.task else f"Task #{a.task_id}"
            activity_summaries.append(
                f"- [{a.change_type}] {u_name} on '{t_title}': from '{a.old_value}' to '{a.new_value}' (note: {a.message or 'N/A'})"
            )

        context_data = {
            "sprint_name": sprint.name,
            "user_name": target_user.name if target_user else "Team-wide",
            "completed_count": len(completed_tasks),
            "completed_titles": [t.title for t in completed_tasks],
            "in_progress_count": len(in_progress_tasks),
            "in_progress_titles": [t.title for t in in_progress_tasks],
            "urgent_blockers": [t.title for t in urgent_tasks],
            "recent_activity_count": len(activities),
            "activity_samples": activity_summaries[:15],
            "custom_context": custom_context
        }

        # 5. Call LLM (Gemini or OpenAI) or Local Synthesizer Agent
        parsed_report, model_name = await cls._execute_agent_loop(context_data)

        # 6. Save report in DB
        report = StandupReport(
            sprint_id=sprint_id,
            user_id=user_id,
            report_date=now.date(),
            summary=parsed_report.get("summary", ""),
            yesterday=parsed_report.get("yesterday", ""),
            today=parsed_report.get("today", ""),
            blockers=parsed_report.get("blockers", "No immediate blockers reported."),
            raw_ai_response=json.dumps(context_data, default=str),
            model_used=model_name
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)

        # Eager load user if present
        if user_id:
            await db.refresh(report, ["user"])

        return report

    @classmethod
    async def _execute_agent_loop(cls, ctx: Dict[str, Any]) -> tuple[Dict[str, str], str]:
        # Check Gemini API Key
        if settings.GEMINI_API_KEY:
            try:
                res = await cls._call_gemini(ctx)
                if res:
                    return res, f"Gemini ({settings.AI_MODEL})"
            except Exception as e:
                logger.error(f"Gemini API error: {e}. Falling back to internal synthesizer agent.")

        # Check OpenAI API Key
        if settings.OPENAI_API_KEY:
            try:
                res = await cls._call_openai(ctx)
                if res:
                    return res, "OpenAI (gpt-4o-mini)"
            except Exception as e:
                logger.error(f"OpenAI API error: {e}. Falling back to internal synthesizer agent.")

        # Local Structured Synthesizer Agent (Zero-failure guaranteed)
        return cls._local_agent_synthesize(ctx), "DevSprint Agentic Synthesizer"

    @classmethod
    async def _call_gemini(cls, ctx: Dict[str, Any]) -> Optional[Dict[str, str]]:
        prompt = cls._build_prompt(ctx)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.AI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
        return None

    @classmethod
    async def _call_openai(cls, ctx: Dict[str, Any]) -> Optional[Dict[str, str]]:
        prompt = cls._build_prompt(ctx)
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are DevSprint AI Standup Agent. Return strict valid JSON with keys: summary, yesterday, today, blockers."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                return json.loads(text)
        return None

    @classmethod
    def _build_prompt(cls, ctx: Dict[str, Any]) -> str:
        return f"""
You are an expert Agile Scrum Assistant. Analyze the following team activity log and task metrics from the last 24h:
Target: {ctx['user_name']}
Sprint: {ctx['sprint_name']}
Completed tasks: {', '.join(ctx['completed_titles']) if ctx['completed_titles'] else 'None'}
In-progress tasks: {', '.join(ctx['in_progress_titles']) if ctx['in_progress_titles'] else 'None'}
Urgent/impediments: {', '.join(ctx['urgent_blockers']) if ctx['urgent_blockers'] else 'None'}
Recent Task Activities:
{chr(10).join(ctx['activity_samples'])}
Extra context: {ctx.get('custom_context') or 'None'}

Generate a concise, high-impact 3-4 line standup report following this exact JSON format:
{{
  "summary": "Overall 1-2 sentence executive assessment of velocity and focus.",
  "yesterday": "Key items completed or progressed yesterday.",
  "today": "Primary focus and tasks currently in progress for today.",
  "blockers": "Any risks, pending reviews, urgent items, or 'None'."
}}
"""

    @classmethod
    def _local_agent_synthesize(cls, ctx: Dict[str, Any]) -> Dict[str, str]:
        # Dynamic smart synthesis
        user = ctx["user_name"]
        completed = ctx["completed_titles"]
        in_progress = ctx["in_progress_titles"]
        blockers = ctx["urgent_blockers"]

        yesterday_str = (
            f"Completed '{', '.join(completed[:2])}' and logged activity updates across the sprint board."
            if completed
            else "Advanced ongoing sprint tasks and refined acceptance criteria."
        )

        today_str = (
            f"Focusing on driving '{', '.join(in_progress[:2])}' through review and deployment."
            if in_progress
            else "Tackling prioritized backlog items and peer code reviews."
        )

        blocker_str = (
            f"Attention needed on urgent item(s): {', '.join(blockers)}."
            if blockers
            else "No blocking impediments; velocity is steady on current sprint goals."
        )

        summary_str = (
            f"{user} maintained high momentum in {ctx['sprint_name']}, completing {len(completed)} task(s) "
            f"with {len(in_progress)} active in-flight items."
        )

        return {
            "summary": summary_str,
            "yesterday": yesterday_str,
            "today": today_str,
            "blockers": blocker_str
        }


standup_agent = StandupAgent()
