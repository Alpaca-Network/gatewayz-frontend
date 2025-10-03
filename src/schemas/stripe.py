#!/usr/bin/env python3
"""
Stripe Payment Processing Models
Pydantic models for Stripe payment integration
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


# ==================== Enums ====================

class StripePaymentStatus(str, Enum):
    """Stripe payment status"""
    PENDING = "pending"
    PROCESSING = "processing"
    REQUIRES_ACTION = "requires_action"
    REQUIRES_PAYMENT_METHOD = "requires_payment_method"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


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


# ==================== Checkout Session Models ====================

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
    status: StripePaymentStatus
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
    automatic_payment_methods: bool = Field(
        default=True,
        description="Enable automatic payment methods"
    )


class PaymentIntentResponse(BaseModel):
    """Response from creating a payment intent"""
    payment_intent_id: str
    client_secret: str
    payment_id: int
    status: StripePaymentStatus
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


class UpdateStripeCustomerRequest(BaseModel):
    """Request to update a Stripe customer"""
    email: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ==================== Payment Method Models ====================

class AttachPaymentMethodRequest(BaseModel):
    """Request to attach a payment method to a customer"""
    payment_method_id: str
    customer_id: str


class PaymentMethodResponse(BaseModel):
    """Response for payment method"""
    payment_method_id: str
    type: StripePaymentMethodType
    card: Optional[Dict[str, Any]] = None
    created_at: datetime


# ==================== Refund Models ====================

class CreateRefundRequest(BaseModel):
    """Request to create a refund"""
    payment_intent_id: str
    amount: Optional[int] = Field(
        None,
        description="Amount to refund in cents. If not provided, refunds the full amount"
    )
    reason: Optional[str] = Field(
        None,
        description="Reason for refund: duplicate, fraudulent, or requested_by_customer"
    )
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


# ==================== Payment Record Models ====================

class StripePaymentRecord(BaseModel):
    """Complete payment record"""
    id: int
    user_id: int
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    amount: int
    currency: str
    status: StripePaymentStatus
    payment_method_type: Optional[StripePaymentMethodType] = None
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class PaymentHistoryResponse(BaseModel):
    """User's payment history"""
    total_payments: int
    total_amount: int
    currency: str
    payments: List[StripePaymentRecord]


# ==================== Price and Product Models ====================

class StripePriceModel(BaseModel):
    """Stripe price configuration"""
    price_id: str
    product_id: str
    amount: int
    currency: StripeCurrency
    interval: Optional[str] = None  # "month", "year" for subscriptions
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


class PurchaseCreditPackageRequest(BaseModel):
    """Request to purchase a credit package"""
    package_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


# ==================== Balance and Transaction Models ====================

class StripeBalanceResponse(BaseModel):
    """Stripe account balance"""
    available: List[Dict[str, Any]]
    pending: List[Dict[str, Any]]
    livemode: bool


class StripeTransactionRecord(BaseModel):
    """Transaction record"""
    id: str
    amount: int
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


# ==================== Configuration Models ====================

class StripeConfig(BaseModel):
    """Stripe configuration"""
    publishable_key: str
    webhook_secret: str
    currency: StripeCurrency = Field(default=StripeCurrency.USD)
    min_amount: int = Field(default=50, description="Minimum amount in cents")
    max_amount: int = Field(default=99999999, description="Maximum amount in cents")
    success_url_template: str
    cancel_url_template: str


# ==================== Payment Summary Models ====================

class PaymentSummary(BaseModel):
    """Payment summary for user"""
    total_spent: int
    total_payments: int
    successful_payments: int
    failed_payments: int
    refunded_amount: int
    currency: StripeCurrency
    last_payment_date: Optional[datetime] = None
    lifetime_credits_purchased: int


class PaymentStatsResponse(BaseModel):
    """Payment statistics"""
    today: Dict[str, Any]
    this_week: Dict[str, Any]
    this_month: Dict[str, Any]
    all_time: Dict[str, Any]