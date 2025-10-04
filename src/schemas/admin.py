from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class UsageMetrics(BaseModel):
    total_requests: int
    total_tokens: int
    total_cost: float
    requests_today: int
    tokens_today: int
    cost_today: float
    requests_this_month: int
    tokens_this_month: int
    cost_this_month: float
    average_tokens_per_request: float
    most_used_model: str
    last_request_time: Optional[datetime] = None

class UserMonitorResponse(BaseModel):
    user_id: int
    api_key: str
    current_credits: int
    usage_metrics: UsageMetrics
    rate_limits: Dict[str, Any]

class AdminMonitorResponse(BaseModel):
    total_users: int
    active_users_today: int
    total_requests_today: int
    total_tokens_today: int
    total_cost_today: float
    system_usage_metrics: UsageMetrics
    top_users_by_usage: List[Dict[str, Any]]

class RateLimitConfig(BaseModel):
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    tokens_per_minute: int = 10000
    tokens_per_hour: int = 100000
    tokens_per_day: int = 1000000

class SetRateLimitRequest(BaseModel):
    api_key: str
    rate_limits: RateLimitConfig

class RateLimitResponse(BaseModel):
    api_key: str
    current_limits: RateLimitConfig
    current_usage: Dict[str, Any]
    reset_times: Dict[str, datetime]

class UsageRecord(BaseModel):
    user_id: int
    api_key: str
    model: str
    tokens_used: int
    cost: float
    timestamp: datetime
    request_id: str