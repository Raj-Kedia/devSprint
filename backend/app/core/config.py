from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"
    )

    PROJECT_NAME: str = "DevSprint API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development")
    
    # Security
    SECRET_KEY: str = Field(default="devsprint-super-secret-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    FRONTEND_URL: Optional[str] = Field(default=None)

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = Field(default=None)

    # Email / Gmail SMTP
    SMTP_HOST: str = Field(default="smtp.gmail.com")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: Optional[str] = Field(default=None)
    SMTP_PASSWORD: Optional[str] = Field(default=None)
    SMTP_FROM_NAME: str = Field(default="DevSprint")
    SMTP_FROM_EMAIL: Optional[str] = Field(default=None)
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/devsprint"
    )
    SQLITE_FALLBACK_URL: str = "sqlite+aiosqlite:///./devsprint.db"
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    CACHE_DEFAULT_TTL: int = 120  # seconds
    ENABLE_REDIS: bool = True
    
    # LLM & AI Standup
    OPENAI_API_KEY: Optional[str] = Field(default=None)
    GEMINI_API_KEY: Optional[str] = Field(default=None)
    AI_MODEL: str = Field(default="gemini-1.5-flash")
    
    # CORS (Strict production-compatible origins)
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]


settings = Settings()
