#!/usr/bin/env python3
"""
Simplified Rate Limiting Module
Uses in-memory fallback system without Redis dependency
"""

import time
import asyncio
import logging
from typing import Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import defaultdict, deque
from functools import lru_cache
from rate_limiting_fallback import get_fallback_rate_limit_manager

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
    """Simplified rate limiter using fallback system"""
    
    def __init__(self):
        # Use fallback rate limiting system (no Redis)
        self.fallback_manager = get_fallback_rate_limit_manager()
        
    async def check_rate_limit(
        self, 
        api_key: str, 
        config: RateLimitConfig,
        tokens_used: int = 0,
        request_type: str = "api"
    ) -> RateLimitResult:
        """Check rate limit using fallback system"""
        try:
            # Use the fallback rate limiting system
            result = await self.fallback_manager.check_rate_limit(
                api_key=api_key,
                config=config,
                tokens_used=tokens_used,
                request_type=request_type
            )
            
            # Convert fallback result to our format
            return RateLimitResult(
                allowed=result.allowed,
                remaining_requests=result.remaining_requests,
                remaining_tokens=result.remaining_tokens,
                reset_time=datetime.fromtimestamp(result.reset_time) if result.reset_time else datetime.utcnow() + timedelta(minutes=1),
                retry_after=result.retry_after,
                reason=result.reason,
                burst_remaining=0,  # Not tracked in fallback system
                concurrency_remaining=0  # Not tracked in fallback system
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
    
    async def increment_request(self, api_key: str, config: RateLimitConfig, tokens_used: int = 0):
        """Increment request count (handled by fallback system)"""
        try:
            await self.fallback_manager.increment_request(
                api_key=api_key,
                config=config,
                tokens_used=tokens_used
            )
        except Exception as e:
            logger.error(f"Failed to increment request count for key {api_key[:10]}...: {e}")
    
    async def get_rate_limit_status(self, api_key: str, config: RateLimitConfig) -> Dict[str, Any]:
        """Get current rate limit status"""
        try:
            return await self.fallback_manager.get_rate_limit_status(api_key, config)
        except Exception as e:
            logger.error(f"Failed to get rate limit status for key {api_key[:10]}...: {e}")
            return {
                "requests_remaining": config.requests_per_minute,
                "tokens_remaining": config.tokens_per_minute,
                "reset_time": int((datetime.utcnow() + timedelta(minutes=1)).timestamp())
            }

# Global rate limiter instance
_rate_limiter = None

@lru_cache(maxsize=1)
def get_rate_limiter() -> SlidingWindowRateLimiter:
    """Get global rate limiter instance"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = SlidingWindowRateLimiter()
    return _rate_limiter

# Convenience functions
async def check_rate_limit(api_key: str, config: RateLimitConfig, tokens_used: int = 0) -> RateLimitResult:
    """Check rate limit for API key"""
    limiter = get_rate_limiter()
    return await limiter.check_rate_limit(api_key, config, tokens_used)

async def increment_request(api_key: str, config: RateLimitConfig, tokens_used: int = 0):
    """Increment request count for API key"""
    limiter = get_rate_limiter()
    await limiter.increment_request(api_key, config, tokens_used)

async def get_rate_limit_status(api_key: str, config: RateLimitConfig) -> Dict[str, Any]:
    """Get rate limit status for API key"""
    limiter = get_rate_limiter()
    return await limiter.get_rate_limit_status(api_key, config)

# Default configurations
DEFAULT_CONFIG = RateLimitConfig(
    requests_per_minute=60,
    requests_per_hour=1000,
    requests_per_day=10000,
    tokens_per_minute=10000,
    tokens_per_hour=100000,
    tokens_per_day=1000000,
    burst_limit=10,
    concurrency_limit=5
)

PREMIUM_CONFIG = RateLimitConfig(
    requests_per_minute=300,
    requests_per_hour=5000,
    requests_per_day=50000,
    tokens_per_minute=50000,
    tokens_per_hour=500000,
    tokens_per_day=5000000,
    burst_limit=50,
    concurrency_limit=20
)

ENTERPRISE_CONFIG = RateLimitConfig(
    requests_per_minute=1000,
    requests_per_hour=20000,
    requests_per_day=200000,
    tokens_per_minute=200000,
    tokens_per_hour=2000000,
    tokens_per_day=20000000,
    burst_limit=100,
    concurrency_limit=50
)