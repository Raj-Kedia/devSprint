import asyncio
from datetime import datetime, timedelta, timezone
from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import User, Team, TeamMember, TeamRole
from app.models.sprint import Sprint, SprintStatus
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.activity import ActivityLog
from app.models.standup import StandupReport


async def seed_data():
    await init_db()

    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from sqlalchemy import select
        res = await session.execute(select(User))
        if res.scalars().first():
            print("Database already contains data. Skipping seed.")
            return

        print("Seeding DevSprint demo data...")
        pwd = get_password_hash("password123")
        now = datetime.now(timezone.utc)

        # 1. Users
        users = [
            User(name="Alex Rivera", email="alex@devsprint.io", password_hash=pwd),
            User(name="Sam Chen", email="sam@devsprint.io", password_hash=pwd),
            User(name="Taylor Hayes", email="taylor@devsprint.io", password_hash=pwd),
            User(name="Jordan Vance", email="jordan@devsprint.io", password_hash=pwd),
        ]
        session.add_all(users)
        await session.flush()

        alex, sam, taylor, jordan = users[0], users[1], users[2], users[3]

        # 2. Team
        team = Team(name="Engineering Alpha")
        session.add(team)
        await session.flush()

        members = [
            TeamMember(user_id=alex.id, team_id=team.id, role=TeamRole.ADMIN),
            TeamMember(user_id=sam.id, team_id=team.id, role=TeamRole.MEMBER),
            TeamMember(user_id=taylor.id, team_id=team.id, role=TeamRole.MEMBER),
            TeamMember(user_id=jordan.id, team_id=team.id, role=TeamRole.MEMBER),
        ]
        session.add_all(members)
        await session.flush()

        # 3. Active Sprint (started 5 days ago, ends in 9 days)
        sprint_start = now - timedelta(days=5)
        sprint_end = sprint_start + timedelta(days=14)

        sprint = Sprint(
            team_id=team.id,
            name="Sprint 24 — Realtime Engine & AI Agent",
            start_date=sprint_start,
            end_date=sprint_end,
            status=SprintStatus.ACTIVE
        )
        session.add(sprint)
        await session.flush()

        # 4. Tasks across columns
        tasks = [
            # DONE Tasks
            Task(
                sprint_id=sprint.id,
                title="Design PostgreSQL schema & SQLAlchemy models",
                description="Finalize User, Team, Sprint, Task, and ActivityLog models with cascading rules and foreign keys.",
                status=TaskStatus.DONE,
                priority=TaskPriority.HIGH,
                story_points=5,
                assignee_id=taylor.id,
                position=0,
                created_at=sprint_start,
                updated_at=sprint_start + timedelta(days=2)
            ),
            Task(
                sprint_id=sprint.id,
                title="Implement JWT authentication flow & workspace invites",
                description="Set up password hashing, access token rotation, and email-based workspace onboarding.",
                status=TaskStatus.DONE,
                priority=TaskPriority.HIGH,
                story_points=3,
                assignee_id=taylor.id,
                position=1,
                created_at=sprint_start,
                updated_at=sprint_start + timedelta(days=3)
            ),
            Task(
                sprint_id=sprint.id,
                title="Vite React dashboard scaffold with Tailwind v4 & Zustand",
                description="Set up clean modern layout with header, sprint selector, and client state store.",
                status=TaskStatus.DONE,
                priority=TaskPriority.MEDIUM,
                story_points=3,
                assignee_id=sam.id,
                position=2,
                created_at=sprint_start,
                updated_at=sprint_start + timedelta(days=4)
            ),
            # IN_REVIEW Tasks
            Task(
                sprint_id=sprint.id,
                title="Build Drag-and-Drop Sprint Kanban Board UI",
                description="Interactive columns for To Do, In Progress, In Review, and Done with smooth drag-and-drop animations.",
                status=TaskStatus.IN_REVIEW,
                priority=TaskPriority.HIGH,
                story_points=5,
                assignee_id=sam.id,
                position=0,
                created_at=sprint_start + timedelta(days=1),
                updated_at=now - timedelta(hours=6)
            ),
            # IN_PROGRESS Tasks
            Task(
                sprint_id=sprint.id,
                title="Redis caching layer for Sprint Board read endpoints",
                description="Cache high-volume board queries with automatic cache invalidation triggers on task mutation.",
                status=TaskStatus.IN_PROGRESS,
                priority=TaskPriority.URGENT,
                story_points=5,
                assignee_id=taylor.id,
                position=0,
                created_at=sprint_start + timedelta(days=2),
                updated_at=now - timedelta(hours=3)
            ),
            Task(
                sprint_id=sprint.id,
                title="AI Standup Generator agent loop with 24h activity log parser",
                description="Develop agent pipeline that processes activity logs and produces natural language standup reports.",
                status=TaskStatus.IN_PROGRESS,
                priority=TaskPriority.HIGH,
                story_points=8,
                assignee_id=jordan.id,
                position=1,
                created_at=sprint_start + timedelta(days=2),
                updated_at=now - timedelta(hours=1)
            ),
            # TODO Tasks
            Task(
                sprint_id=sprint.id,
                title="Interactive Burndown Chart with Recharts",
                description="Render ideal story point trajectory vs actual remaining points over the 14-day sprint timeframe.",
                status=TaskStatus.TODO,
                priority=TaskPriority.MEDIUM,
                story_points=3,
                assignee_id=sam.id,
                position=0,
                created_at=sprint_start + timedelta(days=3),
                updated_at=sprint_start + timedelta(days=3)
            ),
            Task(
                sprint_id=sprint.id,
                title="Docker & docker-compose production orchestration",
                description="Configure multi-stage Dockerfiles for backend & frontend with Redis and Postgres containers.",
                status=TaskStatus.TODO,
                priority=TaskPriority.MEDIUM,
                story_points=2,
                assignee_id=alex.id,
                position=1,
                created_at=sprint_start + timedelta(days=3),
                updated_at=sprint_start + timedelta(days=3)
            ),
            Task(
                sprint_id=sprint.id,
                title="Setup GitHub Actions CI pipeline for tests & linting",
                description="Add automated workflow running pytest for backend and build check for frontend.",
                status=TaskStatus.TODO,
                priority=TaskPriority.LOW,
                story_points=2,
                assignee_id=alex.id,
                position=2,
                created_at=sprint_start + timedelta(days=4),
                updated_at=sprint_start + timedelta(days=4)
            )
        ]
        session.add_all(tasks)
        await session.flush()

        # 5. Activity Logs across past 5 days
        activities = [
            # Day 1: Created tasks
            ActivityLog(
                task_id=tasks[0].id,
                user_id=alex.id,
                change_type="task_created",
                new_value="Design PostgreSQL schema",
                message="Created sprint backlog item",
                created_at=sprint_start + timedelta(hours=2)
            ),
            # Day 2: Taylor finished schema
            ActivityLog(
                task_id=tasks[0].id,
                user_id=taylor.id,
                change_type="status_change",
                old_value="IN_PROGRESS",
                new_value="DONE",
                message="Completed DB schema models and verified migrations",
                created_at=sprint_start + timedelta(days=2)
            ),
            # Day 3: Taylor finished auth
            ActivityLog(
                task_id=tasks[1].id,
                user_id=taylor.id,
                change_type="status_change",
                old_value="IN_PROGRESS",
                new_value="DONE",
                message="JWT verification tests passing; invite handler ready",
                created_at=sprint_start + timedelta(days=3)
            ),
            # Day 4: Sam finished dashboard scaffold
            ActivityLog(
                task_id=tasks[2].id,
                user_id=sam.id,
                change_type="status_change",
                old_value="IN_PROGRESS",
                new_value="DONE",
                message="Dashboard shell and Zustand store wired up",
                created_at=sprint_start + timedelta(days=4)
            ),
            # Recent: Sam moved DnD board to IN_REVIEW
            ActivityLog(
                task_id=tasks[3].id,
                user_id=sam.id,
                change_type="status_change",
                old_value="IN_PROGRESS",
                new_value="IN_REVIEW",
                message="Kanban columns drag-and-drop ready for team review",
                created_at=now - timedelta(hours=6)
            ),
            # Recent: Taylor working on Redis caching
            ActivityLog(
                task_id=tasks[4].id,
                user_id=taylor.id,
                change_type="status_change",
                old_value="TODO",
                new_value="IN_PROGRESS",
                message="Benchmarking Redis read cache vs direct PostgreSQL queries",
                created_at=now - timedelta(hours=3)
            ),
            # Recent: Jordan working on Standup Agent
            ActivityLog(
                task_id=tasks[5].id,
                user_id=jordan.id,
                change_type="status_change",
                old_value="TODO",
                new_value="IN_PROGRESS",
                message="Prompt tuning for daily standup agent loop with 24h activity log integration",
                created_at=now - timedelta(hours=1)
            ),
            ActivityLog(
                task_id=tasks[4].id,
                user_id=alex.id,
                change_type="comment_added",
                message="Make sure we add X-Cache diagnostic headers for easy cache inspection!",
                created_at=now - timedelta(minutes=45)
            ),
        ]
        session.add_all(activities)
        await session.flush()

        # 6. Sample Historical Standup Report
        standup_report = StandupReport(
            sprint_id=sprint.id,
            user_id=alex.id,
            report_date=(now - timedelta(days=1)).date(),
            summary="Team is sustaining high velocity with 11 story points already closed. Core backend foundation and frontend scaffold are complete.",
            yesterday="Taylor finalized JWT auth flow; Sam integrated Zustand state store and Tailwind v4 dashboard layout.",
            today="Sam is pushing Kanban drag-and-drop board for review; Jordan is finalizing the AI Standup agent loop.",
            blockers="Need to ensure Redis cache invalidation keys sync cleanly on concurrent task moves.",
            model_used="DevSprint Agentic Synthesizer",
            created_at=now - timedelta(days=1)
        )
        session.add(standup_report)

        await session.commit()
        print("Demo data seeded successfully!")
        print("Default accounts:")
        print("  Lead: alex@devsprint.io / password123")
        print("  Frontend: sam@devsprint.io / password123")
        print("  Backend: taylor@devsprint.io / password123")
        print("  AI Engineer: jordan@devsprint.io / password123")


if __name__ == "__main__":
    asyncio.run(seed_data())
