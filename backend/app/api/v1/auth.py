import asyncio
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user, resolve_frontend_url
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_secure_token,
    get_password_hash,
    hash_token,
    verify_google_id_token,
    verify_password,
)
from app.models.user import AuthToken, Team, TeamMember, TeamRole, User
from app.schemas.user import (
    AuthConfigOut,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    MessageResponse,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    VerifyEmailRequest,
)
from app.services.email_service import email_service

router = APIRouter()


async def _create_default_workspace(db: AsyncSession, user: User) -> None:
    """Provision a personal default workspace with the user as Admin."""
    team = Team(name=f"{user.name}'s Workspace")
    db.add(team)
    await db.flush()
    db.add(TeamMember(user_id=user.id, team_id=team.id, role=TeamRole.ADMIN))


async def _issue_auth_token(
    db: AsyncSession,
    user_id: int,
    token_type: str,
    ttl: timedelta
) -> str:
    """Invalidate prior unused tokens of this type and persist a new single-use token."""
    now = datetime.now(timezone.utc)
    await db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user_id,
            AuthToken.token_type == token_type,
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    raw_token = generate_secure_token()
    db.add(
        AuthToken(
            user_id=user_id,
            token_hash=hash_token(raw_token),
            token_type=token_type,
            expires_at=now + ttl,
        )
    )
    await db.flush()
    return raw_token


async def _consume_auth_token(
    db: AsyncSession,
    raw_token: str,
    token_type: str
) -> User:
    """Validate, mark used, and return the owner of a single-use email/reset token."""
    token_hash = hash_token(raw_token.strip())
    stmt = select(AuthToken).where(
        AuthToken.token_hash == token_hash,
        AuthToken.token_type == token_type,
    )
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used token",
        )

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link has expired. Please request a new one.",
        )

    user_res = await db.execute(select(User).where(User.id == record.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    record.used_at = now
    return user


async def _send_verification_for_user(
    db: AsyncSession,
    user: User,
    frontend_url: str
) -> bool:
    raw_token = await _issue_auth_token(
        db=db,
        user_id=user.id,
        token_type="verify_email",
        ttl=timedelta(hours=24),
    )
    await db.commit()
    verify_url = f"{frontend_url}/?verify_token={quote(raw_token)}"
    return await email_service.send_verification_email(user.email, user.name, verify_url)


@router.get("/config", response_model=AuthConfigOut)
async def get_auth_config():
    return AuthConfigOut(
        google_enabled=bool(settings.GOOGLE_CLIENT_ID),
        google_client_id=settings.GOOGLE_CLIENT_ID,
        email_enabled=email_service.is_configured(),
    )


@router.post("/register", response_model=RegisterResponse)
async def register(
    user_in: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    normalized_email = user_in.email.strip().lower()
    stmt = select(User).where(func.lower(User.email) == normalized_email)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        if existing.auth_provider == "google" and existing.password_hash.startswith("!"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email uses Google Sign-In. Continue with Google or reset password."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )

    user = User(
        name=user_in.name.strip(),
        email=normalized_email,
        password_hash=get_password_hash(user_in.password),
        is_verified=False,
        auth_provider="email",
    )
    db.add(user)
    await db.flush()

    await _create_default_workspace(db, user)
    frontend_url = resolve_frontend_url(request)
    email_sent = await _send_verification_for_user(db, user, frontend_url)

    return RegisterResponse(
        message=(
            "Account created! Check your email for the verification link before signing in."
            if email_sent
            else "Account created! Verification is required before signing in (SMTP email is not configured on the server yet)."
        ),
        email=user.email,
        requires_verification=True,
        email_sent=email_sent,
    )


@router.post("/verify-email", response_model=Token)
async def verify_email(req: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    user = await _consume_auth_token(db, req.token, "verify_email")
    user.is_verified = True
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    req: ResendVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    normalized_email = req.email.strip().lower()
    res = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = res.scalar_one_or_none()

    email_sent = False
    if user and not user.is_verified:
        frontend_url = resolve_frontend_url(request)
        email_sent = await _send_verification_for_user(db, user, frontend_url)

    return MessageResponse(
        message="If your account exists and is unverified, a verification link has been sent.",
        email_sent=email_sent if (user and not user.is_verified) else None,
    )


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    normalized_email = credentials.email.strip().lower()
    stmt = select(User).where(func.lower(User.email) == normalized_email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.password_hash.startswith("!"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google Sign-In. Please click 'Continue with Google' or use 'Forgot password?'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        frontend_url = resolve_frontend_url(request)
        email_sent = await _send_verification_for_user(db, user, frontend_url)
        msg = (
            "Please verify your email address before signing in. A new verification email has been sent."
            if email_sent
            else "Please verify your email address before signing in."
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=msg,
        )

    token = create_access_token(user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/google", response_model=Token)
async def google_auth(req: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In is not configured on the server (GOOGLE_CLIENT_ID missing).",
        )

    try:
        claims = await asyncio.to_thread(verify_google_id_token, req.credential)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google credential",
        )

    email = (claims.get("email") or "").strip().lower()
    google_sub = claims.get("sub")
    if not email or not google_sub or not claims.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account must have a verified email address",
        )

    stmt = select(User).where(
        (User.google_sub == google_sub) | (func.lower(User.email) == email)
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if user:
        if not user.google_sub:
            user.google_sub = google_sub
        if not user.is_verified:
            user.is_verified = True
        await db.commit()
        await db.refresh(user)
    else:
        display_name = (claims.get("name") or email.split("@")[0]).strip()[:100]
        user = User(
            name=display_name,
            email=email,
            password_hash="!google-oauth!",
            is_verified=True,
            auth_provider="google",
            google_sub=google_sub,
        )
        db.add(user)
        await db.flush()
        await _create_default_workspace(db, user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    normalized_email = req.email.strip().lower()
    res = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = res.scalar_one_or_none()

    email_sent = None
    if user:
        raw_token = await _issue_auth_token(
            db=db,
            user_id=user.id,
            token_type="reset_password",
            ttl=timedelta(hours=1),
        )
        await db.commit()
        reset_url = f"{resolve_frontend_url(request)}/?reset_token={quote(raw_token)}"
        email_sent = await email_service.send_password_reset_email(user.email, user.name, reset_url)

    return MessageResponse(
        message="If an account with that email exists, a password reset link has been sent.",
        email_sent=email_sent,
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await _consume_auth_token(db, req.token, "reset_password")
    user.password_hash = get_password_hash(req.new_password)
    user.is_verified = True
    user.must_change_password = False
    await db.commit()
    return MessageResponse(message="Password updated successfully. You can now sign in.")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    has_existing_password = not current_user.password_hash.startswith("!")
    if has_existing_password and not current_user.must_change_password:
        if not req.current_password or not verify_password(req.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

    current_user.password_hash = get_password_hash(req.new_password)
    current_user.must_change_password = False
    await db.commit()
    return MessageResponse(message="Password updated successfully.")


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
