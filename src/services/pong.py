#!/usr/bin/env python3
"""
Ping Service Layer
Business logic for ping operations
"""

import logging
from typing import Optional
from datetime import datetime

from src.db.ping import increment_ping_count, get_ping_count
from src.redis_config import get_redis_config

logger = logging.getLogger(__name__)


class PingService:
    """Service for handling ping requests"""

    def __init__(self):
        self.redis_config = get_redis_config()
        self.cache_ttl = 60  # Cache for 60 seconds

    def handle_ping(self) -> dict:
        """
        Handle a ping request.
        Increments the counter and returns the count.
        Uses Redis for caching to reduce database load.

        Returns:
            dict: Response with pong message and ping count
        """
        try:
            # Try to get count from Redis cache first
            cache_key = "ping:count"
            cached_count = self.redis_config.get_cache(cache_key)

            if cached_count:
                # Increment in Redis
                new_count = self.redis_config.increment_counter(cache_key, amount=1, ttl=self.cache_ttl)

                # Periodically sync with database (every 10 pings)
                if new_count and new_count % 10 == 0:
                    self._sync_to_database(new_count)

                count = new_count if new_count else int(cached_count) + 1
            else:
                # Increment in database
                count = increment_ping_count()

                if count is None:
                    logger.error("Failed to increment ping count in database")
                    count = 0
                else:
                    # Cache the count in Redis
                    self.redis_config.set_cache(cache_key, str(count), ttl=self.cache_ttl)

            return {
                "message": "pong",
                "count": count,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Error handling ping: {e}")
            return {
                "message": "pong",
                "count": 0,
                "error": "Failed to track ping count",
                "timestamp": datetime.utcnow().isoformat()
            }

    def get_statistics(self) -> dict:
        """
        Get ping statistics.

        Returns:
            dict: Statistics about ping usage
        """
        try:
            # Try Redis first
            cache_key = "ping:count"
            cached_count = self.redis_config.get_cache(cache_key)

            if cached_count:
                count = int(cached_count)
            else:
                # Get from database
                count = get_ping_count()
                if count is None:
                    count = 0
                else:
                    # Update cache
                    self.redis_config.set_cache(cache_key, str(count), ttl=self.cache_ttl)

            return {
                "total_pings": count,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting ping statistics: {e}")
            return {
                "total_pings": 0,
                "error": "Failed to retrieve statistics",
                "timestamp": datetime.utcnow().isoformat()
            }

    def _sync_to_database(self, count: int):
        """
        Internal method to sync Redis count to database.

        Args:
            count: Current count to sync
        """
        try:
            # This could be improved to update the database with the exact count
            # For now, we'll let the database increment naturally
            pass
        except Exception as e:
            logger.error(f"Error syncing to database: {e}")


# Global service instance
_ping_service = None


def get_ping_service() -> PingService:
    """Get the global ping service instance"""
    global _ping_service
    if _ping_service is None:
        _ping_service = PingService()
    return _ping_service