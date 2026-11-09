from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.analytics import SprintAnalyticsOut
from app.services.analytics_service import analytics_service

router = APIRouter()


@router.get("/sprint/{sprint_id}", response_model=SprintAnalyticsOut)
async def get_sprint_analytics(
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns burndown chart coordinates, velocity completion rates,
    and team workload breakdown for sprint visualizations.
    """
    try:
        analytics = await analytics_service.get_sprint_analytics(db=db, sprint_id=sprint_id)
        return analytics
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
