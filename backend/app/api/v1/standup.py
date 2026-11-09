from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.standup import StandupReport
from app.schemas.standup import StandupReportOut, StandupGenerateRequest
from app.services.standup_agent import standup_agent

router = APIRouter()


@router.post("/generate", response_model=StandupReportOut)
async def generate_standup_report(
    req: StandupGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    On-demand or scheduled agent loop invocation.
    Reads last 24h task activities, synthesizes summary, and stores StandupReport.
    """
    try:
        report = await standup_agent.generate_standup(
            db=db,
            sprint_id=req.sprint_id,
            user_id=req.user_id,
            custom_context=req.custom_prompt_context
        )
        return report
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Standup generation failed: {e}")


@router.get("/sprint/{sprint_id}", response_model=List[StandupReportOut])
async def list_sprint_standups(
    sprint_id: int,
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(StandupReport)
        .where(StandupReport.sprint_id == sprint_id)
        .options(selectinload(StandupReport.user))
        .order_by(StandupReport.created_at.desc())
    )
    if user_id:
        stmt = stmt.where(StandupReport.user_id == user_id)

    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{report_id}", response_model=StandupReportOut)
async def get_standup_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(StandupReport).where(StandupReport.id == report_id).options(selectinload(StandupReport.user))
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report
