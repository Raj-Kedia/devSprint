from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(min_length=6)


class UserOut(UserBase):
    id: int
    is_verified: bool = True
    auth_provider: str = "email"
    must_change_password: bool = False
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterResponse(BaseModel):
    message: str
    email: EmailStr
    requires_verification: bool = True
    email_sent: bool = False


class AuthConfigOut(BaseModel):
    google_enabled: bool
    google_client_id: Optional[str] = None
    email_enabled: bool


class MessageResponse(BaseModel):
    message: str
    email_sent: Optional[bool] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
