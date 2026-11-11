from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any, Dict, Union
import bcrypt
from jose import jwt
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from app.core.config import settings


def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or hashed_password.startswith("!"):
        return False
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def generate_secure_token() -> str:
    """Generate a URL-safe random token for email verification or password reset."""
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    """Hash a single-use auth token before persisting it to the database."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_temp_password(length: int = 12) -> str:
    """Generate a random temporary default password for newly invited teammates."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def verify_google_id_token(credential: str) -> Dict[str, Any]:
    """Verify a Google Identity Services ID token and return its claims."""
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google Sign-In is not configured on the server")
    return google_id_token.verify_oauth2_token(
        credential,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID
    )
