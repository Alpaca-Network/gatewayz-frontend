#!/usr/bin/env python3
"""
Advanced Rate Limiting Module
Implements sliding-window rate limiting, burst controls, and configurable limits per key.
"""

import time
import asyncio
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import defaultdict, deque
import json
import redis
from functools import lru_cache
from redis_config import get_redis_client, is_redis_available

logger = logging.getLogger(__name__)

@dataclass
class RateLimitConfig:
    """Rate limit configuration for a specific key"""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    tokens_per_minute: int = 10000
    tokens_per_hour: int = 100000
    tokens_per_day: int = 1000000
    burst_limit: int = 10  # Maximum burst requests
    concurrency_limit: int = 5  # Maximum concurrent requests
    window_size_seconds: int = 60  # Sliding window size

@dataclass
class RateLimitResult:
    """Result of rate limit check"""
    allowed: bool
    remaining_requests: int
    remaining_tokens: int
    reset_time: datetime
    retry_after: Optional[int] = None
    reason: Optional[str] = None
    burst_remaining: int = 0
    concurrency_remaining: int = 0

class SlidingWindowRateLimiter:
    """Sliding window rate limiter with burst and concurrency controls"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client or get_redis_client()
        self.local_cache = {}  # Fallback for when Redis is unavailable
        self.concurrent_requests = defaultdict(int)  # Track concurrent requests per key
        self.burst_tokens = defaultdict(int)  # Track burst tokens per key
        
    async def check_rate_limit(
        self, 
        api_key: str, 
        config: RateLimitConfig,
        tokens_used: int = 0,
        request_type: str = "api"
    ) -> RateLimitResult:
        """Check rate limit with sliding window algorithm"""
        try:
            # Check concurrency limit first
            concurrency_check = await self._check_concurrency_limit(api_key, config)
            if not concurrency_check["allowed"]:
                return RateLimitResult(
                    allowed=False,
                    remaining_requests=0,
                    remaining_tokens=0,
                    reset_time=datetime.utcnow() + timedelta(seconds=60),
                    retry_after=60,
                    reason="Concurrency limit exceeded",
                    concurrency_remaining=0
                )
            
            # Check burst limit
            burst_check = await self._check_burst_limit(api_key, config)
            if not burst_check["allowed"]:
                return RateLimitResult(
                    allowed=False,
                    remaining_requests=0,
                    remaining_tokens=0,
                    reset_time=datetime.utcnow() + timedelta(seconds=burst_check["retry_after"]),
                    retry_after=burst_check["retry_after"],
                    reason="Burst limit exceeded",
                    burst_remaining=burst_check["remaining"]
                )
            
            # Check sliding window limits
            window_check = await self._check_sliding_window(api_key, config, tokens_used)
            if not window_check["allowed"]:
                return RateLimitResult(
                    allowed=False,
                    remaining_requests=window_check["remaining_requests"],
                    remaining_tokens=window_check["remaining_tokens"],
                    reset_time=window_check["reset_time"],
                    retry_after=window_check["retry_after"],
                    reason=window_check["reason"],
                    burst_remaining=burst_check["remaining"],
                    concurrency_remaining=concurrency_check["remaining"]
                )
            
            # All checks passed
            return RateLimitResult(
                allowed=True,
                remaining_requests=window_check["remaining_requests"],
                remaining_tokens=window_check["remaining_tokens"],
                reset_time=window_check["reset_time"],
                burst_remaining=burst_check["remaining"],
                concurrency_remaining=concurrency_check["remaining"]
            )
            
        except Exception as e:
            logger.error(f"Rate limit check failed for key {api_key[:10]}...: {e}")
            # Fail open - allow request if rate limiting fails
            return RateLimitResult(
                allowed=True,
                remaining_requests=config.requests_per_minute,
                remaining_tokens=config.tokens_per_minute,
                reset_time=datetime.utcnow() + timedelta(minutes=1),
                reason="Rate limit check failed, allowing request"
            )
    
    async def _check_concurrency_limit(self, api_key: str, config: RateLimitConfig) -> Dict[str, Any]:
        """Check concurrent request limit"""
        current_concurrent = self.concurrent_requests.get(api_key, 0)
        
        if current_concurrent >= config.concurrency_limit:
            return {
                "allowed": False,
                "remaining": 0,
                "current": current_concurrent,
                "limit": config.concurrency_limit
            }
        
        return {
            "allowed": True,
            "remaining": config.concurrency_limit - current_concurrent,
            "current": current_concurrent,
            "limit": config.concurrency_limit
        }
    
    async def _check_burst_limit(self, api_key: str, config: RateLimitConfig) -> Dict[str, Any]:
        """Check burst limit using token bucket algorithm"""
        now = time.time()
        key = f"burst:{api_key}"
        
        if self.redis_client:
            # Use Redis for distributed burst limiting
            pipe = self.redis_client.pipeline()
            
            # Get current burst tokens
            pipe.hget(key, "tokens")
            pipe.hget(key, "last_refill")
            
            results = pipe.execute()
            current_tokens = float(results[0] or 0)
            last_refill = float(results[1] or now)
            
            # Refill tokens based on time passed
            time_passed = now - last_refill
            tokens_to_add = time_passed * (config.burst_limit / 60)  # Refill rate per second
            current_tokens = min(config.burst_limit, current_tokens + tokens_to_add)
            
            if current_tokens >= 1:
                # Consume one token
                pipe.hset(key, "tokens", current_tokens - 1)
                pipe.hset(key, "last_refill", now)
                pipe.expire(key, 300)  # Expire after 5 minutes
                pipe.execute()
                
                return {
                    "allowed": True,
                    "remaining": int(current_tokens - 1),
                    "current": int(current_tokens - 1),
                    "limit": config.burst_limit
                }
            else:
                return {
                    "allowed": False,
                    "remaining": 0,
                    "current": int(current_tokens),
                    "limit": config.burst_limit,
                    "retry_after": int((1 - current_tokens) * 60 / config.burst_limit)
                }
        else:
            # Fallback to local cache
            if api_key not in self.burst_tokens:
                self.burst_tokens[api_key] = config.burst_limit
            
            if self.burst_tokens[api_key] >= 1:
                self.burst_tokens[api_key] -= 1
                return {
                    "allowed": True,
                    "remaining": int(self.burst_tokens[api_key]),
                    "current": int(self.burst_tokens[api_key]),
                    "limit": config.burst_limit
                }
            else:
                return {
                    "allowed": False,
                    "remaining": 0,
                    "current": int(self.burst_tokens[api_key]),
                    "limit": config.burst_limit,
                    "retry_after": 60
                }
    
    async def _check_sliding_window(self, api_key: str, config: RateLimitConfig, tokens_used: int) -> Dict[str, Any]:
        """Check sliding window rate limits"""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=config.window_size_seconds)
        
        if self.redis_client:
            # Use Redis for distributed rate limiting
            return await self._check_redis_sliding_window(api_key, config, tokens_used, now, window_start)
        else:
            # Fallback to local cache
            return await self._check_local_sliding_window(api_key, config, tokens_used, now, window_start)
    
    async def _check_redis_sliding_window(
        self, 
        api_key: str, 
        config: RateLimitConfig, 
        tokens_used: int, 
        now: datetime, 
        window_start: datetime
    ) -> Dict[str, Any]:
        """Check sliding window using Redis"""
        pipe = self.redis_client.pipeline()
        
        # Get current usage for different time windows
        minute_key = f"rate_limit:{api_key}:minute:{now.strftime('%Y%m%d%H%M')}"
        hour_key = f"rate_limit:{api_key}:hour:{now.strftime('%Y%m%d%H')}"
        day_key = f"rate_limit:{api_key}:day:{now.strftime('%Y%m%d')}"
        
        # Get current counts
        pipe.get(f"{minute_key}:requests")
        pipe.get(f"{minute_key}:tokens")
        pipe.get(f"{hour_key}:requests")
        pipe.get(f"{hour_key}:tokens")
        pipe.get(f"{day_key}:requests")
        pipe.get(f"{day_key}:tokens")
        
        results = pipe.execute()
        
        minute_requests = int(results[0] or 0)
        minute_tokens = int(results[1] or 0)
        hour_requests = int(results[2] or 0)
        hour_tokens = int(results[3] or 0)
        day_requests = int(results[4] or 0)
        day_tokens = int(results[5] or 0)
        
        # Check limits
        if minute_requests >= config.requests_per_minute:
            return {
                "allowed": False,
                "remaining_requests": 0,
                "remaining_tokens": 0,
                "reset_time": now.replace(second=0, microsecond=0) + timedelta(minutes=1),
                "retry_after": 60,
                "reason": "Minute request limit exceeded"
            }
        
        if minute_tokens + tokens_used > config.tokens_per_minute:
            return {
                "allowed": False,
                "remaining_requests": config.requests_per_minute - minute_requests,
                "remaining_tokens": 0,
                "reset_time": now.replace(second=0, microsecond=0) + timedelta(minutes=1),
                "retry_after": 60,
                "reason": "Minute token limit exceeded"
            }
        
        if hour_requests >= config.requests_per_hour:
            return {
                "allowed": False,
                "remaining_requests": 0,
                "remaining_tokens": 0,
                "reset_time": now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1),
                "retry_after": 3600,
                "reason": "Hour request limit exceeded"
            }
        
        if hour_tokens + tokens_used > config.tokens_per_hour:
            return {
                "allowed": False,
                "remaining_requests": config.requests_per_hour - hour_requests,
                "remaining_tokens": 0,
                "reset_time": now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1),
                "retry_after": 3600,
                "reason": "Hour token limit exceeded"
            }
        
        if day_requests >= config.requests_per_day:
            return {
                "allowed": False,
                "remaining_requests": 0,
                "remaining_tokens": 0,
                "reset_time": now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1),
                "retry_after": 86400,
                "reason": "Day request limit exceeded"
            }
        
        if day_tokens + tokens_used > config.tokens_per_day:
            return {
                "allowed": False,
                "remaining_requests": config.requests_per_day - day_requests,
                "remaining_tokens": 0,
                "reset_time": now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1),
                "retry_after": 86400,
                "reason": "Day token limit exceeded"
            }
        
        # All checks passed, update counters
        pipe.incr(f"{minute_key}:requests")
        pipe.incrby(f"{minute_key}:tokens", tokens_used)
        pipe.incr(f"{hour_key}:requests")
        pipe.incrby(f"{hour_key}:tokens", tokens_used)
        pipe.incr(f"{day_key}:requests")
        pipe.incrby(f"{day_key}:tokens", tokens_used)
        
        # Set expiration times
        pipe.expire(f"{minute_key}:requests", 120)  # 2 minutes
        pipe.expire(f"{minute_key}:tokens", 120)
        pipe.expire(f"{hour_key}:requests", 7200)   # 2 hours
        pipe.expire(f"{hour_key}:tokens", 7200)
        pipe.expire(f"{day_key}:requests", 172800)  # 2 days
        pipe.expire(f"{day_key}:tokens", 172800)
        
        pipe.execute()
        
        return {
            "allowed": True,
            "remaining_requests": config.requests_per_minute - minute_requests - 1,
            "remaining_tokens": config.tokens_per_minute - minute_tokens - tokens_used,
            "reset_time": now.replace(second=0, microsecond=0) + timedelta(minutes=1)
        }
    
    async def _check_local_sliding_window(
        self, 
        api_key: str, 
        config: RateLimitConfig, 
        tokens_used: int, 
        now: datetime, 
        window_start: datetime
    ) -> Dict[str, Any]:
        """Check sliding window using local cache (fallback)"""
        if api_key not in self.local_cache:
            self.local_cache[api_key] = {
                "requests": deque(),
                "tokens": deque()
            }
        
        cache = self.local_cache[api_key]
        
        # Clean old entries
        while cache["requests"] and cache["requests"][0] < window_start:
            cache["requests"].popleft()
        while cache["tokens"] and cache["tokens"][0] < window_start:
            cache["tokens"].popleft()
        
        # Check limits
        current_requests = len(cache["requests"])
        current_tokens = sum(cache["tokens"])
        
        if current_requests >= config.requests_per_minute:
            return {
                "allowed": False,
                "remaining_requests": 0,
                "remaining_tokens": 0,
                "reset_time": now.replace(second=0, microsecond=0) + timedelta(minutes=1),
                "retry_after": 60,
                "reason": "Minute request limit exceeded"
            }
        
        if current_tokens + tokens_used > config.tokens_per_minute:
            return {
                "allowed": False,
                "remaining_requests": config.requests_per_minute - current_requests,
                "remaining_tokens": 0,
                "reset_time": now.replace(second=0, microsecond=0) + timedelta(minutes=1),
                "retry_after": 60,
                "reason": "Minute token limit exceeded"
            }
        
        # Add current request
        cache["requests"].append(now)
        cache["tokens"].append(tokens_used)
        
        return {
            "allowed": True,
            "remaining_requests": config.requests_per_minute - current_requests - 1,
            "remaining_tokens": config.tokens_per_minute - current_tokens - tokens_used,
            "reset_time": now.replace(second=0, microsecond=0) + timedelta(minutes=1)
        }
    
    async def increment_concurrent_requests(self, api_key: str):
        """Increment concurrent request counter"""
        self.concurrent_requests[api_key] += 1
    
    async def decrement_concurrent_requests(self, api_key: str):
        """Decrement concurrent request counter"""
        if api_key in self.concurrent_requests:
            self.concurrent_requests[api_key] = max(0, self.concurrent_requests[api_key] - 1)

class RateLimitManager:
    """Manager for rate limiting with per-key configuration"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.rate_limiter = SlidingWindowRateLimiter(redis_client)
        self.key_configs = {}  # Cache for per-key configurations
        self.default_config = RateLimitConfig()
    
    async def get_key_config(self, api_key: str) -> RateLimitConfig:
        """Get rate limit configuration for a specific API key"""
        if api_key in self.key_configs:
            return self.key_configs[api_key]
        
        # Load from database
        config = await self._load_key_config_from_db(api_key)
        self.key_configs[api_key] = config
        return config
    
    async def _load_key_config_from_db(self, api_key: str) -> RateLimitConfig:
        """Load rate limit configuration from database"""
        try:
            # Import here to avoid circular imports
            from db import get_rate_limit_config
            
            config_data = get_rate_limit_config(api_key)
            if config_data:
                return RateLimitConfig(
                    requests_per_minute=config_data.get('requests_per_minute', 60),
                    requests_per_hour=config_data.get('requests_per_hour', 1000),
                    requests_per_day=config_data.get('requests_per_day', 10000),
                    tokens_per_minute=config_data.get('tokens_per_minute', 10000),
                    tokens_per_hour=config_data.get('tokens_per_hour', 100000),
                    tokens_per_day=config_data.get('tokens_per_day', 1000000),
                    burst_limit=config_data.get('burst_limit', 10),
                    concurrency_limit=config_data.get('concurrency_limit', 5),
                    window_size_seconds=config_data.get('window_size_seconds', 60)
                )
        except Exception as e:
            logger.error(f"Failed to load rate limit config for key {api_key[:10]}...: {e}")
        
        return self.default_config
    
    async def check_rate_limit(
        self, 
        api_key: str, 
        tokens_used: int = 0,
        request_type: str = "api"
    ) -> RateLimitResult:
        """Check rate limit for a specific API key"""
        config = await self.get_key_config(api_key)
        return await self.rate_limiter.check_rate_limit(api_key, config, tokens_used, request_type)
    
    async def update_key_config(self, api_key: str, config: RateLimitConfig):
        """Update rate limit configuration for a specific key"""
        self.key_configs[api_key] = config
        # Also update in database
        await self._save_key_config_to_db(api_key, config)
    
    async def _save_key_config_to_db(self, api_key: str, config: RateLimitConfig):
        """Save rate limit configuration to database"""
        try:
            from db import update_rate_limit_config
            
            config_dict = {
                'requests_per_minute': config.requests_per_minute,
                'requests_per_hour': config.requests_per_hour,
                'requests_per_day': config.requests_per_day,
                'tokens_per_minute': config.tokens_per_minute,
                'tokens_per_hour': config.tokens_per_hour,
                'tokens_per_day': config.tokens_per_day,
                'burst_limit': config.burst_limit,
                'concurrency_limit': config.concurrency_limit,
                'window_size_seconds': config.window_size_seconds
            }
            
            update_rate_limit_config(api_key, config_dict)
        except Exception as e:
            logger.error(f"Failed to save rate limit config for key {api_key[:10]}...: {e}")

# Global rate limit manager instance
_rate_limit_manager = None

def get_rate_limit_manager() -> RateLimitManager:
    """Get global rate limit manager instance"""
    global _rate_limit_manager
    if _rate_limit_manager is None:
        _rate_limit_manager = RateLimitManager()
    return _rate_limit_manager
