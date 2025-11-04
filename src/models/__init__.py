"""
Models package for health monitoring and availability
"""

# Import new health models
from .health_models import (
    HealthCheckRequest,
    HealthDashboardResponse,
    HealthStatus,
    HealthSummaryResponse,
    ModelAvailabilityRequest,
    ModelHealthResponse,
    ModelStatusResponse,
    ProviderAvailabilityRequest,
    ProviderHealthResponse,
    ProviderStatus,
    ProviderStatusResponse,
    SystemHealthResponse,
    UptimeMetricsResponse,
)

# Import existing models
from .image_models import ImageData, ImageGenerationRequest, ImageGenerationResponse

__all__ = [
    # Existing models
    "ImageGenerationRequest",
    "ImageGenerationResponse",
    "ImageData",
    # Health models
    "HealthStatus",
    "ProviderStatus",
    "ModelHealthResponse",
    "ProviderHealthResponse",
    "SystemHealthResponse",
    "HealthSummaryResponse",
    "ModelAvailabilityRequest",
    "ProviderAvailabilityRequest",
    "HealthCheckRequest",
    "UptimeMetricsResponse",
    "ModelStatusResponse",
    "ProviderStatusResponse",
    "HealthDashboardResponse",
]
