from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.task import Task, TaskStatus
from app.models.activity import ActivityLog
from app.schemas.task import TaskOut, TaskCreate, TaskUpdate, TaskMoveRequest, TaskCommentCreate, TaskDetailOut
from app.services.activity_service import activity_service
from app.services.cache_service import cache_service

router = APIRouter()


@router.post("/", response_model=TaskOut)
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    task = Task(
        sprint_id=task_in.sprint_id,
        title=task_in.title,
        description=task_in.description,
        status=task_in.status,
        priority=task_in.priority,
        story_points=task_in.story_points,
        assignee_id=task_in.assignee_id,
        position=0
    )
    db.add(task)
    await db.flush()

    # Log task creation activity
    await activity_service.log_activity(
        db=db,
        task_id=task.id,
        user_id=current_user.id,
        change_type="task_created",
        old_value=None,
        new_value=task.title,
        message=f"Created task '{task.title}' with {task.story_points} story points"
    )

    await db.commit()
    await db.refresh(task)

    # Invalidate Redis board cache
    await cache_service.invalidate_sprint(task.sprint_id)

    # Load assignee relationship
    stmt = select(Task).where(Task.id == task.id).options(selectinload(Task.assignee))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/{task_id}", response_model=TaskDetailOut)
async def get_task_detail(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.activities).selectinload(ActivityLog.user)
        )
    )
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Task).where(Task.id == task_id).options(selectinload(Task.assignee))
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Track changes for activity log
    if task_in.status is not None and task_in.status != task.status:
        await activity_service.log_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            change_type="status_change",
            old_value=task.status.value,
            new_value=task_in.status.value,
            message=f"Status moved from {task.status.value} to {task_in.status.value}"
        )
        task.status = task_in.status

    if task_in.assignee_id is not None and task_in.assignee_id != task.assignee_id:
        old_assignee = task.assignee.name if task.assignee else "Unassigned"
        task.assignee_id = task_in.assignee_id
        await activity_service.log_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            change_type="assignee_change",
            old_value=old_assignee,
            new_value=str(task_in.assignee_id),
            message="Reassigned task"
        )

    if task_in.story_points is not None and task_in.story_points != task.story_points:
        await activity_service.log_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            change_type="points_change",
            old_value=str(task.story_points),
            new_value=str(task_in.story_points),
            message=f"Story points adjusted from {task.story_points} to {task_in.story_points}"
        )
        task.story_points = task_in.story_points

    if task_in.priority is not None and task_in.priority != task.priority:
        await activity_service.log_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            change_type="priority_change",
            old_value=task.priority.value,
            new_value=task_in.priority.value,
            message=f"Priority updated to {task_in.priority.value}"
        )
        task.priority = task_in.priority

    if task_in.title is not None:
        task.title = task_in.title
    if task_in.description is not None:
        task.description = task_in.description
    if task_in.position is not None:
        task.position = task_in.position

    await db.commit()
    await db.refresh(task)

    # Invalidate Redis sprint board cache
    await cache_service.invalidate_sprint(task.sprint_id)

    # Reload assignee
    stmt = select(Task).where(Task.id == task.id).options(selectinload(Task.assignee))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.post("/{task_id}/move", response_model=TaskOut)
async def move_task(
    task_id: int,
    move_in: TaskMoveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Drag and drop position & status update endpoint.
    Immediately invalidates Redis board cache and writes to Postgres activity log.
    """
    stmt = select(Task).where(Task.id == task_id).options(selectinload(Task.assignee))
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    old_status = task.status
    task.status = move_in.new_status
    task.position = move_in.new_position

    if old_status != move_in.new_status:
        await activity_service.log_activity(
            db=db,
            task_id=task.id,
            user_id=current_user.id,
            change_type="status_change",
            old_value=old_status.value,
            new_value=move_in.new_status.value,
            message=f"Moved task to {move_in.new_status.value} via sprint board"
        )

    await db.commit()
    await db.refresh(task)

    # Invalidate Redis cache
    await cache_service.invalidate_sprint(task.sprint_id)
    return task


@router.post("/{task_id}/comments", response_model=TaskDetailOut)
async def add_task_comment(
    task_id: int,
    comment_in: TaskCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.activities).selectinload(ActivityLog.user)
        )
    )
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await activity_service.log_activity(
        db=db,
        task_id=task.id,
        user_id=current_user.id,
        change_type="comment_added",
        old_value=None,
        new_value=None,
        message=comment_in.comment
    )
    await db.commit()

    # Re-fetch task
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Task).where(Task.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    sprint_id = task.sprint_id
    await db.delete(task)
    await db.commit()

    # Invalidate Redis sprint board cache
    await cache_service.invalidate_sprint(sprint_id)
    return {"message": "Task deleted successfully"}
