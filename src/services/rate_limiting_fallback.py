#!/usr/bin/.env python3
"""
Fallback Rate Limiting System
Works without Redis using in-memory storage
"""

import time
import asyncio
from collections import defaultdict, deque
from typing import Optional
from dataclasses import dataclass
import logging

from src.db.rate_limits import get_rate_limit_config, update_rate_limit_config

logger = logging.getLogger(__name__)

@dataclass
class RateLimitConfig:
    """Rate limit configuration"""
    requests_per_minute: int = 250
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    tokens_per_minute: int = 10000
    tokens_per_hour: int = 100000
    tokens_per_day: int = 500000
    burst_limit: int = 500
    concurrency_limit: int = 50  # Updated from 5 to 50
    window_size_seconds: int = 60

@dataclass
class RateLimitResult:
    """Rate limit check result"""
    allowed: bool
    reason: Optional[str] = None
    retry_after: Optional[int] = None
    remaining_requests: int = 0
    remaining_tokens: int = 0
    reset_time: Optional[int] = None

class InMemoryRateLimiter:
    """In-memory rate limiter with sliding window algorithm"""
    
    def __init__(self):
        self.request_windows = defaultdict(lambda: deque())
        self.token_windows = defaultdict(lambda: deque())
        self.concurrent_requests = defaultdict(int)
        self.burst_tokens = defaultdict(int)
        self.last_burst_refill = defaultdict(float)
        self.lock = asyncio.Lock()
    
    async def check_rate_limit(self, api_key: str, config: RateLimitConfig, 
                             tokens_used: int = 0, request_type: str = 'api') -> RateLimitResult:
        """Check rate limit for API key"""
        async with self.lock:
            current_time = time.time()
            
            # Clean up old entries
            await self._cleanup_old_entries(api_key, current_time)
            
            # Check concurrency limit - TEMPORARILY DISABLED
            # TODO: Re-enable after confirming router-side limiting works
            # if self.concurrent_requests[api_key] >= config.concurrency_limit:
            #     return RateLimitResult(
            #         allowed=False,
            #         reason="Concurrency limit exceeded",
            #         retry_after=1,
            #         remaining_requests=0,
            #         remaining_tokens=0
            #     )
            
            # Check burst limit
            burst_allowed = await self._check_burst_limit(api_key, config, current_time)
            if not burst_allowed:
                return RateLimitResult(
                    allowed=False,
                    reason="Burst limit exceeded",
                    retry_after=1,
                    remaining_requests=0,
                    remaining_tokens=0
                )
            
            # Check request rate limits
            request_result = await self._check_request_limits(api_key, config, current_time)
            if not request_result.allowed:
                return request_result
            
            # Check token rate limits
            token_result = await self._check_token_limits(api_key, config, tokens_used, current_time)
            if not token_result.allowed:
                return token_result
            
            # All checks passed - increment counters
            self.request_windows[api_key].append(current_time)
            self.token_windows[api_key].append((current_time, tokens_used))
            self.concurrent_requests[api_key] += 1
            
            # Calculate remaining limits
            remaining_requests = max(0, config.requests_per_minute - len(self.request_windows[api_key]))
            remaining_tokens = max(0, config.tokens_per_minute - sum(t for _, t in self.token_windows[api_key]))
            
            return RateLimitResult(
                allowed=True,
                remaining_requests=remaining_requests,
                remaining_tokens=remaining_tokens,
                reset_time=int(current_time + config.window_size_seconds)
            )
    
    async def release_concurrent_request(self, api_key: str):
        """Release a concurrent request"""
        async with self.lock:
            if self.concurrent_requests[api_key] > 0:
                self.concurrent_requests[api_key] -= 1
    
    async def _cleanup_old_entries(self, api_key: str, current_time: float):
        """Clean up old entries from sliding windows"""
        window_size = 60  # 1 minute window
        
        # Clean request window
        while (self.request_windows[api_key] and 
               current_time - self.request_windows[api_key][0] > window_size):
            self.request_windows[api_key].popleft()
        
        # Clean token window
        while (self.token_windows[api_key] and 
               current_time - self.token_windows[api_key][0][0] > window_size):
            self.token_windows[api_key].popleft()
    
    async def _check_burst_limit(self, api_key: str, config: RateLimitConfig, current_time: float) -> bool:
        """Check burst limit using token bucket algorithm"""
        # Refill burst tokens
        time_since_refill = current_time - self.last_burst_refill[api_key]
        if time_since_refill >= 1.0:  # Refill every second
            refill_amount = min(config.burst_limit, 
                              int(time_since_refill * config.burst_limit / 60))  # Refill rate
            self.burst_tokens[api_key] = min(config.burst_limit, 
                                           self.burst_tokens[api_key] + refill_amount)
            self.last_burst_refill[api_key] = current_time
        
        # Check if we have tokens available
        if self.burst_tokens[api_key] > 0:
            self.burst_tokens[api_key] -= 1
            return True
        
        return False
    
    async def _check_request_limits(self, api_key: str, config: RateLimitConfig, 
                                  current_time: float) -> RateLimitResult:
        """Check request rate limits"""
        current_requests = len(self.request_windows[api_key])
        
        if current_requests >= config.requests_per_minute:
            return RateLimitResult(
                allowed=False,
                reason="Request rate limit exceeded",
                retry_after=60,
                remaining_requests=0
            )
        
        return RateLimitResult(allowed=True)
    
    async def _check_token_limits(self, api_key: str, config: RateLimitConfig, 
                                tokens_used: int, current_time: float) -> RateLimitResult:
        """Check token rate limits"""
        current_tokens = sum(t for _, t in self.token_windows[api_key])
        
        if current_tokens + tokens_used > config.tokens_per_minute:
            return RateLimitResult(
                allowed=False,
                reason="Token rate limit exceeded",
                retry_after=60,
                remaining_tokens=0
            )
        
        return RateLimitResult(allowed=True)

class FallbackRateLimitManager:
    """Fallback rate limit manager that works without Redis"""
    
    def __init__(self):
        self.rate_limiter = InMemoryRateLimiter()
        self.key_configs = {}
        self.default_config = RateLimitConfig()
    
    async def get_key_config(self, api_key: str) -> RateLimitConfig:
        """Get rate limit configuration for API key"""
        if api_key not in self.key_configs:
            # Try to load from database
            config = await self._load_key_config_from_db(api_key)
            if config:
                self.key_configs[api_key] = config
            else:
                self.key_configs[api_key] = self.default_config
        
        return self.key_configs[api_key]
    
    async def check_rate_limit(self, api_key: str, tokens_used: int = 0, 
                             request_type: str = 'api') -> RateLimitResult:
        """Check rate limit for API key"""
        config = await self.get_key_config(api_key)
        return await self.rate_limiter.check_rate_limit(api_key, config, tokens_used, request_type)
    
    async def release_concurrent_request(self, api_key: str):
        """Release a concurrent request"""
        await self.rate_limiter.release_concurrent_request(api_key)
    
    async def _load_key_config_from_db(self, api_key: str) -> Optional[RateLimitConfig]:
        """Load rate limit configuration from database"""
        try:
            config_data = get_rate_limit_config(api_key)
            if config_data:
                return RateLimitConfig(**config_data)
        except Exception as e:
            logger.warning(f"Failed to load rate limit config from DB: {e}")
        return None
    
    async def update_key_config(self, api_key: str, config: RateLimitConfig):
        """Update rate limit configuration for API key"""
        self.key_configs[api_key] = config
        try:
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
            logger.warning(f"Failed to save rate limit config to DB: {e}")

# Global fallback manager
_fallback_manager = None

def get_fallback_rate_limit_manager() -> FallbackRateLimitManager:
    """Get fallback rate limit manager instance"""
    global _fallback_manager
    if _fallback_manager is None:
        _fallback_manager = FallbackRateLimitManager()
    return _fallback_manager
