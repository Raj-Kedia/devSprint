from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.activity import ActivityLog


class ActivityService:
    @staticmethod
    async def log_activity(
        db: AsyncSession,
        task_id: int,
        user_id: Optional[int],
        change_type: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        message: Optional[str] = None
    ) -> ActivityLog:
        log = ActivityLog(
            task_id=task_id,
            user_id=user_id,
            change_type=change_type,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            message=message
        )
        db.add(log)
        await db.flush()
        return log


activity_service = ActivityService()
