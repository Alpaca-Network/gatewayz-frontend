#!/usr/bin/env python3
"""
Trial Management Models
Pydantic models for free trial and subscription management
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class SubscriptionStatus(str, Enum):
    """Subscription status enumeration"""
    TRIAL = "trial"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"

class PlanType(str, Enum):
    """Plan type enumeration"""
    FREE = "free"
    DEV = "dev"
    TEAM = "team"
    CUSTOMIZE = "customize"

class SubscriptionPlan(BaseModel):
    """Subscription plan model"""
    id: Optional[int] = None
    plan_name: str
    plan_type: PlanType
    description: str = ""
    monthly_price: float = 0.0
    yearly_price: Optional[float] = None
    daily_request_limit: int = 1000
    monthly_request_limit: int = 1000
    daily_token_limit: int = 100000
    monthly_token_limit: int = 100000
    max_concurrent_requests: int = 5
    price_per_token: Optional[float] = None  # For pay-as-you-go plans
    features: List[str] = Field(default_factory=list)
    is_active: bool = True
    is_pay_as_you_go: bool = False  # For Customize plan
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class TrialStatus(BaseModel):
    """Trial status model"""
    is_trial: bool
    trial_start_date: Optional[datetime] = None
    trial_end_date: Optional[datetime] = None
    trial_used_tokens: int = 0
    trial_used_requests: int = 0
    trial_max_tokens: int = 100000
    trial_max_requests: int = 1000
    trial_credits: float = 10.00
    trial_used_credits: float = 0.00
    trial_converted: bool = False
    subscription_status: SubscriptionStatus = SubscriptionStatus.TRIAL
    subscription_plan: str = "free_trial"
    trial_active: bool = False
    trial_expired: bool = False
    trial_remaining_tokens: int = 0
    trial_remaining_requests: int = 0
    trial_remaining_credits: float = 10.00

class TrialUsage(BaseModel):
    """Trial usage tracking model"""
    id: Optional[int] = None
    api_key_id: int
    usage_date: datetime
    requests_used: int = 0
    tokens_used: int = 0
    created_at: Optional[datetime] = None

class SubscriptionHistory(BaseModel):
    """Subscription history model"""
    id: Optional[int] = None
    api_key_id: int
    plan_name: str
    status: SubscriptionStatus
    start_date: datetime
    end_date: Optional[datetime] = None
    price_paid: float = 0.0
    payment_method: Optional[str] = None
    created_at: Optional[datetime] = None

class TrialConversion(BaseModel):
    """Trial conversion tracking model"""
    id: Optional[int] = None
    api_key_id: int
    trial_start_date: datetime
    trial_end_date: datetime
    conversion_date: Optional[datetime] = None
    converted_plan: Optional[str] = None
    conversion_revenue: float = 0.0
    created_at: Optional[datetime] = None

class StartTrialRequest(BaseModel):
    """Request to start a trial"""
    api_key: str
    trial_days: int = Field(default=3, ge=1, le=30)

class StartTrialResponse(BaseModel):
    """Response for starting a trial"""
    success: bool
    trial_start_date: datetime
    trial_end_date: datetime
    trial_days: int
    max_tokens: int
    max_requests: int
    trial_credits: float
    message: str

class ConvertTrialRequest(BaseModel):
    """Request to convert trial to paid"""
    api_key: str
    plan_name: str

class ConvertTrialResponse(BaseModel):
    """Response for converting trial to paid"""
    success: bool
    converted_plan: str
    conversion_date: datetime
    monthly_price: float
    subscription_end_date: datetime
    message: str

class TrialStatusResponse(BaseModel):
    """Response for trial status check"""
    success: bool
    trial_status: TrialStatus
    message: str

class TrackUsageRequest(BaseModel):
    """Request to track trial usage"""
    api_key: str
    tokens_used: int = Field(ge=0)
    requests_used: int = Field(default=1, ge=0)
    credits_used: float = Field(default=0.0, ge=0.0)

class TrackUsageResponse(BaseModel):
    """Response for tracking trial usage"""
    success: bool
    daily_requests_used: int
    daily_tokens_used: int
    total_trial_requests: int
    total_trial_tokens: int
    total_trial_credits_used: float
    remaining_tokens: int
    remaining_requests: int
    remaining_credits: float
    message: str

class SubscriptionPlansResponse(BaseModel):
    """Response for available subscription plans"""
    success: bool
    plans: List[SubscriptionPlan]
    message: str

class TrialAnalytics(BaseModel):
    """Trial analytics model"""
    total_trials: int
    active_trials: int
    expired_trials: int
    converted_trials: int
    conversion_rate: float
    average_trial_duration_days: float
    total_trial_revenue: float
    top_converting_plans: List[Dict[str, Any]]

class TrialLimits(BaseModel):
    """Trial limits model"""
    max_tokens: int
    max_requests: int
    max_concurrent_requests: int
    trial_days: int
    features: List[str]

class TrialValidationResult(BaseModel):
    """Result of trial validation"""
    is_valid: bool
    is_trial: bool
    is_expired: bool
    remaining_tokens: int
    remaining_requests: int
    remaining_credits: float
    trial_end_date: Optional[datetime] = None
    error_message: Optional[str] = None
