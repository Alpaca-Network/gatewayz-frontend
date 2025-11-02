"""
Model Health Monitoring Service

This service provides comprehensive monitoring of model availability, performance,
and health status across all providers and gateways.
"""

import asyncio
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


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


@dataclass
class ModelHealthMetrics:
    """Health metrics for a specific model"""

    model_id: str
    provider: str
    gateway: str
    status: HealthStatus
    response_time_ms: float | None = None
    success_rate: float = 0.0
    last_checked: datetime | None = None
    last_success: datetime | None = None
    last_failure: datetime | None = None
    error_count: int = 0
    total_requests: int = 0
    avg_response_time_ms: float | None = None
    uptime_percentage: float = 0.0
    error_message: str | None = None


@dataclass
class ProviderHealthMetrics:
    """Health metrics for a provider"""

    provider: str
    gateway: str
    status: ProviderStatus
    total_models: int = 0
    healthy_models: int = 0
    degraded_models: int = 0
    unhealthy_models: int = 0
    avg_response_time_ms: float | None = None
    overall_uptime: float = 0.0
    last_checked: datetime | None = None
    error_message: str | None = None


@dataclass
class SystemHealthMetrics:
    """Overall system health metrics"""

    overall_status: HealthStatus
    total_providers: int = 0
    healthy_providers: int = 0
    degraded_providers: int = 0
    unhealthy_providers: int = 0
    total_models: int = 0
    healthy_models: int = 0
    degraded_models: int = 0
    unhealthy_models: int = 0
    system_uptime: float = 0.0
    last_updated: datetime | None = None


class ModelHealthMonitor:
    """Main health monitoring service"""

    def __init__(self):
        self.health_data: dict[str, ModelHealthMetrics] = {}
        self.provider_data: dict[str, ProviderHealthMetrics] = {}
        self.system_data: SystemHealthMetrics | None = None
        self.monitoring_active = False
        self.check_interval = 300  # 5 minutes
        self.timeout = 30  # 30 seconds
        self.health_threshold = 0.95  # 95% success rate threshold
        self.response_time_threshold = 10000  # 10 seconds

        # Test payload for health checks
        self.test_payload = {
            "messages": [{"role": "user", "content": "Health check - respond with 'OK'"}],
            "max_tokens": 10,
            "temperature": 0.1,
        }

    async def start_monitoring(self):
        """Start the health monitoring service"""
        if self.monitoring_active:
            logger.warning("Health monitoring is already active")
            return

        self.monitoring_active = True
        logger.info("Starting model health monitoring service")

        # Start monitoring loop
        asyncio.create_task(self._monitoring_loop())

    async def stop_monitoring(self):
        """Stop the health monitoring service"""
        self.monitoring_active = False
        logger.info("Stopped model health monitoring service")

    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}", exc_info=True)
                await asyncio.sleep(60)  # Wait 1 minute before retrying

    async def _perform_health_checks(self):
        """Perform health checks on all models"""
        logger.info("Performing health checks on all models")

        # Get all available models from different gateways
        models_to_check = await self._get_models_to_check()

        # Perform health checks in parallel
        tasks = []
        for model in models_to_check:
            task = asyncio.create_task(self._check_model_health(model))
            tasks.append(task)

        # Wait for all checks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Health check failed for model {models_to_check[i]['id']}: {result}")
            else:
                self._update_health_data(result)

        # Update provider and system metrics
        await self._update_provider_metrics()
        await self._update_system_metrics()

        logger.info(f"Health checks completed. Checked {len(models_to_check)} models")

    async def _get_models_to_check(self) -> list[dict[str, Any]]:
        """Get list of models to check for health monitoring"""
        models = []

        try:
            # Import here to avoid circular imports
            from src.services.models import get_cached_models

            # Get models from different gateways
            gateways = [
                "openrouter",
                "portkey",
                "featherless",
                "deepinfra",
                "huggingface",
                "groq",
                "fireworks",
                "together",
                "xai",
                "novita",
                "chutes",
                "aimo",
                "near",
            ]

            for gateway in gateways:
                try:
                    gateway_models = get_cached_models(gateway)
                    if gateway_models:
                        for model in gateway_models[
                            :5
                        ]:  # Limit to top 5 models per gateway for health checking
                            models.append(
                                {
                                    "id": model.get("id"),
                                    "provider": model.get("provider_slug", "unknown"),
                                    "gateway": gateway,
                                    "name": model.get("name", model.get("id")),
                                }
                            )
                except Exception as e:
                    logger.warning(f"Failed to get models from {gateway}: {e}")

        except Exception as e:
            logger.error(f"Failed to get models for health checking: {e}")

        return models

    async def _check_model_health(self, model: dict[str, Any]) -> ModelHealthMetrics | None:
        """Check health of a specific model"""
        model_id = model["id"]
        provider = model["provider"]
        gateway = model["gateway"]

        start_time = time.time()
        status = HealthStatus.UNKNOWN
        response_time_ms = None
        error_message = None

        try:
            # Perform a simple health check request
            health_check_result = await self._perform_model_request(model_id, gateway)

            if health_check_result["success"]:
                status = HealthStatus.HEALTHY
                response_time_ms = (time.time() - start_time) * 1000
            else:
                status = HealthStatus.UNHEALTHY
                error_message = health_check_result.get("error", "Unknown error")

        except Exception as e:
            status = HealthStatus.UNHEALTHY
            error_message = str(e)
            logger.warning(f"Health check failed for {model_id}: {e}")

        # Create health metrics
        health_metrics = ModelHealthMetrics(
            model_id=model_id,
            provider=provider,
            gateway=gateway,
            status=status,
            response_time_ms=response_time_ms,
            last_checked=datetime.now(timezone.utc),
            error_message=error_message,
        )

        return health_metrics

    async def _perform_model_request(self, model_id: str, gateway: str) -> dict[str, Any]:
        """Perform a real test request to a model"""
        try:
            import httpx

            # Create a simple test request based on the gateway
            test_payload = {
                "model": model_id,
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 10,
                "temperature": 0.1,
            }

            # Get the appropriate endpoint URL based on gateway
            endpoint_urls = {
                "openrouter": "https://openrouter.ai/api/v1/chat/completions",
                "portkey": "https://api.portkey.ai/v1/chat/completions",
                "featherless": "https://api.featherless.ai/v1/chat/completions",
                "deepinfra": "https://api.deepinfra.com/v1/openai/chat/completions",
                "huggingface": "https://api-inference.huggingface.co/models/" + model_id,
                "groq": "https://api.groq.com/openai/v1/chat/completions",
                "fireworks": "https://api.fireworks.ai/inference/v1/chat/completions",
                "together": "https://api.together.xyz/v1/chat/completions",
                "xai": "https://api.x.ai/v1/chat/completions",
                "novita": "https://api.novita.ai/v3/openai/chat/completions",
            }

            url = endpoint_urls.get(gateway)
            if not url:
                return {
                    "success": False,
                    "error": f"Unknown gateway: {gateway}",
                    "status_code": 400,
                }

            # Set up headers based on gateway
            headers = {"Content-Type": "application/json", "User-Agent": "HealthMonitor/1.0"}

            # For HuggingFace, use a different payload format
            if gateway == "huggingface":
                test_payload = {
                    "inputs": "Hello",
                    "parameters": {"max_new_tokens": 10, "temperature": 0.1},
                }

            # Perform the actual HTTP request
            async with httpx.AsyncClient(timeout=30.0) as client:
                start_time = time.time()

                try:
                    response = await client.post(url, headers=headers, json=test_payload)

                    response_time = (time.time() - start_time) * 1000

                    if response.status_code == 200:
                        return {
                            "success": True,
                            "response_time": response_time,
                            "status_code": response.status_code,
                            "response_data": response.json() if response.content else None,
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"HTTP {response.status_code}: {response.text[:200]}",
                            "status_code": response.status_code,
                            "response_time": response_time,
                        }

                except httpx.TimeoutException:
                    return {
                        "success": False,
                        "error": "Request timeout",
                        "status_code": 408,
                        "response_time": (time.time() - start_time) * 1000,
                    }
                except httpx.RequestError as e:
                    return {
                        "success": False,
                        "error": f"Request error: {str(e)}",
                        "status_code": 500,
                        "response_time": (time.time() - start_time) * 1000,
                    }

        except Exception as e:
            logger.error(f"Health check request failed for {model_id} via {gateway}: {e}")
            return {"success": False, "error": str(e), "status_code": 500}

    def _update_health_data(self, health_metrics: ModelHealthMetrics):
        """Update health data for a model"""
        if not health_metrics:
            return

        model_key = f"{health_metrics.gateway}:{health_metrics.model_id}"

        # Update or create health data
        if model_key in self.health_data:
            existing = self.health_data[model_key]

            # Update metrics
            existing.status = health_metrics.status
            existing.response_time_ms = health_metrics.response_time_ms
            existing.last_checked = health_metrics.last_checked
            existing.error_message = health_metrics.error_message

            # Update success/failure tracking
            if health_metrics.status == HealthStatus.HEALTHY:
                existing.last_success = health_metrics.last_checked
                existing.total_requests += 1
            else:
                existing.last_failure = health_metrics.last_checked
                existing.error_count += 1
                existing.total_requests += 1

            # Calculate success rate
            if existing.total_requests > 0:
                existing.success_rate = (
                    existing.total_requests - existing.error_count
                ) / existing.total_requests

            # Calculate uptime percentage
            existing.uptime_percentage = existing.success_rate * 100

            # Update average response time
            if health_metrics.response_time_ms:
                if existing.avg_response_time_ms:
                    existing.avg_response_time_ms = (
                        existing.avg_response_time_ms + health_metrics.response_time_ms
                    ) / 2
                else:
                    existing.avg_response_time_ms = health_metrics.response_time_ms

        else:
            # Create new health data
            self.health_data[model_key] = health_metrics

    async def _update_provider_metrics(self):
        """Update provider-level health metrics"""
        provider_stats = {}

        for _model_key, health_data in self.health_data.items():
            provider = health_data.provider
            gateway = health_data.gateway
            provider_key = f"{gateway}:{provider}"

            if provider_key not in provider_stats:
                provider_stats[provider_key] = {
                    "provider": provider,
                    "gateway": gateway,
                    "total_models": 0,
                    "healthy_models": 0,
                    "degraded_models": 0,
                    "unhealthy_models": 0,
                    "response_times": [],
                    "success_rates": [],
                }

            stats = provider_stats[provider_key]
            stats["total_models"] += 1

            if health_data.status == HealthStatus.HEALTHY:
                stats["healthy_models"] += 1
            elif health_data.status == HealthStatus.DEGRADED:
                stats["degraded_models"] += 1
            else:
                stats["unhealthy_models"] += 1

            if health_data.response_time_ms:
                stats["response_times"].append(health_data.response_time_ms)

            stats["success_rates"].append(health_data.success_rate)

        # Create provider health metrics
        for provider_key, stats in provider_stats.items():
            # Calculate overall status
            if stats["unhealthy_models"] == 0:
                status = ProviderStatus.ONLINE
            elif stats["unhealthy_models"] < stats["total_models"] * 0.5:
                status = ProviderStatus.DEGRADED
            else:
                status = ProviderStatus.OFFLINE

            # Calculate average response time
            avg_response_time = None
            if stats["response_times"]:
                avg_response_time = sum(stats["response_times"]) / len(stats["response_times"])

            # Calculate overall uptime
            overall_uptime = 0.0
            if stats["success_rates"]:
                overall_uptime = sum(stats["success_rates"]) / len(stats["success_rates"]) * 100

            provider_metrics = ProviderHealthMetrics(
                provider=stats["provider"],
                gateway=stats["gateway"],
                status=status,
                total_models=stats["total_models"],
                healthy_models=stats["healthy_models"],
                degraded_models=stats["degraded_models"],
                unhealthy_models=stats["unhealthy_models"],
                avg_response_time_ms=avg_response_time,
                overall_uptime=overall_uptime,
                last_checked=datetime.now(timezone.utc),
            )

            self.provider_data[provider_key] = provider_metrics

    async def _update_system_metrics(self):
        """Update system-level health metrics"""
        total_providers = len(self.provider_data)
        healthy_providers = sum(
            1 for p in self.provider_data.values() if p.status == ProviderStatus.ONLINE
        )
        degraded_providers = sum(
            1 for p in self.provider_data.values() if p.status == ProviderStatus.DEGRADED
        )
        unhealthy_providers = sum(
            1 for p in self.provider_data.values() if p.status == ProviderStatus.OFFLINE
        )

        total_models = len(self.health_data)
        healthy_models = sum(
            1 for m in self.health_data.values() if m.status == HealthStatus.HEALTHY
        )
        degraded_models = sum(
            1 for m in self.health_data.values() if m.status == HealthStatus.DEGRADED
        )
        unhealthy_models = sum(
            1 for m in self.health_data.values() if m.status == HealthStatus.UNHEALTHY
        )

        # Calculate overall system status
        if unhealthy_providers == 0:
            overall_status = HealthStatus.HEALTHY
        elif unhealthy_providers < total_providers * 0.5:
            overall_status = HealthStatus.DEGRADED
        else:
            overall_status = HealthStatus.UNHEALTHY

        # Calculate system uptime
        system_uptime = 0.0
        if total_models > 0:
            system_uptime = (healthy_models / total_models) * 100

        self.system_data = SystemHealthMetrics(
            overall_status=overall_status,
            total_providers=total_providers,
            healthy_providers=healthy_providers,
            degraded_providers=degraded_providers,
            unhealthy_providers=unhealthy_providers,
            total_models=total_models,
            healthy_models=healthy_models,
            degraded_models=degraded_models,
            unhealthy_models=unhealthy_models,
            system_uptime=system_uptime,
            last_updated=datetime.now(timezone.utc),
        )

    def get_model_health(self, model_id: str, gateway: str = None) -> ModelHealthMetrics | None:
        """Get health metrics for a specific model"""
        if gateway:
            model_key = f"{gateway}:{model_id}"
            return self.health_data.get(model_key)
        else:
            # Search across all gateways
            for _key, health_data in self.health_data.items():
                if health_data.model_id == model_id:
                    return health_data
            return None

    def get_provider_health(
        self, provider: str, gateway: str = None
    ) -> ProviderHealthMetrics | None:
        """Get health metrics for a specific provider"""
        if gateway:
            provider_key = f"{gateway}:{provider}"
            return self.provider_data.get(provider_key)
        else:
            # Search across all gateways
            for _key, provider_data in self.provider_data.items():
                if provider_data.provider == provider:
                    return provider_data
            return None

    def get_system_health(self) -> SystemHealthMetrics | None:
        """Get overall system health metrics"""
        return self.system_data

    def get_all_models_health(self, gateway: str = None) -> list[ModelHealthMetrics]:
        """Get health metrics for all models"""
        if gateway:
            return [h for h in self.health_data.values() if h.gateway == gateway]
        else:
            return list(self.health_data.values())

    def get_all_providers_health(self, gateway: str = None) -> list[ProviderHealthMetrics]:
        """Get health metrics for all providers"""
        if gateway:
            return [p for p in self.provider_data.values() if p.gateway == gateway]
        else:
            return list(self.provider_data.values())

    def get_health_summary(self) -> dict[str, Any]:
        """Get a comprehensive health summary"""
        return {
            "system": asdict(self.system_data) if self.system_data else None,
            "providers": [asdict(p) for p in self.provider_data.values()],
            "models": [asdict(m) for m in self.health_data.values()],
            "monitoring_active": self.monitoring_active,
            "last_check": datetime.now(timezone.utc).isoformat(),
        }


# Global health monitor instance
health_monitor = ModelHealthMonitor()
