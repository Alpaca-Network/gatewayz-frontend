"""
Centralized schema exports
"""

# Common enums
from src.schemas.common import (
    AuthMethod,
    PaymentMethod,
    SubscriptionStatus,
    PlanType,  # Added
)

# Auth models
from src.schemas.auth import (
    PrivyLinkedAccount,
    PrivyUserData,
    PrivySignupRequest,
    PrivySigninRequest,
    PrivyAuthRequest,
    PrivyAuthResponse,
)

# User models
from src.schemas.users import (
    UserRegistrationRequest,
    UserRegistrationResponse,
    CreateUserRequest,
    CreateUserResponse,
    UserProfileUpdate,
    UserProfileResponse,
    DeleteAccountRequest,
    DeleteAccountResponse,
)

# API Key models
from src.schemas.api_keys import (
    CreateApiKeyRequest,
    ApiKeyResponse,
    ListApiKeysResponse,
    DeleteApiKeyRequest,
    DeleteApiKeyResponse,
    UpdateApiKeyRequest,
    UpdateApiKeyResponse,
    ApiKeyUsageResponse,
)

# Payment models (includes both generic payment and Stripe-specific models)
from src.schemas.payments import (
    PaymentStatus,
    PaymentCreate,
    PaymentResponse,
    PaymentUpdate,
    PaymentRecord,
    SubscriptionPlan,
    CreateSubscriptionRequest,
    SubscriptionResponse,
    CreditPurchaseRequest,
    CreditPurchaseResponse,
    AddCreditsRequest,
    # Stripe-specific models
    StripeCurrency,
    StripePaymentMethodType,
    StripeWebhookEventType,
    CreateCheckoutSessionRequest,
    CheckoutSessionResponse,
    CreatePaymentIntentRequest,
    PaymentIntentResponse,
    CreateStripeCustomerRequest,
    StripeCustomerResponse,
    CreateRefundRequest,
    RefundResponse,
    StripeWebhookEvent,
    WebhookProcessingResult,
    CreditPackage,
    CreditPackagesResponse,
    PaymentHistoryResponse,
    PaymentSummary,
    PaymentStatsResponse,
    StripeErrorResponse,
)

# Plan models
from src.schemas.plans import (
    PlanResponse,
    SubscriptionHistory,
    SubscriptionPlansResponse,
    UserPlanResponse,
    AssignPlanRequest,
    PlanUsageResponse,
    PlanEntitlementsResponse,
)

# Trial models
from src.schemas.trials import (
    TrialStatus,
    TrialUsage,
    TrialConversion,
    StartTrialRequest,
    StartTrialResponse,
    ConvertTrialRequest,
    ConvertTrialResponse,
    TrialStatusResponse,
    TrackUsageRequest,
    TrackUsageResponse,
    TrialAnalytics,
    TrialLimits,
    TrialValidationResult,
)

# Admin models
from src.schemas.admin import (
    UsageMetrics,
    UserMonitorResponse,
    AdminMonitorResponse,
    RateLimitConfig,
    SetRateLimitRequest,
    RateLimitResponse,
    UsageRecord,
)

# Proxy models
from src.schemas.proxy import (
    Message,
    ProxyRequest,
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
]