import logging
from typing import AsyncGenerator
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

logger = logging.getLogger("devsprint.database")

Base = declarative_base()

# Choose database engine
database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql://") and not database_url.startswith("postgresql+asyncpg://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine_kwargs = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
}

# Production connection pool tuning for PostgreSQL
if "sqlite" not in database_url:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_recycle": 1800,
    })

engine = create_async_engine(
    database_url,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def _create_and_migrate_sync(sync_conn):
    """Create missing tables and backfill newly added User columns on existing DBs."""
    Base.metadata.create_all(sync_conn)
    inspector = inspect(sync_conn)
    if "users" not in inspector.get_table_names():
        return

    existing_cols = {col["name"] for col in inspector.get_columns("users")}
    column_alters = {
        "is_verified": "ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT TRUE",
        "auth_provider": "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) NOT NULL DEFAULT 'email'",
        "google_sub": "ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)",
        "must_change_password": "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
    }
    for col_name, ddl in column_alters.items():
        if col_name not in existing_cols:
            sync_conn.execute(text(ddl))

    sync_conn.execute(
        text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)")
    )


async def init_db():
    global engine
    try:
        # Test connection
        async with engine.begin() as conn:
            await conn.run_sync(_create_and_migrate_sync)
        logger.info("Database initialized successfully with Primary Engine.")
    except Exception as e:
        logger.warning(f"Primary database connection failed: {e}. Switching to SQLite fallback engine...")
        engine = create_async_engine(settings.SQLITE_FALLBACK_URL, echo=False, future=True)
        # Update existing sessionmaker in-place so all existing imports use the new engine!
        AsyncSessionLocal.configure(bind=engine)
        async with engine.begin() as conn:
            await conn.run_sync(_create_and_migrate_sync)
        logger.info("Database initialized successfully with SQLite Fallback Engine.")
