import json
import logging
import time
from typing import Any, Optional, Dict
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("devsprint.redis")


class CacheManager:
    def __init__(self):
        self.client: Optional[aioredis.Redis] = None
        self.is_connected: bool = False
        self._memory_cache: Dict[str, Dict[str, Any]] = {}  # Fallback: {key: {val, expire}}
        self.stats = {
            "hits": 0,
            "misses": 0,
            "writes": 0,
            "invalidations": 0,
            "mode": "disconnected"
        }

    async def connect(self):
        if not settings.ENABLE_REDIS:
            self.stats["mode"] = "in-memory (disabled)"
            return

        try:
            self.client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=2.0
            )
            # Test ping
            await self.client.ping()
            self.is_connected = True
            self.stats["mode"] = "redis-live"
            logger.info("Connected to Redis instance successfully.")
        except Exception as e:
            self.is_connected = False
            self.stats["mode"] = "in-memory-fallback"
            logger.warning(f"Could not connect to Redis ({e}). Running with in-memory cache fallback.")

    async def disconnect(self):
        if self.client:
            await self.client.close()
            self.is_connected = False

    async def get(self, key: str) -> Optional[Any]:
        if self.is_connected and self.client:
            try:
                data = await self.client.get(key)
                if data is not None:
                    self.stats["hits"] += 1
                    return json.loads(data)
                self.stats["misses"] += 1
                return None
            except Exception as e:
                logger.error(f"Redis get error: {e}")

        # In-memory fallback
        item = self._memory_cache.get(key)
        if item:
            if item["expire"] is None or item["expire"] > time.time():
                self.stats["hits"] += 1
                return item["val"]
            else:
                del self._memory_cache[key]
        self.stats["misses"] += 1
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        ttl = ttl or settings.CACHE_DEFAULT_TTL
        self.stats["writes"] += 1
        serialized = json.dumps(value, default=str)

        if self.is_connected and self.client:
            try:
                await self.client.set(key, serialized, ex=ttl)
                return True
            except Exception as e:
                logger.error(f"Redis set error: {e}")

        # In-memory fallback
        self._memory_cache[key] = {
            "val": value,
            "expire": time.time() + ttl if ttl else None
        }
        return True

    async def delete(self, key: str) -> bool:
        self.stats["invalidations"] += 1
        if self.is_connected and self.client:
            try:
                await self.client.delete(key)
            except Exception as e:
                logger.error(f"Redis delete error: {e}")

        if key in self._memory_cache:
            del self._memory_cache[key]
        return True

    async def delete_pattern(self, pattern: str) -> int:
        count = 0
        if self.is_connected and self.client:
            try:
                keys = await self.client.keys(pattern)
                if keys:
                    count = await self.client.delete(*keys)
                    self.stats["invalidations"] += count
                    return count
            except Exception as e:
                logger.error(f"Redis delete pattern error: {e}")

        # In-memory fallback
        to_del = [k for k in self._memory_cache.keys() if pattern.replace("*", "") in k]
        for k in to_del:
            del self._memory_cache[k]
            count += 1
        self.stats["invalidations"] += count
        return count

    def get_stats(self) -> Dict[str, Any]:
        total_requests = self.stats["hits"] + self.stats["misses"]
        hit_ratio = round((self.stats["hits"] / total_requests * 100), 2) if total_requests > 0 else 0.0
        return {
            **self.stats,
            "is_connected": self.is_connected,
            "total_requests": total_requests,
            "hit_ratio_percent": hit_ratio,
        }


cache_manager = CacheManager()
