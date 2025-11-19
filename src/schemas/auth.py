from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator, ConfigDict

from src.schemas.common import AuthMethod


from typing import Optional, List
class PrivyLinkedAccount(BaseModel):
    type: str
    subject: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    verified_at: Optional[int] = None
    first_verified_at: Optional[int] = None
    latest_verified_at: Optional[int] = None

    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        """Validate account type is a known provider"""
        valid_types = {'email', 'google_oauth', 'github', 'apple_oauth', 'discord', 'farcaster', 'wallet'}
        if v not in valid_types:
            raise ValueError(f'Account type must be one of {valid_types}, got {v}')
        return v

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v):
        """Validate email format if provided"""
        if v is not None and '@' not in v:
            raise ValueError('Invalid email format')
        return v


class PrivyUserData(BaseModel):
    id: str
    created_at: int
    linked_accounts: List[PrivyLinkedAccount] = []
    mfa_methods: List[str] = []
    has_accepted_terms: bool = False
    is_guest: bool = False

    @field_validator('id')
    @classmethod
    def validate_id(cls, v):
        """Validate privy user ID is not empty"""
        if not v or not v.strip():
            raise ValueError('Privy user ID cannot be empty')
        return v


class PrivySignupRequest(BaseModel):
    privy_user_id: str
    auth_method: AuthMethod
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    gmail_address: Optional[EmailStr] = None
    github_username: Optional[str] = None


class PrivySigninRequest(BaseModel):
    privy_user_id: str
    auth_method: AuthMethod


class PrivyAuthRequest(BaseModel):
    user: PrivyUserData
    token: str
    email: Optional[str] = None  # Optional top-level email field for frontend to send
    privy_access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    session_update_action: Optional[str] = None
    is_new_user: Optional[bool] = None
    referral_code: Optional[str] = None  # Referral code if user signed up with one
    environment_tag: Optional[str] = "live"  # Environment tag for API keys (live, test, development)

    @field_validator('token')
    @classmethod
    def validate_token(cls, v):
        """Validate token is not empty"""
        if not v or not v.strip():
            raise ValueError('Token cannot be empty')
        return v

    @field_validator('environment_tag')
    @classmethod
    def validate_environment_tag(cls, v):
        """Validate environment tag is one of allowed values"""
        if v is None:
            return "live"
        valid_tags = {'live', 'test', 'development'}
        if v not in valid_tags:
            raise ValueError(f'Environment tag must be one of {valid_tags}, got {v}')
        return v


class PrivyAuthResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[int] = None
    api_key: Optional[str] = None
    auth_method: Optional[AuthMethod] = None
    privy_user_id: Optional[str] = None
    is_new_user: Optional[bool] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    credits: Optional[float] = None
    timestamp: Optional[datetime] = None
