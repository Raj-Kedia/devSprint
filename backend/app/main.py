import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.core.redis import cache_manager
from app.api.v1 import auth, teams, sprints, tasks, standup, analytics, system

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("devsprint")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and cache
    logger.info("Initializing DevSprint Database...")
    await init_db()
    try:
        from app.seed import seed_data
        await seed_data()
    except Exception as e:
        logger.warning(f"Database auto-seed check: {e}")

    logger.info("Connecting to Redis Cache...")
    await cache_manager.connect()
    yield
    # Shutdown
    logger.info("Closing Redis connection...")
    await cache_manager.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Team Task & Sprint Tracker with AI Standup Summaries & Redis Caching",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=r"^https://.*\.run\.app$|^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Cache", "X-Cache-Key"]
)

# Mount API Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(teams.router, prefix=f"{settings.API_V1_STR}/teams", tags=["Teams"])
app.include_router(sprints.router, prefix=f"{settings.API_V1_STR}/sprints", tags=["Sprints"])
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}/tasks", tags=["Tasks"])
app.include_router(standup.router, prefix=f"{settings.API_V1_STR}/standup", tags=["Daily AI Standup"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["Burndown & Analytics"])
app.include_router(system.router, prefix=f"{settings.API_V1_STR}/system", tags=["System & Cache Metrics"])

# Mount frontend static distribution if present
static_dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static_dist")
if os.path.exists(static_dist_path):
    assets_dir = os.path.join(static_dist_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str = ""):
        # Prevent intercepting API routes
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path == "openapi.json":
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = os.path.join(static_dist_path, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        return FileResponse(os.path.join(static_dist_path, "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "app": "DevSprint API",
            "status": "online",
            "docs": "/docs",
            "version": settings.VERSION
        }
