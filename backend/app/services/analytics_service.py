import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sprint import Sprint
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.activity import ActivityLog
from app.models.user import User
from app.schemas.analytics import SprintAnalyticsOut, BurndownPoint, MemberWorkload

logger = logging.getLogger("devsprint.analytics")


class AnalyticsService:
    @classmethod
    async def get_sprint_analytics(cls, db: AsyncSession, sprint_id: int) -> SprintAnalyticsOut:
        # 1. Fetch Sprint
        sprint_stmt = select(Sprint).where(Sprint.id == sprint_id)
        sprint_res = await db.execute(sprint_stmt)
        sprint = sprint_res.scalar_one_or_none()
        if not sprint:
            raise ValueError(f"Sprint {sprint_id} not found")

        # 2. Fetch Tasks with Assignees and Activities
        task_stmt = (
            select(Task)
            .where(Task.sprint_id == sprint_id)
            .options(selectinload(Task.assignee), selectinload(Task.activities))
        )
        task_res = await db.execute(task_stmt)
        tasks = task_res.scalars().all()

        total_tasks = len(tasks)
        total_points = sum(t.story_points for t in tasks)
        completed_tasks = [t for t in tasks if t.status == TaskStatus.DONE]
        completed_points = sum(t.story_points for t in completed_tasks)
        remaining_points = total_points - completed_points
        completion_rate = round((completed_points / total_points * 100), 1) if total_points > 0 else 0.0

        # Status distribution
        status_dist: Dict[str, int] = {
            TaskStatus.TODO.value: 0,
            TaskStatus.IN_PROGRESS.value: 0,
            TaskStatus.IN_REVIEW.value: 0,
            TaskStatus.DONE.value: 0
        }
        for t in tasks:
            status_dist[t.status.value] = status_dist.get(t.status.value, 0) + 1

        # Priority distribution
        priority_dist: Dict[str, int] = {
            TaskPriority.LOW.value: 0,
            TaskPriority.MEDIUM.value: 0,
            TaskPriority.HIGH.value: 0,
            TaskPriority.URGENT.value: 0
        }
        for t in tasks:
            priority_dist[t.priority.value] = priority_dist.get(t.priority.value, 0) + 1

        # Member workload
        workload_map: Dict[str, Dict[str, Any]] = {}
        for t in tasks:
            uid = t.assignee_id
            uname = t.assignee.name if t.assignee else "Unassigned"
            key = f"{uid}_{uname}"
            if key not in workload_map:
                workload_map[key] = {
                    "user_id": uid,
                    "name": uname,
                    "total_tasks": 0,
                    "completed_tasks": 0,
                    "story_points": 0
                }
            workload_map[key]["total_tasks"] += 1
            workload_map[key]["story_points"] += t.story_points
            if t.status == TaskStatus.DONE:
                workload_map[key]["completed_tasks"] += 1

        member_workload = [
            MemberWorkload(**w) for w in workload_map.values()
        ]

        # 3. Burndown calculation
        start_dt = sprint.start_date.date() if isinstance(sprint.start_date, datetime) else sprint.start_date
        end_dt = sprint.end_date.date() if isinstance(sprint.end_date, datetime) else sprint.end_date

        if end_dt <= start_dt:
            end_dt = start_dt + timedelta(days=14)

        duration_days = max(1, (end_dt - start_dt).days)
        today = datetime.now(timezone.utc).date()

        # Build task completion date lookup
        task_done_dates: Dict[int, datetime.date] = {}
        for t in tasks:
            if t.status == TaskStatus.DONE:
                # Find date moved to DONE from activities, fallback to updated_at
                done_log = next(
                    (a for a in t.activities if a.change_type == "status_change" and a.new_value == TaskStatus.DONE.value),
                    None
                )
                if done_log:
                    task_done_dates[t.id] = done_log.created_at.date()
                elif t.updated_at:
                    task_done_dates[t.id] = t.updated_at.date()
                else:
                    task_done_dates[t.id] = today

        burndown_points: List[BurndownPoint] = []
        for day_idx in range(duration_days + 1):
            curr_date = start_dt + timedelta(days=day_idx)
            
            # Ideal burn line: linearly decreases from total_points to 0
            ideal_burn = max(0.0, round(total_points - (total_points / duration_days * day_idx), 1))

            # Completed points up to curr_date
            pts_completed_by_date = sum(
                t.story_points for t in tasks
                if t.id in task_done_dates and task_done_dates[t.id] <= curr_date
            )

            # If curr_date is in the future, don't project fake actual points
            if curr_date > today and day_idx > 0:
                # Keep flat from today
                pts_completed_by_date = completed_points

            actual_remaining = max(0, total_points - pts_completed_by_date)

            burndown_points.append(
                BurndownPoint(
                    date=curr_date.strftime("%Y-%m-%d"),
                    label=f"Day {day_idx} ({curr_date.strftime('%b %d')})",
                    ideal_points=ideal_burn,
                    actual_points=actual_remaining,
                    completed_points=pts_completed_by_date
                )
            )

        return SprintAnalyticsOut(
            sprint_id=sprint.id,
            sprint_name=sprint.name,
            start_date=start_dt.strftime("%Y-%m-%d"),
            end_date=end_dt.strftime("%Y-%m-%d"),
            total_tasks=total_tasks,
            total_points=total_points,
            completed_points=completed_points,
            remaining_points=remaining_points,
            completion_rate_percent=completion_rate,
            burndown=burndown_points,
            status_distribution=status_dist,
            priority_distribution=priority_dist,
            member_workload=member_workload
        )


analytics_service = AnalyticsService()
