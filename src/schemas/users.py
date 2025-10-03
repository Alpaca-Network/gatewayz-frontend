from pydantic import BaseModel, EmailStr
from typing import Dict, List, Any, Optional
from datetime import datetime
from src.schemas.common import AuthMethod, SubscriptionStatus

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