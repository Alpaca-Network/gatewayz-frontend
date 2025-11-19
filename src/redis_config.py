"""
Redis Configuration
==================

Redis client configuration and utilities for caching and rate limiting.
"""

import logging
import os
from typing import Optional

import redis
from redis.exceptions import ConnectionError, RedisError

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# Global Redis client
_redis_client: Optional[redis.Redis] = None


def get_redis_config() -> dict:
    """Get Redis configuration"""
    return {"url": REDIS_URL, "password": REDIS_PASSWORD, "db": REDIS_DB}


def get_redis_client() -> Optional[redis.Redis]:
    """Get Redis client instance"""
    global _redis_client

    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                REDIS_URL,
                password=REDIS_PASSWORD,
                db=REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )

            # Test connection
            _redis_client.ping()
            logger.info("Redis client connected successfully")

        except (ConnectionError, RedisError) as e:
            logger.warning(f"Redis connection failed: {e}")
            _redis_client = None

    return _redis_client


def is_redis_available() -> bool:
    """Check if Redis is available"""
    try:
        client = get_redis_client()
        if client:
            client.ping()
            return True
    except Exception:
        pass
    return False


def clear_redis_cache() -> bool:
    """Clear all Redis cache"""
    try:
        client = get_redis_client()
        if client:
            client.flushdb()
            logger.info("Redis cache cleared successfully")
            return True
    except Exception as e:
        logger.error(f"Failed to clear Redis cache: {e}")
    return False


def get_redis_info() -> dict:
    """Get Redis server information"""
    try:
        client = get_redis_client()
        if client:
            info = client.info()
            return {
                "connected": True,
                "version": info.get("redis_version"),
                "memory_used": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_commands_processed": info.get("total_commands_processed"),
            }
    except Exception as e:
        logger.error(f"Failed to get Redis info: {e}")

    return {"connected": False, "error": "Redis not available"}
