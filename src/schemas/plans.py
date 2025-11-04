from datetime import datetime

from pydantic import BaseModel, Field

from src.schemas.common import PlanType, SubscriptionStatus


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
    yearly_price: float | None = None
    price_per_token: float | None = None
    is_pay_as_you_go: bool = False
    max_concurrent_requests: int = 5
    features: list[str]
    is_active: bool


class SubscriptionPlan(BaseModel):
    """Detailed subscription plan model with all fields"""

    id: int | None = None
    plan_name: str
    plan_type: PlanType
    description: str = ""
    monthly_price: float = 0.0
    yearly_price: float | None = None
    daily_request_limit: int = 1000
    monthly_request_limit: int = 1000
    daily_token_limit: int = 100000
    monthly_token_limit: int = 100000
    max_concurrent_requests: int = 5
    price_per_token: float | None = None
    features: list[str] = Field(default_factory=list)
    is_active: bool = True
    is_pay_as_you_go: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SubscriptionHistory(BaseModel):
    """Subscription history model"""

    id: int | None = None
    api_key_id: int
    plan_name: str
    status: SubscriptionStatus
    start_date: datetime
    end_date: datetime | None = None
    price_paid: float = 0.0
    payment_method: str | None = None
    created_at: datetime | None = None


class SubscriptionPlansResponse(BaseModel):
    """Response for available subscription plans"""

    success: bool
    plans: list[SubscriptionPlan]
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
    features: list[str]
    start_date: str
    end_date: str
    is_active: bool


class AssignPlanRequest(BaseModel):
    user_id: int
    plan_id: int
    duration_months: int = 1


class PlanUsageResponse(BaseModel):
    plan_name: str
    usage: dict[str, int]
    limits: dict[str, int]
    remaining: dict[str, int]
    at_limit: dict[str, bool]


class PlanEntitlementsResponse(BaseModel):
    has_plan: bool
    plan_name: str
    daily_request_limit: int
    monthly_request_limit: int
    daily_token_limit: int
    monthly_token_limit: int
    features: list[str]
    can_access_feature: bool
    plan_expires: str | None = None
    plan_expired: bool | None = None
