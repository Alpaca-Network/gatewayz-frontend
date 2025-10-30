from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum

from src.schemas import AuthMethod, SubscriptionStatus


class UserRegistrationRequest(BaseModel):
    username: str
    email: EmailStr
    auth_method: AuthMethod = AuthMethod.EMAIL
    environment_tag: str = 'live'
    key_name: str = 'Primary Key'
    referral_code: Optional[str] = None  # Optional referral code from another user

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
    tier: Optional[str] = None  # Subscription tier: 'basic', 'pro', or 'max'
    trial_expires_at: Optional[str]
    subscription_end_date: Optional[int] = None  # Unix timestamp for subscription end date
    is_active: Optional[bool]
    registration_date: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

class DeleteAccountRequest(BaseModel):
    confirmation: str

class DeleteAccountResponse(BaseModel):
    status: str
    message: str
    user_id: Union[int, str]
    timestamp: datetime
