from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr

from src.schemas.common import AuthMethod, SubscriptionStatus


class UserRegistrationRequest(BaseModel):
    username: str
    email: EmailStr
    auth_method: AuthMethod = AuthMethod.EMAIL
    environment_tag: str = "live"
    key_name: str = "Primary Key"
    referral_code: str | None = None  # Optional referral code from another user


class UserRegistrationResponse(BaseModel):
    user_id: int
    username: str
    email: str
    api_key: str
    credits: int
    environment_tag: str
    scope_permissions: dict[str, list[str]]
    auth_method: AuthMethod
    subscription_status: SubscriptionStatus
    message: str
    timestamp: datetime


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


class UserProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    preferences: dict[str, Any] | None = None
    settings: dict[str, Any] | None = None


class UserProfileResponse(BaseModel):
    user_id: int
    api_key: str
    credits: int
    username: str | None
    email: str | None
    auth_method: str | None
    subscription_status: str | None
    tier: str | None = None  # Subscription tier: 'basic', 'pro', or 'max'
    tier_display_name: str | None = None  # Display-friendly tier name: 'Basic', 'Pro', or 'MAX'
    trial_expires_at: str | None
    subscription_end_date: int | None = None  # Unix timestamp for subscription end date
    is_active: bool | None
    registration_date: str | None
    created_at: str | None
    updated_at: str | None


class DeleteAccountRequest(BaseModel):
    confirmation: str


class DeleteAccountResponse(BaseModel):
    status: str
    message: str
    user_id: int | str
    timestamp: datetime
