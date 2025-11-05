"""
Centralized schema exports
"""

# Admin models
from src.schemas.admin import (
    AdminMonitorResponse,
    RateLimitConfig,
    RateLimitResponse,
    SetRateLimitRequest,
    UsageMetrics,
    UsageRecord,
    UserMonitorResponse,
)

# API Key models
from src.schemas.api_keys import (
    ApiKeyResponse,
    ApiKeyUsageResponse,
    CreateApiKeyRequest,
    DeleteApiKeyRequest,
    DeleteApiKeyResponse,
    ListApiKeysResponse,
    UpdateApiKeyRequest,
    UpdateApiKeyResponse,
)

# Auth models
from src.schemas.auth import (
    PrivyAuthRequest,
    PrivyAuthResponse,
    PrivyLinkedAccount,
    PrivySigninRequest,
    PrivySignupRequest,
    PrivyUserData,
)

# Common enums
from src.schemas.common import AuthMethod, PaymentMethod, PlanType, SubscriptionStatus

# Coupon models
from src.schemas.coupons import (
    AvailableCouponResponse,
    CouponAnalyticsResponse,
    CouponResponse,
    CouponScope,
    CouponStatsResponse,
    CouponType,
    CreateCouponRequest,
    CreatorType,
    ListCouponsResponse,
    RedeemCouponRequest,
    RedemptionHistoryResponse,
    RedemptionResponse,
    UpdateCouponRequest,
)

# Payment models (includes both generic payment and Stripe-specific models)
from src.schemas.payments import (
    AddCreditsRequest,
    CheckoutSessionResponse,
    CreateCheckoutSessionRequest,
    CreatePaymentIntentRequest,
    CreateRefundRequest,
    CreateStripeCustomerRequest,
    CreateSubscriptionRequest,
    CreditPackage,
    CreditPackagesResponse,
    CreditPurchaseRequest,
    CreditPurchaseResponse,
    PaymentCreate,
    PaymentHistoryResponse,
    PaymentIntentResponse,
    PaymentRecord,
    PaymentResponse,
    PaymentStatsResponse,
    PaymentStatus,
    PaymentSummary,
    PaymentUpdate,
    RefundResponse,
    StripeCurrency,
    StripeCustomerResponse,
    StripeErrorResponse,
    StripePaymentMethodType,
    StripeWebhookEvent,
    StripeWebhookEventType,
)
from src.schemas.payments import (
    SubscriptionPlan as PaymentSubscriptionPlan,  # Stripe-specific models; Rename to avoid conflict
)
from src.schemas.payments import (
    SubscriptionResponse,
    WebhookProcessingResult,
)

# Plan models
from src.schemas.plans import SubscriptionPlan  # This is the correct one for trial service
from src.schemas.plans import (
    AssignPlanRequest,
    PlanEntitlementsResponse,
    PlanResponse,
    PlanUsageResponse,
    SubscriptionHistory,
    SubscriptionPlansResponse,
    UserPlanResponse,
)

# Proxy models
from src.schemas.proxy import (  # Anthropic Messages API
    AnthropicMessage,
    ContentBlock,
    InputMessage,
    Message,
    MessagesRequest,
    ProxyRequest,
    ResponseFormat,
    ResponseFormatType,
    ResponseRequest,
)

# Trial models
from src.schemas.trials import (
    ConvertTrialRequest,
    ConvertTrialResponse,
    StartTrialRequest,
    StartTrialResponse,
    TrackUsageRequest,
    TrackUsageResponse,
    TrialAnalytics,
    TrialConversion,
    TrialLimits,
    TrialStatus,
    TrialStatusResponse,
    TrialUsage,
    TrialValidationResult,
)

# User models
from src.schemas.users import (
    CreateUserRequest,
    CreateUserResponse,
    DeleteAccountRequest,
    DeleteAccountResponse,
    UserProfileResponse,
    UserProfileUpdate,
    UserRegistrationRequest,
    UserRegistrationResponse,
)

__all__ = [
    # Common
    "AuthMethod",
    "PaymentMethod",
    "SubscriptionStatus",
    "PlanType",
    # Auth
    "PrivySignupRequest",
    "PrivySigninRequest",
    "PrivyAuthRequest",
    "PrivyAuthResponse",
    # Users
    "UserRegistrationRequest",
    "UserRegistrationResponse",
    "UserProfileResponse",
    # API Keys
    "CreateApiKeyRequest",
    "ApiKeyResponse",
    "UpdateApiKeyRequest",
    # Payments
    "PaymentStatus",
    "PaymentCreate",
    "PaymentResponse",
    "PaymentUpdate",
    "PaymentRecord",
    # Stripe
    "StripeCurrency",
    "StripePaymentMethodType",
    "StripeWebhookEventType",
    "CreateCheckoutSessionRequest",
    "CheckoutSessionResponse",
    "CreatePaymentIntentRequest",
    "PaymentIntentResponse",
    "StripeWebhookEvent",
    "WebhookProcessingResult",
    "CreditPackage",
    "PaymentSummary",
    # Plans
    "PlanResponse",
    "SubscriptionPlan",
    "UserPlanResponse",
    # Trials
    "TrialStatus",
    "TrialUsage",
    "StartTrialRequest",
    "StartTrialResponse",
    "ConvertTrialRequest",
    "ConvertTrialResponse",
    "TrialStatusResponse",
    "TrackUsageRequest",
    "TrackUsageResponse",
    "TrialAnalytics",
    "TrialLimits",
    "TrialValidationResult",
    # Admin
    "UsageMetrics",
    "AdminMonitorResponse",
    "RateLimitConfig",
    # Proxy
    "ProxyRequest",
    "Message",
    "ResponseRequest",
    "InputMessage",
    "ResponseFormat",
    "ResponseFormatType",
    # Anthropic Messages API
    "ContentBlock",
    "AnthropicMessage",
    "MessagesRequest",
]
