from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict
from app.models.sprint import SprintStatus
from app.schemas.task import TaskOut


class SprintBase(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    status: SprintStatus = SprintStatus.ACTIVE


class SprintCreate(SprintBase):
    team_id: int


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[SprintStatus] = None


class SprintOut(SprintBase):
    id: int
    team_id: int
    created_at: datetime
    total_tasks: Optional[int] = 0
    total_points: Optional[int] = 0
    completed_points: Optional[int] = 0
    model_config = ConfigDict(from_attributes=True)


class SprintBoardOut(BaseModel):
    sprint: SprintOut
    columns: Dict[str, List[TaskOut]]
    cached: bool = False
    cache_source: Optional[str] = None
