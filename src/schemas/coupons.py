"""
Pydantic schemas for coupon system
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class CouponScope(str, Enum):
    """Coupon scope types"""

    USER_SPECIFIC = "user_specific"
    GLOBAL = "global"


class CouponType(str, Enum):
    """Coupon type categories"""

    PROMOTIONAL = "promotional"
    REFERRAL = "referral"
    COMPENSATION = "compensation"
    PARTNERSHIP = "partnership"


class CreatorType(str, Enum):
    """Who created the coupon"""

    ADMIN = "admin"
    SYSTEM = "system"


# ============================================
# Request Schemas
# ============================================


class CreateCouponRequest(BaseModel):
    """Request to create a new coupon"""

    code: str = Field(..., min_length=3, max_length=50, description="Unique coupon code")
    value_usd: float = Field(..., gt=0, le=1000, description="Dollar value of the coupon")
    coupon_scope: CouponScope = Field(..., description="Scope: user_specific or global")
    max_uses: int = Field(..., gt=0, description="Maximum number of redemptions")
    valid_until: datetime = Field(..., description="Expiration date")
    coupon_type: CouponType = Field(CouponType.PROMOTIONAL, description="Type of coupon")
    assigned_to_user_id: Optional[int] = Field(
        None, description="User ID for user-specific coupons"
    )
    description: Optional[str] = Field(None, max_length=500, description="Internal description")
    valid_from: Optional[datetime] = Field(None, description="Start date (defaults to now)")

    @validator("code")
    def code_must_be_alphanumeric(cls, v):
        """Validate coupon code format"""
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Code must be alphanumeric (hyphens and underscores allowed)")
        return v.upper()

    @validator("assigned_to_user_id", always=True)
    def validate_user_assignment(cls, v, values):
        """Validate user assignment based on scope"""
        scope = values.get("coupon_scope")
        if scope == CouponScope.USER_SPECIFIC and not v:
            raise ValueError("User-specific coupons must have assigned_to_user_id")
        if scope == CouponScope.GLOBAL and v:
            raise ValueError("Global coupons cannot have assigned_to_user_id")
        return v

    @validator("max_uses")
    def validate_max_uses(cls, v, values):
        """Validate max_uses based on scope"""
        scope = values.get("coupon_scope")
        if scope == CouponScope.USER_SPECIFIC and v != 1:
            raise ValueError("User-specific coupons must have max_uses = 1")
        return v


class RedeemCouponRequest(BaseModel):
    """Request to redeem a coupon"""

    code: str = Field(..., min_length=3, max_length=50, description="Coupon code to redeem")


class UpdateCouponRequest(BaseModel):
    """Request to update a coupon"""

    valid_until: Optional[datetime] = Field(None, description="New expiration date")
    max_uses: Optional[int] = Field(None, gt=0, description="New max uses")
    is_active: Optional[bool] = Field(None, description="Active status")
    description: Optional[str] = Field(None, max_length=500, description="Updated description")


# ============================================
# Response Schemas
# ============================================


class CouponResponse(BaseModel):
    """Coupon details response"""

    id: int
    code: str
    value_usd: float
    coupon_scope: str
    coupon_type: str
    max_uses: int
    times_used: int
    valid_from: datetime
    valid_until: datetime
    is_active: bool
    created_at: datetime
    assigned_to_user_id: Optional[int] = None
    created_by: Optional[int] = None
    created_by_type: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class AvailableCouponResponse(BaseModel):
    """Available coupon for user response"""

    coupon_id: int
    code: str
    value_usd: float
    coupon_scope: str
    coupon_type: str
    description: Optional[str]
    valid_until: datetime
    remaining_uses: int


class RedemptionResponse(BaseModel):
    """Coupon redemption response"""

    success: bool
    message: str
    coupon_code: Optional[str] = None
    coupon_value: Optional[float] = None
    previous_balance: Optional[float] = None
    new_balance: Optional[float] = None
    error_code: Optional[str] = None


class RedemptionHistoryItem(BaseModel):
    """Single redemption history item"""

    id: int
    coupon_code: str
    coupon_scope: str
    coupon_type: str
    value_applied: float
    redeemed_at: datetime
    user_balance_before: float
    user_balance_after: float


class RedemptionHistoryResponse(BaseModel):
    """User redemption history response"""

    redemptions: List[RedemptionHistoryItem]
    total_redemptions: int
    total_value_redeemed: float


class CouponAnalyticsResponse(BaseModel):
    """Coupon analytics response"""

    coupon: CouponResponse
    total_redemptions: int
    unique_users: int
    total_value_distributed: float
    redemption_rate: float
    remaining_uses: int
    is_expired: bool


class CouponStatsResponse(BaseModel):
    """System-wide coupon statistics"""

    total_coupons: int
    active_coupons: int
    user_specific_coupons: int
    global_coupons: int
    total_redemptions: int
    unique_redeemers: int
    total_value_distributed: float
    average_redemption_value: float


class ListCouponsResponse(BaseModel):
    """List of coupons response"""

    coupons: List[CouponResponse]
    total: int
    offset: int
    limit: int
