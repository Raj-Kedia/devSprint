from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserOut


class ActivityLogOut(BaseModel):
    id: int
    task_id: int
    user_id: Optional[int] = None
    change_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    message: Optional[str] = None
    created_at: datetime
    user: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)
