from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict
from app.models.user import TeamRole
from app.schemas.user import UserOut


class TeamBase(BaseModel):
    name: str


class TeamCreate(TeamBase):
    pass


class TeamMemberOut(BaseModel):
    id: int
    user_id: int
    team_id: int
    role: TeamRole
    user: UserOut
    email_sent: Optional[bool] = None
    model_config = ConfigDict(from_attributes=True)


class TeamOut(TeamBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TeamWithMembers(TeamOut):
    members: List[TeamMemberOut] = []


class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: TeamRole = TeamRole.MEMBER
