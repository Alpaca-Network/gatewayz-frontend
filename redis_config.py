#!/usr/bin/env python3
"""
Redis Configuration Module
Handles Redis connection and configuration for rate limiting and caching.
"""

import os
import logging
from typing import Optional
import redis
from redis.connection import ConnectionPool

logger = logging.getLogger(__name__)

class RedisConfig:
    """Redis configuration and connection management"""
    
    def __init__(self):
        self.redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self.redis_password = os.environ.get("REDIS_PASSWORD")
        self.redis_host = os.environ.get("REDIS_HOST", "localhost")
        self.redis_port = int(os.environ.get("REDIS_PORT", "6379"))
        self.redis_db = int(os.environ.get("REDIS_DB", "0"))
        self.redis_max_connections = int(os.environ.get("REDIS_MAX_CONNECTIONS", "50"))
        self.redis_socket_timeout = int(os.environ.get("REDIS_SOCKET_TIMEOUT", "5"))
        self.redis_socket_connect_timeout = int(os.environ.get("REDIS_SOCKET_CONNECT_TIMEOUT", "5"))
        self.redis_retry_on_timeout = os.environ.get("REDIS_RETRY_ON_TIMEOUT", "true").lower() == "true"
        
        self._client: Optional[redis.Redis] = None
        self._pool: Optional[ConnectionPool] = None
    
    def get_connection_pool(self) -> ConnectionPool:
        """Get Redis connection pool"""
        if self._pool is None:
            # Parse Redis URL if it contains connection details
            if self.redis_url and "://" in self.redis_url:
                # Use URL-based connection for Redis Cloud
                self._pool = ConnectionPool.from_url(
                    self.redis_url,
                    max_connections=self.redis_max_connections,
                    socket_timeout=self.redis_socket_timeout,
                    socket_connect_timeout=self.redis_socket_connect_timeout,
                    retry_on_timeout=self.redis_retry_on_timeout,
                    decode_responses=True
                )
            else:
                # Use individual parameters for local Redis
                self._pool = ConnectionPool(
                    host=self.redis_host,
                    port=self.redis_port,
                    db=self.redis_db,
                    password=self.redis_password,
                    max_connections=self.redis_max_connections,
                    socket_timeout=self.redis_socket_timeout,
                    socket_connect_timeout=self.redis_socket_connect_timeout,
                    retry_on_timeout=self.redis_retry_on_timeout,
                    decode_responses=True
                )
        return self._pool
    
    def get_client(self) -> redis.Redis:
        """Get Redis client instance"""
        if self._client is None:
            try:
                self._client = redis.Redis(
                    connection_pool=self.get_connection_pool(),
                    decode_responses=True
                )
                # Test connection
                self._client.ping()
                logger.info("Redis connection established successfully")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}. Falling back to local cache.")
                self._client = None
        return self._client
    
    def is_available(self) -> bool:
        """Check if Redis is available"""
        try:
            client = self.get_client()
            if client:
                client.ping()
                return True
        except Exception:
            pass
        return False
    
    def get_cache_key(self, prefix: str, identifier: str) -> str:
        """Generate cache key with prefix"""
        return f"{prefix}:{identifier}"
    
    def set_cache(self, key: str, value: any, ttl: int = 300) -> bool:
        """Set cache value with TTL"""
        try:
            client = self.get_client()
            if client:
                client.setex(key, ttl, value)
                return True
        except Exception as e:
            logger.warning(f"Failed to set cache key {key}: {e}")
        return False
    
    def get_cache(self, key: str) -> Optional[str]:
        """Get cache value"""
        try:
            client = self.get_client()
            if client:
                return client.get(key)
        except Exception as e:
            logger.warning(f"Failed to get cache key {key}: {e}")
        return None
    
    def delete_cache(self, key: str) -> bool:
        """Delete cache key"""
        try:
            client = self.get_client()
            if client:
                client.delete(key)
                return True
        except Exception as e:
            logger.warning(f"Failed to delete cache key {key}: {e}")
        return False
    
    def increment_counter(self, key: str, amount: int = 1, ttl: int = 300) -> Optional[int]:
        """Increment counter with TTL"""
        try:
            client = self.get_client()
            if client:
                pipe = client.pipeline()
                pipe.incrby(key, amount)
                pipe.expire(key, ttl)
                results = pipe.execute()
                return results[0]
        except Exception as e:
            logger.warning(f"Failed to increment counter {key}: {e}")
        return None
    
    def get_counter(self, key: str) -> Optional[int]:
        """Get counter value"""
        try:
            client = self.get_client()
            if client:
                value = client.get(key)
                return int(value) if value else 0
        except Exception as e:
            logger.warning(f"Failed to get counter {key}: {e}")
        return None
    
    def set_hash(self, key: str, field: str, value: any, ttl: int = 300) -> bool:
        """Set hash field value with TTL"""
        try:
            client = self.get_client()
            if client:
                pipe = client.pipeline()
                pipe.hset(key, field, value)
                pipe.expire(key, ttl)
                pipe.execute()
                return True
        except Exception as e:
            logger.warning(f"Failed to set hash {key}.{field}: {e}")
        return False
    
    def get_hash(self, key: str, field: str) -> Optional[str]:
        """Get hash field value"""
        try:
            client = self.get_client()
            if client:
                return client.hget(key, field)
        except Exception as e:
            logger.warning(f"Failed to get hash {key}.{field}: {e}")
        return None
    
    def get_all_hash(self, key: str) -> dict:
        """Get all hash fields"""
        try:
            client = self.get_client()
            if client:
                return client.hgetall(key)
        except Exception as e:
            logger.warning(f"Failed to get all hash {key}: {e}")
        return {}
    
    def delete_hash(self, key: str, field: str) -> bool:
        """Delete hash field"""
        try:
            client = self.get_client()
            if client:
                client.hdel(key, field)
                return True
        except Exception as e:
            logger.warning(f"Failed to delete hash field {key}.{field}: {e}")
        return False
    
    def add_to_set(self, key: str, value: str, ttl: int = 300) -> bool:
        """Add value to set with TTL"""
        try:
            client = self.get_client()
            if client:
                pipe = client.pipeline()
                pipe.sadd(key, value)
                pipe.expire(key, ttl)
                pipe.execute()
                return True
        except Exception as e:
            logger.warning(f"Failed to add to set {key}: {e}")
        return False
    
    def is_in_set(self, key: str, value: str) -> bool:
        """Check if value is in set"""
        try:
            client = self.get_client()
            if client:
                return client.sismember(key, value)
        except Exception as e:
            logger.warning(f"Failed to check set membership {key}: {e}")
        return False
    
    def remove_from_set(self, key: str, value: str) -> bool:
        """Remove value from set"""
        try:
            client = self.get_client()
            if client:
                client.srem(key, value)
                return True
        except Exception as e:
            logger.warning(f"Failed to remove from set {key}: {e}")
        return False
    
    def get_set_size(self, key: str) -> int:
        """Get set size"""
        try:
            client = self.get_client()
            if client:
                return client.scard(key)
        except Exception as e:
            logger.warning(f"Failed to get set size {key}: {e}")
        return 0
    
    def cleanup_expired_keys(self, pattern: str = "*") -> int:
        """Clean up expired keys matching pattern"""
        try:
            client = self.get_client()
            if client:
                keys = client.keys(pattern)
                if keys:
                    return client.delete(*keys)
        except Exception as e:
            logger.warning(f"Failed to cleanup expired keys {pattern}: {e}")
        return 0

# Global Redis configuration instance
_redis_config = None

def get_redis_config() -> RedisConfig:
    """Get global Redis configuration instance"""
    global _redis_config
    if _redis_config is None:
        _redis_config = RedisConfig()
    return _redis_config

def get_redis_client() -> Optional[redis.Redis]:
    """Get Redis client instance"""
    config = get_redis_config()
    return config.get_client()

def is_redis_available() -> bool:
    """Check if Redis is available"""
    config = get_redis_config()
    return config.is_available()
