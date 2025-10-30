#!/usr/bin/env python3
"""
Payment Processing Models
Unified Pydantic models for payment integrations (Stripe, subscriptions, credits)
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


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
    stripe_payment_intent_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class PaymentResponse(BaseModel):
    """Payment response"""
    id: int
    user_id: int
    amount: float
    currency: str
    payment_method: str
    status: PaymentStatus
    stripe_payment_intent_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class PaymentUpdate(BaseModel):
    """Update payment"""
    status: Optional[PaymentStatus] = None
    stripe_payment_intent_id: Optional[str] = None
    error_message: Optional[str] = None


class PaymentRecord(BaseModel):
    """Complete payment record"""
    id: int
    user_id: int
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    amount: float
    currency: str
    status: PaymentStatus
    payment_method_type: Optional[StripePaymentMethodType] = None
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None


# ==================== Stripe Checkout Session Models ====================

class CreateCheckoutSessionRequest(BaseModel):
    """Request to create a Stripe checkout session"""
    amount: int = Field(..., description="Amount in cents (e.g., 2999 for $29.99)", gt=0)
    currency: StripeCurrency = Field(default=StripeCurrency.USD)
    success_url: Optional[str] = Field(None, description="URL to redirect on success")
    cancel_url: Optional[str] = Field(None, description="URL to redirect on cancel")
    customer_email: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    description: Optional[str] = "Gatewayz Credits Purchase"

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v < 50:  # Minimum $0.50
            raise ValueError('Amount must be at least $0.50 (50 cents)')
        if v > 99999999:  # Maximum ~$1M
            raise ValueError('Amount exceeds maximum allowed')
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
    payment_method_types: List[StripePaymentMethodType] = Field(
        default=[StripePaymentMethodType.CARD]
    )
    customer_email: Optional[str] = None
    description: Optional[str] = "Gatewayz Credits"
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    automatic_payment_methods: bool = Field(default=True)


class PaymentIntentResponse(BaseModel):
    """Response from creating a payment intent"""
    payment_intent_id: str
    client_secret: str
    payment_id: int
    status: PaymentStatus
    amount: int
    currency: str
    next_action: Optional[Dict[str, Any]] = None


class UpdatePaymentIntentRequest(BaseModel):
    """Request to update a payment intent"""
    amount: Optional[int] = Field(None, gt=0)
    metadata: Optional[Dict[str, Any]] = None
    description: Optional[str] = None


# ==================== Customer Models ====================

class CreateStripeCustomerRequest(BaseModel):
    """Request to create a Stripe customer"""
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    description: Optional[str] = None


class StripeCustomerResponse(BaseModel):
    """Response for Stripe customer"""
    customer_id: str
    email: str
    name: Optional[str] = None
    created_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ==================== Refund Models ====================

class CreateRefundRequest(BaseModel):
    """Request to create a refund"""
    payment_intent_id: str
    amount: Optional[int] = Field(None, description="Amount to refund in cents")
    reason: Optional[str] = Field(None, description="Reason for refund")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class RefundResponse(BaseModel):
    """Response from creating a refund"""
    refund_id: str
    payment_intent_id: str
    amount: int
    currency: str
    status: str
    reason: Optional[str] = None
    created_at: datetime


# ==================== Webhook Models ====================

class StripeWebhookEvent(BaseModel):
    """Stripe webhook event payload"""
    id: str
    type: StripeWebhookEventType
    data: Dict[str, Any]
    created: int
    livemode: bool


class WebhookProcessingResult(BaseModel):
    """Result of webhook processing"""
    success: bool
    event_type: str
    event_id: str
    processed_at: datetime
    message: str
    user_id: Optional[int] = None
    payment_id: Optional[int] = None
    credits_added: Optional[int] = None
    error: Optional[str] = None


# ==================== Credit Package Models ====================

class CreditPackage(BaseModel):
    """Predefined credit packages"""
    id: str
    name: str
    credits: int
    amount: int = Field(..., description="Amount in cents")
    currency: StripeCurrency = Field(default=StripeCurrency.USD)
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    popular: bool = False
    description: Optional[str] = None
    features: List[str] = Field(default_factory=list)


class CreditPackagesResponse(BaseModel):
    """Available credit packages"""
    packages: List[CreditPackage]
    currency: StripeCurrency


class CreditPurchaseRequest(BaseModel):
    """Request to purchase credits"""
    amount_usd: float
    payment_method: PaymentMethod
    payment_token: str
    wallet_address: Optional[str] = None


class CreditPurchaseResponse(BaseModel):
    """Response from credit purchase"""
    purchase_id: int
    user_id: int
    credits_purchased: int
    amount_paid_usd: float
    amount_paid_paca: Optional[float]
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
    features: List[str]
    is_active: bool


class CreateSubscriptionRequest(BaseModel):
    """Request to create a subscription"""
    plan_id: int
    payment_method: PaymentMethod
    payment_token: str
    wallet_address: Optional[str] = None


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
    amount_paid_paca: Optional[float]


# ==================== Product and Price Models ====================

class StripePriceModel(BaseModel):
    """Stripe price configuration"""
    price_id: str
    product_id: str
    amount: int
    currency: StripeCurrency
    interval: Optional[str] = None  # "month", "year"
    interval_count: Optional[int] = None
    nickname: Optional[str] = None
    active: bool = True


class StripeProductModel(BaseModel):
    """Stripe product configuration"""
    product_id: str
    name: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    active: bool = True
    prices: List[StripePriceModel] = Field(default_factory=list)


# ==================== Payment History & Stats ====================

class PaymentHistoryResponse(BaseModel):
    """User's payment history"""
    total_payments: int
    total_amount: float
    currency: str
    payments: List[PaymentRecord]


class PaymentSummary(BaseModel):
    """Payment summary for user"""
    total_spent: float
    total_payments: int
    successful_payments: int
    failed_payments: int
    refunded_amount: float
    currency: StripeCurrency
    last_payment_date: Optional[datetime] = None
    lifetime_credits_purchased: int


class PaymentStatsResponse(BaseModel):
    """Payment statistics"""
    today: Dict[str, Any]
    this_week: Dict[str, Any]
    this_month: Dict[str, Any]
    all_time: Dict[str, Any]


# ==================== Transaction Models ====================

class TransactionRecord(BaseModel):
    """Transaction record"""
    id: str
    amount: float
    currency: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    type: str  # "payment", "refund", "adjustment"


# ==================== Error Models ====================

class StripeErrorResponse(BaseModel):
    """Stripe error response"""
    error: str
    message: str
    type: Optional[str] = None
    code: Optional[str] = None
    decline_code: Optional[str] = None
    param: Optional[str] = None
