"""
Models package for health monitoring and availability
"""

# Import new health models
from .health_models import (
    HealthStatus,
    ProviderStatus,
    ModelHealthResponse,
    ProviderHealthResponse,
    SystemHealthResponse,
    HealthSummaryResponse,
    ModelAvailabilityRequest,
    ProviderAvailabilityRequest,
    HealthCheckRequest,
    UptimeMetricsResponse,
    ModelStatusResponse,
    ProviderStatusResponse,
    HealthDashboardResponse
)

# Import existing models
from .image_models import (
    ImageGenerationRequest,
    ImageGenerationResponse,
    ImageData
)

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
    "HealthDashboardResponse"
]
