from datetime import datetime

from pydantic import BaseModel, EmailStr

from src.schemas.common import AuthMethod


class PrivyLinkedAccount(BaseModel):
    type: str
    subject: str | None = None
    email: str | None = None
    name: str | None = None
    verified_at: int | None = None
    first_verified_at: int | None = None
    latest_verified_at: int | None = None


class PrivyUserData(BaseModel):
    id: str
    created_at: int
    linked_accounts: list[PrivyLinkedAccount] = []
    mfa_methods: list[str] = []
    has_accepted_terms: bool = False
    is_guest: bool = False


class PrivySignupRequest(BaseModel):
    privy_user_id: str
    auth_method: AuthMethod
    email: EmailStr | None = None
    username: str | None = None
    display_name: str | None = None
    gmail_address: EmailStr | None = None
    github_username: str | None = None


class PrivySigninRequest(BaseModel):
    privy_user_id: str
    auth_method: AuthMethod


class PrivyAuthRequest(BaseModel):
    user: PrivyUserData
    token: str
    email: str | None = None  # Optional top-level email field for frontend to send
    privy_access_token: str | None = None
    refresh_token: str | None = None
    session_update_action: str | None = None
    is_new_user: bool | None = None
    referral_code: str | None = None  # Referral code if user signed up with one


class PrivyAuthResponse(BaseModel):
    success: bool
    message: str
    user_id: int | None = None
    api_key: str | None = None
    auth_method: AuthMethod | None = None
    privy_user_id: str | None = None
    is_new_user: bool | None = None
    display_name: str | None = None
    email: str | None = None
    credits: float | None = None
    timestamp: datetime | None = None
