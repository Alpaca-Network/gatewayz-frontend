"""
Enhanced Model Availability Service

This service provides improved reliability for model availability by:
1. Implementing circuit breaker patterns
2. Providing fallback mechanisms
3. Caching availability status
4. Integrating with health monitoring
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class AvailabilityStatus(str, Enum):
    """Model availability status"""

    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"


class CircuitBreakerState(str, Enum):
    """Circuit breaker states"""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, requests blocked
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class ModelAvailability:
    """Model availability information"""

    model_id: str
    provider: str
    gateway: str
    status: AvailabilityStatus
    last_checked: datetime
    success_rate: float
    response_time_ms: float | None
    error_count: int
    circuit_breaker_state: CircuitBreakerState
    fallback_models: list[str]
    maintenance_until: datetime | None = None
    error_message: str | None = None


@dataclass
class AvailabilityConfig:
    """Configuration for availability monitoring"""

    check_interval: int = 60  # seconds
    failure_threshold: int = 5  # failures before circuit opens
    recovery_timeout: int = 300  # seconds before trying half-open
    success_threshold: int = 3  # successes to close circuit
    response_timeout: int = 30  # seconds
    cache_ttl: int = 300  # seconds


class CircuitBreaker:
    """Circuit breaker implementation for model availability"""

    def __init__(
        self, failure_threshold: int = 5, recovery_timeout: int = 300, success_threshold: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = CircuitBreakerState.CLOSED

    def can_execute(self) -> bool:
        """Check if request can be executed"""
        if self.state == CircuitBreakerState.CLOSED:
            return True
        elif self.state == CircuitBreakerState.OPEN:
            if (
                self.last_failure_time
                and (time.time() - self.last_failure_time) > self.recovery_timeout
            ):
                self.state = CircuitBreakerState.HALF_OPEN
                self.success_count = 0
                return True
            return False
        elif self.state == CircuitBreakerState.HALF_OPEN:
            return True
        return False

    def record_success(self):
        """Record successful request"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitBreakerState.CLOSED
                self.failure_count = 0
        elif self.state == CircuitBreakerState.CLOSED:
            self.failure_count = max(0, self.failure_count - 1)

    def record_failure(self):
        """Record failed request"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
        elif self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.OPEN


class ModelAvailabilityService:
    """Enhanced model availability service"""

    def __init__(self):
        self.availability_cache: dict[str, ModelAvailability] = {}
        self.circuit_breakers: dict[str, CircuitBreaker] = {}
        self.fallback_mappings: dict[str, list[str]] = {}
        self.config = AvailabilityConfig()
        self.monitoring_active = False

        # Load fallback mappings
        self._load_fallback_mappings()

    def _load_fallback_mappings(self):
        """Load fallback model mappings"""
        # Define fallback mappings for common models
        self.fallback_mappings = {
            "gpt-4": ["gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet"],
            "gpt-4-turbo": ["gpt-4", "gpt-3.5-turbo", "claude-3-opus"],
            "gpt-3.5-turbo": ["gpt-4", "gpt-4-turbo", "claude-3-sonnet"],
            "claude-3-opus": ["gpt-4", "claude-3-sonnet", "gpt-4-turbo"],
            "claude-3-sonnet": ["claude-3-opus", "gpt-3.5-turbo", "gpt-4"],
            "llama-3-70b": ["llama-3-8b", "claude-3-sonnet", "gpt-3.5-turbo"],
            "llama-3-8b": ["llama-3-70b", "gpt-3.5-turbo", "claude-3-sonnet"],
        }

    async def start_monitoring(self):
        """Start availability monitoring"""
        if self.monitoring_active:
            return

        self.monitoring_active = True
        logger.info("Starting model availability monitoring")

        # Start monitoring loop
        asyncio.create_task(self._monitoring_loop())

    async def stop_monitoring(self):
        """Stop availability monitoring"""
        self.monitoring_active = False
        logger.info("Stopped model availability monitoring")

    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                await self._check_model_availability()
                await asyncio.sleep(self.config.check_interval)
            except Exception as e:
                logger.error(f"Error in availability monitoring loop: {e}", exc_info=True)
                await asyncio.sleep(60)

    async def _check_model_availability(self):
        """Check availability of all models"""
        try:
            # Get models from health monitor
            from src.services.model_health_monitor import health_monitor

            models_health = health_monitor.get_all_models_health()

            for model_health in models_health:
                await self._update_model_availability(model_health)

        except Exception as e:
            logger.error(f"Failed to check model availability: {e}")

    async def _update_model_availability(self, model_health):
        """Update availability for a specific model"""
        model_key = f"{model_health.gateway}:{model_health.model_id}"

        # Determine availability status
        if model_health.status.value == "healthy":
            availability_status = AvailabilityStatus.AVAILABLE
        elif model_health.status.value == "degraded":
            availability_status = AvailabilityStatus.DEGRADED
        elif model_health.status.value == "unhealthy":
            availability_status = AvailabilityStatus.UNAVAILABLE
        else:
            availability_status = AvailabilityStatus.UNKNOWN

        # Get or create circuit breaker
        if model_key not in self.circuit_breakers:
            self.circuit_breakers[model_key] = CircuitBreaker(
                failure_threshold=self.config.failure_threshold,
                recovery_timeout=self.config.recovery_timeout,
                success_threshold=self.config.success_threshold,
            )

        circuit_breaker = self.circuit_breakers[model_key]

        # Update circuit breaker based on health
        if availability_status == AvailabilityStatus.AVAILABLE:
            circuit_breaker.record_success()
        else:
            circuit_breaker.record_failure()

        # Get fallback models
        fallback_models = self.fallback_mappings.get(model_health.model_id, [])

        # Create or update availability record
        availability = ModelAvailability(
            model_id=model_health.model_id,
            provider=model_health.provider,
            gateway=model_health.gateway,
            status=availability_status,
            last_checked=datetime.now(timezone.utc),
            success_rate=model_health.success_rate,
            response_time_ms=model_health.response_time_ms,
            error_count=model_health.error_count,
            circuit_breaker_state=circuit_breaker.state,
            fallback_models=fallback_models,
            error_message=model_health.error_message,
        )

        self.availability_cache[model_key] = availability

    def get_model_availability(
        self, model_id: str, gateway: str = None
    ) -> ModelAvailability | None:
        """Get availability for a specific model"""
        if gateway:
            model_key = f"{gateway}:{model_id}"
            return self.availability_cache.get(model_key)
        else:
            # Search across all gateways
            for _key, availability in self.availability_cache.items():
                if availability.model_id == model_id:
                    return availability
            return None

    def get_available_models(
        self, gateway: str = None, provider: str = None
    ) -> list[ModelAvailability]:
        """Get all available models"""
        available = []

        for availability in self.availability_cache.values():
            if availability.status == AvailabilityStatus.AVAILABLE:
                if gateway and availability.gateway != gateway:
                    continue
                if provider and availability.provider != provider:
                    continue
                available.append(availability)

        return available

    def get_fallback_models(self, model_id: str) -> list[str]:
        """Get fallback models for a given model"""
        return self.fallback_mappings.get(model_id, [])

    def is_model_available(self, model_id: str, gateway: str = None) -> bool:
        """Check if a model is available"""
        availability = self.get_model_availability(model_id, gateway)
        if not availability:
            return False

        # Check circuit breaker
        if availability.circuit_breaker_state == CircuitBreakerState.OPEN:
            return False

        # Check maintenance
        if availability.maintenance_until and availability.maintenance_until > datetime.now(timezone.utc):
            return False

        return availability.status == AvailabilityStatus.AVAILABLE

    def get_best_available_model(self, preferred_model: str, gateway: str = None) -> str | None:
        """Get the best available model, with fallbacks"""
        # Check if preferred model is available
        if self.is_model_available(preferred_model, gateway):
            return preferred_model

        # Try fallback models
        fallback_models = self.get_fallback_models(preferred_model)
        for fallback in fallback_models:
            if self.is_model_available(fallback, gateway):
                return fallback

        # Find any available model from the same provider
        preferred_availability = self.get_model_availability(preferred_model, gateway)
        if preferred_availability:
            provider = preferred_availability.provider
            available_models = self.get_available_models(gateway, provider)
            if available_models:
                return available_models[0].model_id

        return None

    def get_availability_summary(self) -> dict[str, Any]:
        """Get availability summary"""
        total_models = len(self.availability_cache)
        available_models = len(
            [
                a
                for a in self.availability_cache.values()
                if a.status == AvailabilityStatus.AVAILABLE
            ]
        )
        degraded_models = len(
            [a for a in self.availability_cache.values() if a.status == AvailabilityStatus.DEGRADED]
        )
        unavailable_models = len(
            [
                a
                for a in self.availability_cache.values()
                if a.status == AvailabilityStatus.UNAVAILABLE
            ]
        )

        # Group by gateway
        gateway_stats = {}
        for availability in self.availability_cache.values():
            gateway = availability.gateway
            if gateway not in gateway_stats:
                gateway_stats[gateway] = {
                    "total": 0,
                    "available": 0,
                    "degraded": 0,
                    "unavailable": 0,
                }

            gateway_stats[gateway]["total"] += 1
            if availability.status == AvailabilityStatus.AVAILABLE:
                gateway_stats[gateway]["available"] += 1
            elif availability.status == AvailabilityStatus.DEGRADED:
                gateway_stats[gateway]["degraded"] += 1
            else:
                gateway_stats[gateway]["unavailable"] += 1

        return {
            "total_models": total_models,
            "available_models": available_models,
            "degraded_models": degraded_models,
            "unavailable_models": unavailable_models,
            "availability_percentage": (
                (available_models / total_models * 100) if total_models > 0 else 0
            ),
            "gateway_stats": gateway_stats,
            "monitoring_active": self.monitoring_active,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    def set_maintenance_mode(self, model_id: str, gateway: str, until: datetime):
        """Set maintenance mode for a model"""
        model_key = f"{gateway}:{model_id}"
        if model_key in self.availability_cache:
            self.availability_cache[model_key].maintenance_until = until
            self.availability_cache[model_key].status = AvailabilityStatus.MAINTENANCE

    def clear_maintenance_mode(self, model_id: str, gateway: str):
        """Clear maintenance mode for a model"""
        model_key = f"{gateway}:{model_id}"
        if model_key in self.availability_cache:
            self.availability_cache[model_key].maintenance_until = None
            # Status will be updated by next health check


# Global availability service instance
availability_service = ModelAvailabilityService()
