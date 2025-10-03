from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from src.schemas.common import PaymentMethod, SubscriptionStatus

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
    payment_token: str
    wallet_address: Optional[str] = None

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

class PaymentStatus(str, Enum):
    """Payment status enumeration"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    PROCESSING = "processing"
    CANCELED = "canceled"

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
