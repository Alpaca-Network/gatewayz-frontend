from datetime import datetime

from pydantic import BaseModel, Field

from src.schemas.common import PlanType, SubscriptionStatus


from typing import Optional, Dict, List
class PlanResponse(BaseModel):
    id: int
    name: str
    description: str
    plan_type: str = "free"
    daily_request_limit: int
    monthly_request_limit: int
    daily_token_limit: int
    monthly_token_limit: int
    price_per_month: float
    yearly_price: Optional[float] = None
    price_per_token: Optional[float] = None
    is_pay_as_you_go: bool = False
    max_concurrent_requests: int = 5
    features: List[str]
    is_active: bool


class SubscriptionPlan(BaseModel):
    """Detailed subscription plan model with all fields"""

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
    price_per_token: Optional[float] = None
    features: List[str] = Field(default_factory=list)
    is_active: bool = True
    is_pay_as_you_go: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


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


class SubscriptionPlansResponse(BaseModel):
    """Response for available subscription plans"""

    success: bool
    plans: List[SubscriptionPlan]
    message: str


class UserPlanResponse(BaseModel):
    user_plan_id: int
    user_id: int
    plan_id: int
    plan_name: str
    plan_description: str
    daily_request_limit: int
    monthly_request_limit: int
    daily_token_limit: int
    monthly_token_limit: int
    price_per_month: float
    features: List[str]
    start_date: str
    end_date: str
    is_active: bool


class AssignPlanRequest(BaseModel):
    user_id: int
    plan_id: int
    duration_months: int = 1


class PlanUsageResponse(BaseModel):
    plan_name: str
    usage: Dict[str, int]
    limits: Dict[str, int]
    remaining: Dict[str, int]
    at_limit: Dict[str, bool]


class PlanEntitlementsResponse(BaseModel):
    has_plan: bool
    plan_name: str
    daily_request_limit: int
    monthly_request_limit: int
    daily_token_limit: int
    monthly_token_limit: int
    features: List[str]
    can_access_feature: bool
    plan_expires: Optional[str] = None
    plan_expired: Optional[bool] = None
