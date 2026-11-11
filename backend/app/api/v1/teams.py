from typing import List
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user, resolve_frontend_url
from app.models.user import User, Team, TeamMember, TeamRole
from app.schemas.team import TeamOut, TeamCreate, TeamWithMembers, TeamInviteRequest, TeamMemberOut
from app.core.security import generate_temp_password, get_password_hash
from app.services.email_service import email_service

router = APIRouter()


@router.get("/", response_model=List[TeamOut])
async def list_user_teams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Team)
        .join(TeamMember, Team.id == TeamMember.team_id)
        .where(TeamMember.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/", response_model=TeamOut)
async def create_team(
    team_in: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    team = Team(name=team_in.name)
    db.add(team)
    await db.flush()

    membership = TeamMember(
        user_id=current_user.id,
        team_id=team.id,
        role=TeamRole.ADMIN
    )
    db.add(membership)
    await db.commit()
    await db.refresh(team)
    return team


@router.get("/{team_id}", response_model=TeamWithMembers)
async def get_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify user is member of the team
    check_stmt = select(TeamMember).where(
        TeamMember.team_id == team_id,
        TeamMember.user_id == current_user.id
    )
    check_res = await db.execute(check_stmt)
    if not check_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this workspace")

    stmt = (
        select(Team)
        .where(Team.id == team_id)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
    )
    res = await db.execute(stmt)
    team = res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


@router.post("/{team_id}/invite", response_model=TeamMemberOut)
async def invite_member(
    team_id: int,
    invite_in: TeamInviteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check admin privileges
    check_stmt = select(TeamMember).where(
        TeamMember.team_id == team_id,
        TeamMember.user_id == current_user.id
    )
    check_res = await db.execute(check_stmt)
    member_record = check_res.scalar_one_or_none()
    if not member_record or member_record.role != TeamRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team admins can invite members")

    team_res = await db.execute(select(Team).where(Team.id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    normalized_email = invite_in.email.strip().lower()

    # Find or provision user
    u_stmt = select(User).where(func.lower(User.email) == normalized_email)
    u_res = await db.execute(u_stmt)
    target_user = u_res.scalar_one_or_none()

    default_password = None
    if not target_user:
        default_password = generate_temp_password()
        # Create an account for invited teammate with a generated default password
        target_user = User(
            name=normalized_email.split("@")[0].capitalize(),
            email=normalized_email,
            password_hash=get_password_hash(default_password),
            is_verified=True,
            auth_provider="email",
            must_change_password=True,
        )
        db.add(target_user)
        await db.flush()

    # Check if already a member
    mem_check = select(TeamMember).where(
        TeamMember.team_id == team_id,
        TeamMember.user_id == target_user.id
    )
    mem_res = await db.execute(mem_check)
    if mem_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a member of this team")

    new_member = TeamMember(
        user_id=target_user.id,
        team_id=team_id,
        role=invite_in.role
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)

    frontend_url = resolve_frontend_url(request)
    login_url = f"{frontend_url}/?invite_email={quote(normalized_email)}&team={team_id}"
    email_sent = await email_service.send_team_invite_email(
        to_email=normalized_email,
        team_name=team.name,
        inviter_name=current_user.name,
        role=invite_in.role.value,
        login_url=login_url,
        default_password=default_password,
    )

    # Reload with user object
    reload_stmt = select(TeamMember).where(TeamMember.id == new_member.id).options(selectinload(TeamMember.user))
    r_res = await db.execute(reload_stmt)
    member_out = TeamMemberOut.model_validate(r_res.scalar_one())
    member_out.email_sent = email_sent
    return member_out
