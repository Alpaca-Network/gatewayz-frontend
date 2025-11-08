from datetime import datetime

from pydantic import BaseModel, EmailStr

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


class PrivyUserData(BaseModel):
    id: str
    created_at: int
    linked_accounts: List[PrivyLinkedAccount] = []
    mfa_methods: List[str] = []
    has_accepted_terms: bool = False
    is_guest: bool = False


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
