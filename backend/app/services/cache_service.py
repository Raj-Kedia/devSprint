import logging
from typing import Optional, Dict, Any
from app.core.redis import cache_manager

logger = logging.getLogger("devsprint.cache")


class CacheService:
    @staticmethod
    def _board_key(sprint_id: int) -> str:
        return f"sprint_board:{sprint_id}"

    @classmethod
    async def get_sprint_board(cls, sprint_id: int) -> Optional[Dict[str, Any]]:
        key = cls._board_key(sprint_id)
        return await cache_manager.get(key)

    @classmethod
    async def set_sprint_board(cls, sprint_id: int, board_data: Dict[str, Any], ttl: int = 120) -> bool:
        key = cls._board_key(sprint_id)
        return await cache_manager.set(key, board_data, ttl=ttl)

    @classmethod
    async def invalidate_sprint(cls, sprint_id: int):
        key = cls._board_key(sprint_id)
        await cache_manager.delete(key)
        logger.info(f"Invalidated Redis cache for sprint {sprint_id}")

    @classmethod
    async def clear_all(cls):
        await cache_manager.delete_pattern("sprint_board:*")


cache_service = CacheService()
