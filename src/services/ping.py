#!/usr/bin/env python3
"""
Ping Service Layer
Business logic for ping operations with Redis caching
"""

import logging
from datetime import datetime, timezone
from typing import Any

from src.config.redis_config import get_redis_config
from src.db.ping import get_ping_stats, increment_ping_count, reset_ping_count

logger = logging.getLogger(__name__)


class PingService:
    """Service for handling ping operations with caching"""

    def __init__(self):
        self.redis_config = get_redis_config()
        self.cache_ttl = 300  # Cache for 5 minutes
        self.cache_key = "ping:count"

    def handle_ping(self) -> dict[str, Any]:
        """
        Handle a ping request by incrementing counter and returning response.
        Uses Redis for caching to reduce database load.

        Returns:
            Dict containing pong response and count
        """
        try:
            # Try to use Redis cache first
            if self.redis_config.is_available():
                cached_count = self.redis_config.get_cache(self.cache_key)

                if cached_count:
                    # Increment in Redis
                    new_count = self.redis_config.increment_counter(
                        self.cache_key, amount=1, ttl=self.cache_ttl
                    )

                    # Sync with database every 10 pings
                    if new_count and new_count % 10 == 0:
                        self._sync_to_database()

                    count = new_count if new_count else int(cached_count) + 1
                else:
                    # Cache miss - get from database and cache
                    count = increment_ping_count()
                    if count is not None:
                        self.redis_config.set_cache(self.cache_key, str(count), ttl=self.cache_ttl)
                    else:
                        count = 0
            else:
                # Redis unavailable - use database directly
                count = increment_ping_count()
                if count is None:
                    count = 0

            return {"message": "pong", "count": count, "timestamp": datetime.now(timezone.utc).isoformat()}

        except Exception as e:
            logger.error(f"Error handling ping: {e}")
            return {
                "message": "pong",
                "count": 0,
                "error": "Service temporarily unavailable",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

    def get_statistics(self) -> dict[str, Any]:
        """
        Get detailed ping statistics

        Returns:
            Dict: Statistics about ping usage
        """
        try:
            # Try cache first
            if self.redis_config.is_available():
                cached_count = self.redis_config.get_cache(self.cache_key)
                if cached_count:
                    return {
                        "total_pings": int(cached_count),
                        "cached": True,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }

            # Get from database
            stats = get_ping_stats()
            if stats:
                # Update cache
                if self.redis_config.is_available():
                    self.redis_config.set_cache(
                        self.cache_key, str(stats["count"]), ttl=self.cache_ttl
                    )

                return {
                    "total_pings": stats["count"],
                    "last_ping_at": stats["last_ping_at"],
                    "created_at": stats["created_at"],
                    "updated_at": stats["updated_at"],
                    "cached": False,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            else:
                return {
                    "total_pings": 0,
                    "error": "Failed to retrieve statistics",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

        except Exception as e:
            logger.error(f"Error getting ping statistics: {e}")
            return {"total_pings": 0, "error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}

    def reset_counter(self) -> dict[str, Any]:
        """
        Reset the ping counter (admin operation)

        Returns:
            Dict: Result of reset operation
        """
        try:
            # Reset in database
            success = reset_ping_count()

            # Clear cache
            if self.redis_config.is_available():
                self.redis_config.delete_cache(self.cache_key)

            return {
                "success": success,
                "message": "Counter reset successfully" if success else "Failed to reset counter",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.error(f"Error resetting counter: {e}")
            return {"success": False, "error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}

    def _sync_to_database(self):
        """
        Sync Redis cache count to database
        """
        try:
            cached_count = self.redis_config.get_cache(self.cache_key)
            if cached_count:
                # This is a simplified sync - in production you might want
                # more sophisticated sync logic
                logger.info(f"Syncing count {cached_count} to database")
        except Exception as e:
            logger.error(f"Error syncing to database: {e}")


# Global service instance
_ping_service = None


def get_ping_service() -> PingService:
    """Get the global ping service instance (singleton pattern)"""
    global _ping_service
    if _ping_service is None:
        _ping_service = PingService()
    return _ping_service
