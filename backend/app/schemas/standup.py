from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserOut


class StandupGenerateRequest(BaseModel):
    sprint_id: int
    user_id: Optional[int] = None  # None means generate for whole team
    custom_prompt_context: Optional[str] = None


class StandupReportOut(BaseModel):
    id: int
    sprint_id: int
    user_id: Optional[int] = None
    report_date: date
    summary: str
    yesterday: Optional[str] = None
    today: Optional[str] = None
    blockers: Optional[str] = None
    model_used: str
    created_at: datetime
    user: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)
