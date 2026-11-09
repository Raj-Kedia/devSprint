from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user
from app.models.user import User, TeamMember, TeamRole
from app.models.sprint import Sprint, SprintStatus
from app.models.task import Task, TaskStatus
from app.schemas.sprint import SprintOut, SprintCreate, SprintUpdate, SprintBoardOut
from app.schemas.task import TaskOut
from app.services.cache_service import cache_service

router = APIRouter()


@router.get("/team/{team_id}", response_model=List[SprintOut])
async def list_sprints_for_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify membership
    mem_stmt = select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
    mem_res = await db.execute(mem_stmt)
    if not mem_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    stmt = select(Sprint).where(Sprint.team_id == team_id).options(selectinload(Sprint.tasks)).order_by(Sprint.created_at.desc())
    res = await db.execute(stmt)
    sprints = res.scalars().all()

    out = []
    for s in sprints:
        total_tasks = len(s.tasks)
        total_pts = sum(t.story_points for t in s.tasks)
        comp_pts = sum(t.story_points for t in s.tasks if t.status == TaskStatus.DONE)
        s_out = SprintOut.model_validate(s)
        s_out.total_tasks = total_tasks
        s_out.total_points = total_pts
        s_out.completed_points = comp_pts
        out.append(s_out)
    return out


@router.post("/", response_model=SprintOut)
async def create_sprint(
    sprint_in: SprintCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    mem_stmt = select(TeamMember).where(TeamMember.team_id == sprint_in.team_id, TeamMember.user_id == current_user.id)
    mem_res = await db.execute(mem_stmt)
    member = mem_res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if member.role != TeamRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team admins can create sprints")

    sprint = Sprint(
        team_id=sprint_in.team_id,
        name=sprint_in.name,
        start_date=sprint_in.start_date,
        end_date=sprint_in.end_date,
        status=sprint_in.status
    )
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return SprintOut.model_validate(sprint)


@router.get("/{sprint_id}", response_model=SprintOut)
async def get_sprint(
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Sprint).where(Sprint.id == sprint_id).options(selectinload(Sprint.tasks))
    res = await db.execute(stmt)
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    
    total_tasks = len(sprint.tasks)
    total_pts = sum(t.story_points for t in sprint.tasks)
    comp_pts = sum(t.story_points for t in sprint.tasks if t.status == TaskStatus.DONE)
    s_out = SprintOut.model_validate(sprint)
    s_out.total_tasks = total_tasks
    s_out.total_points = total_pts
    s_out.completed_points = comp_pts
    return s_out


@router.get("/{sprint_id}/board", response_model=SprintBoardOut)
async def get_sprint_board(
    sprint_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    High-Read Sprint Board Endpoint with Redis Caching strategy.
    Returns board columns grouped by status, with cache hit/miss diagnostic headers.
    """
    # 1. Check Redis Cache
    cached_data = await cache_service.get_sprint_board(sprint_id)
    if cached_data:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Cache-Key"] = f"sprint_board:{sprint_id}"
        cached_data["cached"] = True
        cached_data["cache_source"] = "Redis Cache"
        return cached_data

    # 2. Database fetch on Cache Miss
    stmt = (
        select(Sprint)
        .where(Sprint.id == sprint_id)
        .options(
            selectinload(Sprint.tasks).selectinload(Task.assignee)
        )
    )
    res = await db.execute(stmt)
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    # Group tasks into columns
    columns: Dict[str, List[dict]] = {
        TaskStatus.TODO.value: [],
        TaskStatus.IN_PROGRESS.value: [],
        TaskStatus.IN_REVIEW.value: [],
        TaskStatus.DONE.value: []
    }

    # Sort tasks by position
    sorted_tasks = sorted(sprint.tasks, key=lambda t: t.position)
    for t in sorted_tasks:
        col_name = t.status.value
        t_data = TaskOut.model_validate(t).model_dump(mode="json")
        if col_name in columns:
            columns[col_name].append(t_data)
        else:
            columns[col_name] = [t_data]

    total_tasks = len(sprint.tasks)
    total_pts = sum(t.story_points for t in sprint.tasks)
    comp_pts = sum(t.story_points for t in sprint.tasks if t.status == TaskStatus.DONE)

    sprint_meta = SprintOut.model_validate(sprint).model_dump(mode="json")
    sprint_meta["total_tasks"] = total_tasks
    sprint_meta["total_points"] = total_pts
    sprint_meta["completed_points"] = comp_pts

    board_payload = {
        "sprint": sprint_meta,
        "columns": columns,
        "cached": False,
        "cache_source": "Database Query (Fresh)"
    }

    # 3. Store into Redis Cache
    await cache_service.set_sprint_board(sprint_id, board_payload, ttl=120)

    response.headers["X-Cache"] = "MISS"
    response.headers["X-Cache-Key"] = f"sprint_board:{sprint_id}"
    return board_payload


@router.put("/{sprint_id}", response_model=SprintOut)
async def update_sprint(
    sprint_id: int,
    sprint_in: SprintUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Sprint).where(Sprint.id == sprint_id)
    res = await db.execute(stmt)
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    # Check admin privileges
    mem_stmt = select(TeamMember).where(TeamMember.team_id == sprint.team_id, TeamMember.user_id == current_user.id)
    mem_res = await db.execute(mem_stmt)
    member = mem_res.scalar_one_or_none()
    if not member or member.role != TeamRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team admins can update sprints")

    if sprint_in.name is not None:
        sprint.name = sprint_in.name
    if sprint_in.start_date is not None:
        sprint.start_date = sprint_in.start_date
    if sprint_in.end_date is not None:
        sprint.end_date = sprint_in.end_date
    if sprint_in.status is not None:
        sprint.status = sprint_in.status

    await db.commit()
    await db.refresh(sprint)
    # Invalidate cache
    await cache_service.invalidate_sprint(sprint_id)
    return SprintOut.model_validate(sprint)


@router.delete("/{sprint_id}")
async def delete_sprint(
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Sprint).where(Sprint.id == sprint_id)
    res = await db.execute(stmt)
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    # Check admin privileges
    mem_stmt = select(TeamMember).where(TeamMember.team_id == sprint.team_id, TeamMember.user_id == current_user.id)
    mem_res = await db.execute(mem_stmt)
    member = mem_res.scalar_one_or_none()
    if not member or member.role != TeamRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team admins can delete sprints")

    await db.delete(sprint)
    await db.commit()
    await cache_service.invalidate_sprint(sprint_id)
    return {"message": "Sprint deleted successfully"}
