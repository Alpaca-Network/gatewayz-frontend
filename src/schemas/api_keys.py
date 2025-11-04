from datetime import datetime

from pydantic import BaseModel


class CreateApiKeyRequest(BaseModel):
    key_name: str
    environment_tag: str = "live"
    scope_permissions: dict[str, list[str]] | None = None
    expiration_days: int | None = None
    max_requests: int | None = None
    ip_allowlist: list[str] | None = None
    domain_referrers: list[str] | None = None
    action: str = "create"


class ApiKeyResponse(BaseModel):
    id: int
    api_key: str
    key_name: str
    environment_tag: str
    scope_permissions: dict[str, list[str]]
    is_active: bool
    is_primary: bool
    expiration_date: str | None = None
    days_remaining: int | None = None
    max_requests: int | None = None
    requests_used: int
    requests_remaining: int | None = None
    usage_percentage: float | None = None
    ip_allowlist: list[str]
    domain_referrers: list[str]
    created_at: str | None = None
    updated_at: str | None = None
    last_used_at: str | None = None


class ListApiKeysResponse(BaseModel):
    status: str
    total_keys: int
    keys: list[ApiKeyResponse]


class DeleteApiKeyRequest(BaseModel):
    confirmation: str = "DELETE"


class DeleteApiKeyResponse(BaseModel):
    status: str
    message: str
    deleted_key_id: int
    timestamp: str


class UpdateApiKeyRequest(BaseModel):
    key_name: str | None = None
    scope_permissions: dict[str, list[str]] | None = None
    expiration_days: int | None = None
    max_requests: int | None = None
    ip_allowlist: list[str] | None = None
    domain_referrers: list[str] | None = None
    is_active: bool | None = None
    action: str | None = None
    environment_tag: str | None = None


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
    last_request_time: str | None = None
    is_active: bool
