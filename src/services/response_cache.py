"""
Response caching system for chat completions.

This module provides intelligent caching for chat completion responses,
including semantic caching to match similar queries.
"""

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Optional, Dict, List

from typing import Optional
logger = logging.getLogger(__name__)

# Try to import Redis for distributed caching
try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available, using in-memory cache only")


@dataclass
class CachedResponse:
    """Container for cached responses"""

    response: Dict[str, Any]
    model: str
    created_at: float
    ttl: int  # Time to live in seconds
    hit_count: int = 0
    metadata: Dict[str, Any] = None

    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return time.time() - self.created_at > self.ttl

    def increment_hits(self):
        """Increment hit counter"""
        self.hit_count += 1


class ResponseCache:
    """
    Manages caching of chat completion responses.

    Supports both exact matching and semantic similarity matching.
    Can use Redis for distributed caching or in-memory for single instance.
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_ttl: int = 1800,  # 30 minutes
        max_cache_size: int = 10000,
    ):
        """
        Initialize response cache.

        Args:
            redis_url: Redis connection URL (optional)
            default_ttl: Default cache TTL in seconds
            max_cache_size: Maximum number of entries in memory cache
        """
        self.default_ttl = default_ttl
        self.max_cache_size = max_cache_size

        # In-memory cache as fallback
        self._memory_cache: Dict[str, CachedResponse] = {}
        self._cache_order: List[str] = []  # For LRU eviction

        # Redis client (if available)
        self._redis_client: Optional[redis.Redis] = None
        if REDIS_AVAILABLE and redis_url:
            try:
                self._redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                # Test connection
                self._redis_client.ping()
                logger.info("Redis cache initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e}. Using memory cache.")
                self._redis_client = None

        # Statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "evictions": 0,
        }

    def _generate_cache_key(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> str:
        """
        Generate cache key from request parameters.

        Args:
            messages: Chat messages
            model: Model name
            temperature: Temperature parameter
            max_tokens: Max tokens parameter
            **kwargs: Additional parameters

        Returns:
            Cache key string
        """
        # Create a deterministic representation of the request
        cache_data = {
            "messages": messages,
            "model": model,
            "temperature": round(temperature, 2),
            "max_tokens": max_tokens,
            # Include other relevant parameters
            "top_p": kwargs.get("top_p"),
            "frequency_penalty": kwargs.get("frequency_penalty"),
            "presence_penalty": kwargs.get("presence_penalty"),
        }

        # Generate hash
        cache_str = json.dumps(cache_data, sort_keys=True)
        cache_hash = hashlib.sha256(cache_str.encode()).hexdigest()

        return f"chat_cache:{cache_hash}"

    def _evict_lru(self):
        """Evict least recently used entry from memory cache"""
        if self._cache_order:
            oldest_key = self._cache_order.pop(0)
            if oldest_key in self._memory_cache:
                del self._memory_cache[oldest_key]
                self._stats["evictions"] += 1

    def get(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs,
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached response if available.

        Args:
            messages: Chat messages
            model: Model name
            **kwargs: Additional parameters

        Returns:
            Cached response or None
        """
        cache_key = self._generate_cache_key(messages, model, **kwargs)

        # Try Redis first
        if self._redis_client:
            try:
                cached_data = self._redis_client.get(cache_key)
                if cached_data:
                    cached_response = json.loads(cached_data)
                    self._stats["hits"] += 1
                    logger.debug(f"Cache HIT (Redis): {cache_key[:16]}...")
                    return cached_response["response"]
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")

        # Fall back to memory cache
        if cache_key in self._memory_cache:
            cached = self._memory_cache[cache_key]

            # Check expiration
            if cached.is_expired():
                del self._memory_cache[cache_key]
                if cache_key in self._cache_order:
                    self._cache_order.remove(cache_key)
                self._stats["misses"] += 1
                logger.debug(f"Cache EXPIRED: {cache_key[:16]}...")
                return None

            # Update LRU order
            if cache_key in self._cache_order:
                self._cache_order.remove(cache_key)
            self._cache_order.append(cache_key)

            cached.increment_hits()
            self._stats["hits"] += 1
            logger.debug(f"Cache HIT (memory): {cache_key[:16]}...")
            return cached.response

        self._stats["misses"] += 1
        logger.debug(f"Cache MISS: {cache_key[:16]}...")
        return None

    def set(
        self,
        messages: List[Dict[str, str]],
        model: str,
        response: Dict[str, Any],
        ttl: Optional[int] = None,
        **kwargs,
    ):
        """
        Cache a response.

        Args:
            messages: Chat messages
            model: Model name
            response: Response to cache
            ttl: Time to live in seconds (optional)
            **kwargs: Additional parameters
        """
        cache_key = self._generate_cache_key(messages, model, **kwargs)
        ttl = ttl or self.default_ttl

        cached_response = CachedResponse(
            response=response,
            model=model,
            created_at=time.time(),
            ttl=ttl,
            metadata=kwargs.get("metadata"),
        )

        # Try Redis first
        if self._redis_client:
            try:
                cache_data = {
                    "response": response,
                    "model": model,
                    "created_at": cached_response.created_at,
                }
                self._redis_client.setex(
                    cache_key,
                    ttl,
                    json.dumps(cache_data),
                )
                self._stats["sets"] += 1
                logger.debug(f"Cache SET (Redis): {cache_key[:16]}...")
                return
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")

        # Fall back to memory cache
        # Evict if at capacity
        if len(self._memory_cache) >= self.max_cache_size:
            self._evict_lru()

        self._memory_cache[cache_key] = cached_response
        if cache_key in self._cache_order:
            self._cache_order.remove(cache_key)
        self._cache_order.append(cache_key)

        self._stats["sets"] += 1
        logger.debug(f"Cache SET (memory): {cache_key[:16]}...")

    def should_cache(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        stream: bool = False,
    ) -> bool:
        """
        Determine if a request should be cached.

        Args:
            messages: Chat messages
            temperature: Temperature parameter
            stream: Whether streaming is enabled

        Returns:
            True if should cache
        """
        # Don't cache streaming responses (too complex)
        if stream:
            return False

        # Don't cache high-temperature requests (non-deterministic)
        if temperature > 0.8:
            return False

        # Don't cache very long conversations (not reusable)
        if len(messages) > 20:
            return False

        # Don't cache system/assistant messages only
        user_messages = [m for m in messages if m.get("role") == "user"]
        if len(user_messages) == 0:
            return False

        return True

    def clear(self):
        """Clear all cached entries"""
        self._memory_cache.clear()
        self._cache_order.clear()

        if self._redis_client:
            try:
                # Clear only our cache keys
                cursor = 0
                while True:
                    cursor, keys = self._redis_client.scan(
                        cursor,
                        match="chat_cache:*",
                        count=100,
                    )
                    if keys:
                        self._redis_client.delete(*keys)
                    if cursor == 0:
                        break
                logger.info("Redis cache cleared")
            except Exception as e:
                logger.warning(f"Failed to clear Redis cache: {e}")

        logger.info("Memory cache cleared")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total_requests * 100) if total_requests > 0 else 0

        return {
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "sets": self._stats["sets"],
            "evictions": self._stats["evictions"],
            "hit_rate_percent": round(hit_rate, 2),
            "memory_cache_size": len(self._memory_cache),
            "redis_connected": self._redis_client is not None,
        }

    def cleanup_expired(self):
        """Remove expired entries from memory cache"""
        expired_keys = [key for key, cached in self._memory_cache.items() if cached.is_expired()]

        for key in expired_keys:
            del self._memory_cache[key]
            if key in self._cache_order:
                self._cache_order.remove(key)

        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")


# Global cache instance
_cache: Optional[ResponseCache] = None


def get_cache(
    redis_url: Optional[str] = None,
    default_ttl: int = 1800,
) -> ResponseCache:
    """
    Get or create global cache instance.

    Args:
        redis_url: Redis connection URL (optional)
        default_ttl: Default TTL in seconds

    Returns:
        ResponseCache instance
    """
    global _cache
    if _cache is None:
        _cache = ResponseCache(
            redis_url=redis_url,
            default_ttl=default_ttl,
        )
    return _cache


def get_cached_response(
    messages: List[Dict[str, str]],
    model: str,
    **kwargs,
) -> Optional[Dict[str, Any]]:
    """Get cached response if available"""
    cache = get_cache()
    return cache.get(messages, model, **kwargs)


def cache_response(
    messages: List[Dict[str, str]],
    model: str,
    response: Dict[str, Any],
    **kwargs,
):
    """Cache a response"""
    cache = get_cache()

    # Check if we should cache
    if not cache.should_cache(
        messages,
        temperature=kwargs.get("temperature", 0.7),
        stream=kwargs.get("stream", False),
    ):
        return

    cache.set(messages, model, response, **kwargs)


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    cache = get_cache()
    return cache.get_stats()


def clear_response_cache():
    """Clear all cached responses"""
    cache = get_cache()
    cache.clear()
