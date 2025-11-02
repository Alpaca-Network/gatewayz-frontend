"""
Data models for health monitoring and availability status
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class HealthStatus(str, Enum):
    """Health status enumeration"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    MAINTENANCE = "maintenance"


class ProviderStatus(str, Enum):
    """Provider status enumeration"""

    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"


class ModelHealthResponse(BaseModel):
    """Health metrics for a specific model"""

    model_config = ConfigDict(protected_namespaces=())

    model_id: str = Field(..., description="Unique model identifier")
    provider: str = Field(..., description="Provider name")
    gateway: str = Field(..., description="Gateway name")
    status: HealthStatus = Field(..., description="Current health status")
    response_time_ms: float | None = Field(None, description="Last response time in milliseconds")
    success_rate: float = Field(0.0, description="Success rate percentage (0-100)")
    last_checked: datetime | None = Field(None, description="Last health check timestamp")
    last_success: datetime | None = Field(None, description="Last successful request timestamp")
    last_failure: datetime | None = Field(None, description="Last failed request timestamp")
    error_count: int = Field(0, description="Total error count")
    total_requests: int = Field(0, description="Total request count")
    avg_response_time_ms: float | None = Field(
        None, description="Average response time in milliseconds"
    )
    uptime_percentage: float = Field(0.0, description="Uptime percentage (0-100)")
    error_message: str | None = Field(None, description="Last error message")


class ProviderHealthResponse(BaseModel):
    """Health metrics for a provider"""

    provider: str = Field(..., description="Provider name")
    gateway: str = Field(..., description="Gateway name")
    status: ProviderStatus = Field(..., description="Current provider status")
    total_models: int = Field(0, description="Total number of models")
    healthy_models: int = Field(0, description="Number of healthy models")
    degraded_models: int = Field(0, description="Number of degraded models")
    unhealthy_models: int = Field(0, description="Number of unhealthy models")
    avg_response_time_ms: float | None = Field(
        None, description="Average response time in milliseconds"
    )
    overall_uptime: float = Field(0.0, description="Overall uptime percentage (0-100)")
    last_checked: datetime | None = Field(None, description="Last health check timestamp")
    error_message: str | None = Field(None, description="Last error message")


class SystemHealthResponse(BaseModel):
    """Overall system health metrics"""

    overall_status: HealthStatus = Field(..., description="Overall system status")
    total_providers: int = Field(0, description="Total number of providers")
    healthy_providers: int = Field(0, description="Number of healthy providers")
    degraded_providers: int = Field(0, description="Number of degraded providers")
    unhealthy_providers: int = Field(0, description="Number of unhealthy providers")
    total_models: int = Field(0, description="Total number of models")
    healthy_models: int = Field(0, description="Number of healthy models")
    degraded_models: int = Field(0, description="Number of degraded models")
    unhealthy_models: int = Field(0, description="Number of unhealthy models")
    system_uptime: float = Field(0.0, description="System uptime percentage (0-100)")
    last_updated: datetime | None = Field(None, description="Last update timestamp")


class HealthSummaryResponse(BaseModel):
    """Comprehensive health summary"""

    system: SystemHealthResponse | None = Field(None, description="System health metrics")
    providers: list[ProviderHealthResponse] = Field(
        default_factory=list, description="Provider health metrics"
    )
    models: list[ModelHealthResponse] = Field(
        default_factory=list, description="Model health metrics"
    )
    monitoring_active: bool = Field(False, description="Whether monitoring is active")
    last_check: datetime = Field(..., description="Last health check timestamp")


class ModelAvailabilityRequest(BaseModel):
    """Request to check model availability"""

    model_config = ConfigDict(protected_namespaces=())

    model_id: str = Field(..., description="Model ID to check")
    gateway: str | None = Field(None, description="Specific gateway to check (optional)")


class ProviderAvailabilityRequest(BaseModel):
    """Request to check provider availability"""

    provider: str = Field(..., description="Provider name to check")
    gateway: str | None = Field(None, description="Specific gateway to check (optional)")


class HealthCheckRequest(BaseModel):
    """Request to perform health check"""

    models: list[str] | None = Field(None, description="Specific models to check (optional)")
    providers: list[str] | None = Field(None, description="Specific providers to check (optional)")
    gateways: list[str] | None = Field(None, description="Specific gateways to check (optional)")
    force_refresh: bool = Field(False, description="Force immediate health check")


class UptimeMetricsResponse(BaseModel):
    """Uptime metrics for frontend integration"""

    status: str = Field(..., description="Current status")
    uptime_percentage: float = Field(..., description="Uptime percentage")
    response_time_avg: float | None = Field(None, description="Average response time")
    last_incident: datetime | None = Field(None, description="Last incident timestamp")
    total_requests: int = Field(0, description="Total requests processed")
    successful_requests: int = Field(0, description="Successful requests")
    failed_requests: int = Field(0, description="Failed requests")
    error_rate: float = Field(0.0, description="Error rate percentage")
    last_updated: datetime = Field(..., description="Last update timestamp")


class ModelStatusResponse(BaseModel):
    """Model status for frontend display"""

    model_config = ConfigDict(protected_namespaces=())

    model_id: str = Field(..., description="Model ID")
    name: str = Field(..., description="Model name")
    provider: str = Field(..., description="Provider name")
    status: str = Field(..., description="Status indicator")
    status_color: str = Field(..., description="Status color for UI")
    response_time: str | None = Field(None, description="Response time display")
    uptime: str = Field(..., description="Uptime percentage display")
    last_checked: str | None = Field(None, description="Last checked display")


class ProviderStatusResponse(BaseModel):
    """Provider status for frontend display"""

    provider: str = Field(..., description="Provider name")
    gateway: str = Field(..., description="Gateway name")
    status: str = Field(..., description="Status indicator")
    status_color: str = Field(..., description="Status color for UI")
    models_count: int = Field(0, description="Number of models")
    healthy_count: int = Field(0, description="Number of healthy models")
    uptime: str = Field(..., description="Uptime percentage display")
    avg_response_time: str | None = Field(None, description="Average response time display")


class HealthDashboardResponse(BaseModel):
    """Complete health dashboard data"""

    system_status: SystemHealthResponse = Field(..., description="System status")
    providers: list[ProviderStatusResponse] = Field(
        default_factory=list, description="Provider statuses"
    )
    models: list[ModelStatusResponse] = Field(default_factory=list, description="Model statuses")
    uptime_metrics: UptimeMetricsResponse = Field(..., description="Uptime metrics")
    last_updated: datetime = Field(..., description="Last update timestamp")
    monitoring_active: bool = Field(False, description="Monitoring status")
