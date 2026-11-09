from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.models.task import TaskStatus, TaskPriority
from app.schemas.user import UserOut
from app.schemas.activity import ActivityLogOut


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    story_points: int = 1
    assignee_id: Optional[int] = None


class TaskCreate(TaskBase):
    sprint_id: int


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    story_points: Optional[int] = None
    assignee_id: Optional[int] = None
    position: Optional[int] = None


class TaskMoveRequest(BaseModel):
    new_status: TaskStatus
    new_position: int = 0


class TaskCommentCreate(BaseModel):
    comment: str


class TaskOut(TaskBase):
    id: int
    sprint_id: int
    position: int
    created_at: datetime
    updated_at: datetime
    assignee: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)


class TaskDetailOut(TaskOut):
    activities: List[ActivityLogOut] = []
