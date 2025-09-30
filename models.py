from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


class AuthMethod(str, Enum):
    EMAIL = "email"
    WALLET = "wallet"
    GOOGLE = "google"
    GITHUB = "github"


class PaymentMethod(str, Enum):
    MASTERCARD = "mastercard"
    PACA_TOKEN = "paca_token"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    TRIAL = "trial"


# Privy Authentication Models
class PrivySignupRequest(BaseModel):
    privy_user_id: str
    auth_method: AuthMethod
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    gmail_address: Optional[EmailStr] = None
    github_username: Optional[str] = None

class PrivySigninRequest(BaseModel):
    privy_user_id: str
    auth_method: AuthMethod

class CreateApiKeyRequest(BaseModel):
    privy_user_id: str
    environment_tag: str = "live"
    key_name: str = "Primary Key"

class PrivyLinkedAccount(BaseModel):
    type: str
    subject: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    verified_at: Optional[int] = None
    first_verified_at: Optional[int] = None
    latest_verified_at: Optional[int] = None

class PrivyUserData(BaseModel):
    id: str
    created_at: int
    linked_accounts: List[PrivyLinkedAccount] = []
    mfa_methods: List[str] = []
    has_accepted_terms: bool = False
    is_guest: bool = False

class PrivyAuthRequest(BaseModel):
    user: PrivyUserData
    token: str
    privy_access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    session_update_action: Optional[str] = None
    is_new_user: Optional[bool] = None

class PrivyAuthResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[int] = None
    api_key: Optional[str] = None
    auth_method: Optional[AuthMethod] = None
    privy_user_id: Optional[str] = None
    is_new_user: Optional[bool] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    credits: Optional[int] = None
    timestamp: Optional[datetime] = None


# Enhanced User Registration Models
class UserRegistrationRequest(BaseModel):
    username: str
    email: EmailStr
    auth_method: AuthMethod = AuthMethod.EMAIL
    environment_tag: str = 'live'
    key_name: str = 'Primary Key'


class UserRegistrationResponse(BaseModel):
    user_id: int
    username: str
    email: str
    api_key: str
    credits: int
    environment_tag: str
    scope_permissions: Dict[str, List[str]]
    auth_method: AuthMethod
    subscription_status: SubscriptionStatus
    message: str
    timestamp: datetime


class SubscriptionPlan(BaseModel):
    id: int
    name: str
    description: str
    price_usd: float
    price_paca: float
    credits_per_month: int
    features: List[str]
    is_active: bool


class CreateSubscriptionRequest(BaseModel):
    plan_id: int
    payment_method: PaymentMethod
    payment_token: str  # Stripe token or PACA transaction hash
    wallet_address: Optional[str] = None  # For PACA payments


class SubscriptionResponse(BaseModel):
    subscription_id: int
    user_id: int
    plan_id: int
    status: SubscriptionStatus
    start_date: datetime
    end_date: datetime
    credits_allocated: int
    payment_method: PaymentMethod
    amount_paid_usd: float
    amount_paid_paca: Optional[float]


class CreditPurchaseRequest(BaseModel):
    amount_usd: float
    payment_method: PaymentMethod
    payment_token: str
    wallet_address: Optional[str] = None


class CreditPurchaseResponse(BaseModel):
    purchase_id: int
    user_id: int
    credits_purchased: int
    amount_paid_usd: float
    amount_paid_paca: Optional[float]
    payment_method: PaymentMethod
    status: str
    timestamp: datetime


class AddCreditsRequest(BaseModel):
    api_key: str
    credits: int


class CreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    initial_credits: int = 1000


class CreateUserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    api_key: str
    credits: int
    message: str
    timestamp: datetime


class Message(BaseModel):
    role: str
    content: str


class ProxyRequest(BaseModel):
    model: str
    messages: List[Message]
    max_tokens: Optional[int] = 950  # Default to 950 tokens (between 900-1000)
    temperature: Optional[float] = 1.0  # Default temperature
    top_p: Optional[float] = 1.0  # Default top_p
    frequency_penalty: Optional[float] = 0.0  # Default frequency_penalty
    presence_penalty: Optional[float] = 0.0  # Default presence_penalty
    
    class Config:
        extra = "allow"


# Monitoring Models
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


# Rate Limiting Models
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


# Usage Tracking Models
class UsageRecord(BaseModel):
    user_id: int
    api_key: str
    model: str
    tokens_used: int
    cost: float
    timestamp: datetime
    request_id: str


# User Profile Management Models
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class UserProfileResponse(BaseModel):
    user_id: int
    api_key: str
    credits: int
    username: Optional[str]
    email: Optional[str]
    auth_method: Optional[str]
    subscription_status: Optional[str]
    trial_expires_at: Optional[str]
    is_active: Optional[bool]
    registration_date: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


class DeleteAccountRequest(BaseModel):
    confirmation: str


class DeleteAccountResponse(BaseModel):
    status: str
    message: str
    user_id: int
    timestamp: datetime


# API Key Management Models
class CreateApiKeyRequest(BaseModel):
    key_name: str
    environment_tag: str = 'live'
    scope_permissions: Optional[Dict[str, List[str]]] = None
    expiration_days: Optional[int] = None
    max_requests: Optional[int] = None
    ip_allowlist: Optional[List[str]] = None
    domain_referrers: Optional[List[str]] = None
    action: str = 'create'


class ApiKeyResponse(BaseModel):
    id: int
    api_key: str
    key_name: str
    environment_tag: str
    scope_permissions: Dict[str, List[str]]
    is_active: bool
    is_primary: bool
    expiration_date: Optional[str] = None
    days_remaining: Optional[int] = None
    max_requests: Optional[int] = None
    requests_used: int
    requests_remaining: Optional[int] = None
    usage_percentage: Optional[float] = None
    ip_allowlist: List[str]
    domain_referrers: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_used_at: Optional[str] = None


class ListApiKeysResponse(BaseModel):
    status: str
    total_keys: int
    keys: List[ApiKeyResponse]


class DeleteApiKeyRequest(BaseModel):
    confirmation: str = "DELETE"


class DeleteApiKeyResponse(BaseModel):
    status: str
    message: str
    deleted_key_id: int
    timestamp: str


class UpdateApiKeyRequest(BaseModel):
    key_name: Optional[str] = None
    scope_permissions: Optional[Dict[str, List[str]]] = None
    expiration_days: Optional[int] = None
    max_requests: Optional[int] = None
    ip_allowlist: Optional[List[str]] = None
    domain_referrers: Optional[List[str]] = None
    is_active: Optional[bool] = None
    action: Optional[str] = None  # 'update', 'rotate', or 'bulk_rotate' for Phase 4 integration
    environment_tag: Optional[str] = None  # For bulk operations


class UpdateApiKeyResponse(BaseModel):
    status: str
    message: str
    updated_key: ApiKeyResponse
    timestamp: datetime


class ApiKeyUsageResponse(BaseModel):
    api_key: str
    key_name: str
    total_requests: int
    total_tokens: int
    total_cost: float
    requests_today: int
    tokens_today: int
    cost_today: float
    last_request_time: Optional[str] = None
    is_active: bool


# Plan Management Models
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




