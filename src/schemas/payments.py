#!/usr/bin/env python3
"""
Payment Processing Models
Unified Pydantic models for payment integrations (Stripe, subscriptions, credits)
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

# ==================== Enums ====================


class PaymentMethod(str, Enum):
    """Payment method types"""

    STRIPE = "stripe"
    CRYPTO = "crypto"
    PACA = "paca"
    BANK_TRANSFER = "bank_transfer"


class PaymentStatus(str, Enum):
    """Universal payment status"""

    PENDING = "pending"
    PROCESSING = "processing"
    REQUIRES_ACTION = "requires_action"
    REQUIRES_PAYMENT_METHOD = "requires_payment_method"
    COMPLETED = "completed"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class SubscriptionStatus(str, Enum):
    """Subscription status"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    TRIALING = "trialing"
    PAUSED = "paused"


class StripeCurrency(str, Enum):
    """Supported currencies"""

    USD = "usd"
    EUR = "eur"
    GBP = "gbp"
    CAD = "cad"
    AUD = "aud"


class StripePaymentMethodType(str, Enum):
    """Stripe payment method types"""

    CARD = "card"
    BANK_ACCOUNT = "bank_account"
    ALIPAY = "alipay"
    WECHAT_PAY = "wechat_pay"
    IDEAL = "ideal"
    SEPA_DEBIT = "sepa_debit"


class StripeWebhookEventType(str, Enum):
    """Stripe webhook event types"""

    CHECKOUT_SESSION_COMPLETED = "checkout.session.completed"
    CHECKOUT_SESSION_EXPIRED = "checkout.session.expired"
    PAYMENT_INTENT_SUCCEEDED = "payment_intent.succeeded"
    PAYMENT_INTENT_FAILED = "payment_intent.payment_failed"
    PAYMENT_INTENT_CANCELED = "payment_intent.canceled"
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_DELETED = "customer.deleted"
    CHARGE_SUCCEEDED = "charge.succeeded"
    CHARGE_FAILED = "charge.failed"
    CHARGE_REFUNDED = "charge.refunded"
    INVOICE_PAID = "invoice.paid"
    INVOICE_PAYMENT_FAILED = "invoice.payment_failed"


# ==================== Generic Payment Models ====================


class PaymentCreate(BaseModel):
    """Create payment record"""

    user_id: int
    amount: float
    currency: str = "usd"
    payment_method: str = "stripe"
    status: PaymentStatus = PaymentStatus.PENDING
    stripe_payment_intent_id: str | None = None
    stripe_customer_id: str | None = None
    metadata: dict[str, Any] | None = None


class PaymentResponse(BaseModel):
    """Payment response"""

    id: int
    user_id: int
    amount: float
    currency: str
    payment_method: str
    status: PaymentStatus
    stripe_payment_intent_id: str | None = None
    stripe_customer_id: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime | None = None


class PaymentUpdate(BaseModel):
    """Update payment"""

    status: PaymentStatus | None = None
    stripe_payment_intent_id: str | None = None
    error_message: str | None = None


class PaymentRecord(BaseModel):
    """Complete payment record"""

    id: int
    user_id: int
    stripe_payment_intent_id: str | None = None
    stripe_session_id: str | None = None
    stripe_customer_id: str | None = None
    amount: float
    currency: str
    status: PaymentStatus
    payment_method_type: StripePaymentMethodType | None = None
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    error_message: str | None = None


# ==================== Stripe Checkout Session Models ====================


class CreateCheckoutSessionRequest(BaseModel):
    """Request to create a Stripe checkout session"""

    amount: int = Field(..., description="Amount in cents (e.g., 2999 for $29.99)", gt=0)
    currency: StripeCurrency = Field(default=StripeCurrency.USD)
    success_url: str | None = Field(None, description="URL to redirect on success")
    cancel_url: str | None = Field(None, description="URL to redirect on cancel")
    customer_email: str | None = None
    metadata: dict[str, Any] | None = Field(default_factory=dict)
    description: str | None = "Gatewayz Credits Purchase"

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v < 50:  # Minimum $0.50
            raise ValueError("Amount must be at least $0.50 (50 cents)")
        if v > 99999999:  # Maximum ~$1M
            raise ValueError("Amount exceeds maximum allowed")
        return v


class CheckoutSessionResponse(BaseModel):
    """Response from creating a checkout session"""

    session_id: str
    url: str
    payment_id: int
    status: PaymentStatus
    amount: int
    currency: str
    expires_at: datetime


# ==================== Payment Intent Models ====================


class CreatePaymentIntentRequest(BaseModel):
    """Request to create a Stripe payment intent"""

    amount: int = Field(..., gt=0, description="Amount in cents")
    currency: StripeCurrency = Field(default=StripeCurrency.USD)
    payment_method_types: list[StripePaymentMethodType] = Field(
        default=[StripePaymentMethodType.CARD]
    )
    customer_email: str | None = None
    description: str | None = "Gatewayz Credits"
    metadata: dict[str, Any] | None = Field(default_factory=dict)
    automatic_payment_methods: bool = Field(default=True)


class PaymentIntentResponse(BaseModel):
    """Response from creating a payment intent"""

    payment_intent_id: str
    client_secret: str
    payment_id: int
    status: PaymentStatus
    amount: int
    currency: str
    next_action: dict[str, Any] | None = None


class UpdatePaymentIntentRequest(BaseModel):
    """Request to update a payment intent"""

    amount: int | None = Field(None, gt=0)
    metadata: dict[str, Any] | None = None
    description: str | None = None


# ==================== Customer Models ====================


class CreateStripeCustomerRequest(BaseModel):
    """Request to create a Stripe customer"""

    email: str
    name: str | None = None
    phone: str | None = None
    metadata: dict[str, Any] | None = Field(default_factory=dict)
    description: str | None = None


class StripeCustomerResponse(BaseModel):
    """Response for Stripe customer"""

    customer_id: str
    email: str
    name: str | None = None
    created_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


# ==================== Refund Models ====================


class CreateRefundRequest(BaseModel):
    """Request to create a refund"""

    payment_intent_id: str
    amount: int | None = Field(None, description="Amount to refund in cents")
    reason: str | None = Field(None, description="Reason for refund")
    metadata: dict[str, Any] | None = Field(default_factory=dict)


class RefundResponse(BaseModel):
    """Response from creating a refund"""

    refund_id: str
    payment_intent_id: str
    amount: int
    currency: str
    status: str
    reason: str | None = None
    created_at: datetime


# ==================== Webhook Models ====================


class StripeWebhookEvent(BaseModel):
    """Stripe webhook event payload"""

    id: str
    type: StripeWebhookEventType
    data: dict[str, Any]
    created: int
    livemode: bool


class WebhookProcessingResult(BaseModel):
    """Result of webhook processing"""

    success: bool
    event_type: str
    event_id: str
    processed_at: datetime
    message: str
    user_id: int | None = None
    payment_id: int | None = None
    credits_added: int | None = None
    error: str | None = None


# ==================== Credit Package Models ====================


class CreditPackage(BaseModel):
    """Predefined credit packages"""

    id: str
    name: str
    credits: int
    amount: int = Field(..., description="Amount in cents")
    currency: StripeCurrency = Field(default=StripeCurrency.USD)
    discount_percentage: float | None = Field(None, ge=0, le=100)
    popular: bool = False
    description: str | None = None
    features: list[str] = Field(default_factory=list)


class CreditPackagesResponse(BaseModel):
    """Available credit packages"""

    packages: list[CreditPackage]
    currency: StripeCurrency


class CreditPurchaseRequest(BaseModel):
    """Request to purchase credits"""

    amount_usd: float
    payment_method: PaymentMethod
    payment_token: str
    wallet_address: str | None = None


class CreditPurchaseResponse(BaseModel):
    """Response from credit purchase"""

    purchase_id: int
    user_id: int
    credits_purchased: int
    amount_paid_usd: float
    amount_paid_paca: float | None
    payment_method: PaymentMethod
    status: str
    timestamp: datetime


class AddCreditsRequest(BaseModel):
    """Request to add credits (admin)"""

    api_key: str
    credits: int


# ==================== Subscription Models ====================


class SubscriptionPlan(BaseModel):
    """Subscription plan details"""

    id: int
    name: str
    description: str
    price_usd: float
    price_paca: float
    credits_per_month: int
    features: list[str]
    is_active: bool


class CreateSubscriptionRequest(BaseModel):
    """Request to create a subscription"""

    plan_id: int
    payment_method: PaymentMethod
    payment_token: str
    wallet_address: str | None = None


class SubscriptionResponse(BaseModel):
    """Subscription response"""

    subscription_id: int
    user_id: int
    plan_id: int
    status: SubscriptionStatus
    start_date: datetime
    end_date: datetime
    credits_allocated: int
    payment_method: PaymentMethod
    amount_paid_usd: float
    amount_paid_paca: float | None


# ==================== Stripe Subscription Checkout Models ====================


class CreateSubscriptionCheckoutRequest(BaseModel):
    """Request to create a Stripe subscription checkout session"""

    price_id: str = Field(..., description="Stripe price ID (e.g., price_1SNk2KLVT8n4vaEn7lHNPYWB)")
    product_id: str = Field(..., description="Stripe product ID (e.g., prod_TKOqQPhVRxNp4Q)")
    customer_email: str | None = Field(None, description="Customer email address")
    success_url: str = Field(..., description="URL to redirect on successful subscription")
    cancel_url: str = Field(..., description="URL to redirect on canceled subscription")
    mode: str = Field(
        default="subscription", description="Checkout mode (subscription, payment, or setup)"
    )
    metadata: dict[str, Any] | None = Field(default_factory=dict, description="Additional metadata")

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v):
        allowed_modes = ["subscription", "payment", "setup"]
        if v not in allowed_modes:
            raise ValueError(f'Mode must be one of: {", ".join(allowed_modes)}')
        return v


class SubscriptionCheckoutResponse(BaseModel):
    """Response from creating a subscription checkout session"""

    session_id: str = Field(..., description="Stripe checkout session ID")
    url: str = Field(..., description="Stripe checkout URL to redirect user to")
    customer_id: str | None = Field(None, description="Stripe customer ID if created")
    status: str = Field(default="open", description="Checkout session status")


# ==================== Product and Price Models ====================


class StripePriceModel(BaseModel):
    """Stripe price configuration"""

    price_id: str
    product_id: str
    amount: int
    currency: StripeCurrency
    interval: str | None = None  # "month", "year"
    interval_count: int | None = None
    nickname: str | None = None
    active: bool = True


class StripeProductModel(BaseModel):
    """Stripe product configuration"""

    product_id: str
    name: str
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    active: bool = True
    prices: list[StripePriceModel] = Field(default_factory=list)


# ==================== Payment History & Stats ====================


class PaymentHistoryResponse(BaseModel):
    """User's payment history"""

    total_payments: int
    total_amount: float
    currency: str
    payments: list[PaymentRecord]


class PaymentSummary(BaseModel):
    """Payment summary for user"""

    total_spent: float
    total_payments: int
    successful_payments: int
    failed_payments: int
    refunded_amount: float
    currency: StripeCurrency
    last_payment_date: datetime | None = None
    lifetime_credits_purchased: int


class PaymentStatsResponse(BaseModel):
    """Payment statistics"""

    today: dict[str, Any]
    this_week: dict[str, Any]
    this_month: dict[str, Any]
    all_time: dict[str, Any]


# ==================== Transaction Models ====================


class TransactionRecord(BaseModel):
    """Transaction record"""

    id: str
    amount: float
    currency: str
    description: str | None = None
    status: str
    created_at: datetime
    type: str  # "payment", "refund", "adjustment"


# ==================== Error Models ====================


class StripeErrorResponse(BaseModel):
    """Stripe error response"""

    error: str
    message: str
    type: str | None = None
    code: str | None = None
    decline_code: str | None = None
    param: str | None = None
