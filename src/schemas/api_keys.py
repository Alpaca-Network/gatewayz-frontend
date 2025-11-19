from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


class CreateApiKeyRequest(BaseModel):
    key_name: str
    environment_tag: str = "live"
    scope_permissions: Optional[Dict[str, List[str]]] = None
    expiration_days: Optional[int] = None
    max_requests: Optional[int] = None
    ip_allowlist: Optional[List[str]] = None
    domain_referrers: Optional[List[str]] = None
    action: str = "create"


class ApiKeyResponse(BaseModel):
    id: int
    api_key: str
    key_name: str
    environment_tag: str
    scope_permissions: Dict[str, List[str]]
    is_active: bool
    is_primary: bool
    expiration_date: Optional[str] = None
    days_remaining: Optional[int] = None
    max_requests: Optional[int] = None
    requests_used: int
    requests_remaining: Optional[int] = None
    usage_percentage: Optional[float] = None
    ip_allowlist: List[str]
    domain_referrers: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_used_at: Optional[str] = None


class ListApiKeysResponse(BaseModel):
    status: str
    total_keys: int
    keys: List[ApiKeyResponse]


class DeleteApiKeyRequest(BaseModel):
    confirmation: str = "DELETE"


class DeleteApiKeyResponse(BaseModel):
    status: str
    message: str
    deleted_key_id: int
    timestamp: str


class UpdateApiKeyRequest(BaseModel):
    key_name: Optional[str] = None
    scope_permissions: Optional[Dict[str, List[str]]] = None
    expiration_days: Optional[int] = None
    max_requests: Optional[int] = None
    ip_allowlist: Optional[List[str]] = None
    domain_referrers: Optional[List[str]] = None
    is_active: Optional[bool] = None
    action: Optional[str] = None
    environment_tag: Optional[str] = None


class UpdateApiKeyResponse(BaseModel):
    status: str
    message: str
    updated_key: ApiKeyResponse
    timestamp: datetime


class ApiKeyUsageResponse(BaseModel):
    api_key: str
    key_name: str
    total_requests: int
    total_tokens: int
    total_cost: float
    requests_today: int
    tokens_today: int
    cost_today: float
    last_request_time: Optional[str] = None
    is_active: bool
