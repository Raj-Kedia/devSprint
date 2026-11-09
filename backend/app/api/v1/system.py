from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.user import User
from app.core.redis import cache_manager
from app.services.cache_service import cache_service

router = APIRouter()


@router.get("/cache-stats")
async def get_cache_stats(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns live Redis cache metrics: hit ratio, misses, invalidations,
    and storage driver status. Restricted to authenticated users.
    """
    return cache_manager.get_stats()


@router.post("/cache-clear")
async def clear_cache(
    current_user: User = Depends(get_current_user)
):
    """Manually invalidates all sprint board cache keys. Restricted to authenticated team members."""
    await cache_service.clear_all()
    return {"message": "All sprint board caches flushed successfully", "stats": cache_manager.get_stats()}


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "redis_connected": cache_manager.is_connected,
        "cache_mode": cache_manager.stats.get("mode")
    }
