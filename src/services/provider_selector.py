"""
Provider Selector with Automatic Failover

This module implements intelligent provider selection and automatic failover
for multi-provider models. When a request fails, it automatically retries
with the next available provider.
"""

import logging
from typing import Optional, Any, Callable, Dict, List
from collections import defaultdict
from datetime import datetime, timedelta

from src.services.multi_provider_registry import (
    get_registry,
    ProviderConfig,
    MultiProviderModel,
)

logger = logging.getLogger(__name__)


class ProviderHealthTracker:
    """
    Track provider health and implement circuit breaker pattern.

    When a provider fails repeatedly, it can be temporarily disabled
    to avoid wasting time on dead providers.
    """

    def __init__(
        self,
        failure_threshold: int = 5,  # Failures before circuit opens
        timeout_seconds: int = 300,  # Time to wait before retry (5 minutes)
    ):
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds

        # Track failures per provider per model
        self._failures: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # Track when providers were disabled
        self._disabled_until: Dict[str, Dict[str, datetime]] = defaultdict(dict)

    def record_success(self, model_id: str, provider_name: str) -> None:
        """Record a successful request, resetting failure count"""
        if model_id in self._failures:
            self._failures[model_id][provider_name] = 0

        # Clear disabled state
        if model_id in self._disabled_until:
            if provider_name in self._disabled_until[model_id]:
                del self._disabled_until[model_id][provider_name]
                logger.info(f"Re-enabled {provider_name} for {model_id} after successful request")

    def record_failure(self, model_id: str, provider_name: str) -> bool:
        """
        Record a failed request.

        Returns:
            True if provider should be disabled (circuit opened), False otherwise
        """
        self._failures[model_id][provider_name] += 1
        failure_count = self._failures[model_id][provider_name]

        logger.warning(
            f"Provider {provider_name} failed for {model_id} "
            f"({failure_count}/{self.failure_threshold} failures)"
        )

        if failure_count >= self.failure_threshold:
            # Open circuit - disable provider temporarily
            disabled_until = datetime.now() + timedelta(seconds=self.timeout_seconds)
            self._disabled_until[model_id][provider_name] = disabled_until

            logger.error(
                f"Circuit breaker opened: Disabled {provider_name} for {model_id} "
                f"until {disabled_until.strftime('%H:%M:%S')} after {failure_count} failures"
            )
            return True

        return False

    def is_available(self, model_id: str, provider_name: str) -> bool:
        """Check if a provider is currently available (circuit closed)"""
        if model_id not in self._disabled_until:
            return True

        if provider_name not in self._disabled_until[model_id]:
            return True

        # Check if timeout has expired
        disabled_until = self._disabled_until[model_id][provider_name]
        if datetime.now() >= disabled_until:
            # Timeout expired, re-enable provider
            del self._disabled_until[model_id][provider_name]
            self._failures[model_id][provider_name] = 0
            logger.info(f"Circuit breaker closed: Re-enabled {provider_name} for {model_id}")
            return True

        return False


class ProviderSelector:
    """
    Intelligent provider selector with automatic failover.

    This class handles provider selection and implements automatic failover
    when requests fail. It uses the multi-provider registry to find available
    providers and tries them in priority order until one succeeds.
    """

    def __init__(self):
        self.registry = get_registry()
        if not self.registry.get_all_models():
            try:
                from src.services.google_models_config import initialize_google_models

                initialize_google_models()
            except Exception as exc:  # pragma: no cover - defensive guard
                logger.debug("Failed to initialize Google models for selector: %s", exc)
        self.health_tracker = ProviderHealthTracker()
        logger.info("Initialized ProviderSelector with automatic failover")

    def execute_with_failover(
        self,
        model_id: str,
        execute_fn: Callable[[str, str], Any],  # Function that takes (provider_name, model_id)
        preferred_provider: Optional[str] = None,
        required_features: Optional[List[str]] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """
        Execute a request with automatic failover to alternative providers.

        Args:
            model_id: The model to use
            execute_fn: Function to execute the request. Takes (provider_name, provider_model_id) and returns response
            preferred_provider: Optional preferred provider to try first
            required_features: Optional list of required features
            max_retries: Maximum number of providers to try

        Returns:
            Dict with:
                - success: bool - Whether the request succeeded
                - response: Any - The response from the provider (if successful)
                - provider: str - The provider that handled the request
                - error: str - Error message (if failed)
                - attempts: List[Dict] - List of attempts made

        Raises:
            Exception: If all providers fail
        """
        model = self.registry.get_model(model_id)
        if not model:
            # Model not in multi-provider registry, return error
            return {
                "success": False,
                "response": None,
                "provider": None,
                "error": f"Model {model_id} not found in multi-provider registry",
                "attempts": [],
            }

        # Select primary provider
        primary = self.registry.select_provider(
            model_id=model_id,
            preferred_provider=preferred_provider,
            required_features=required_features,
        )

        if not primary:
            return {
                "success": False,
                "response": None,
                "provider": None,
                "error": f"No suitable provider found for {model_id}",
                "attempts": [],
            }

        # Get list of providers to try (primary + fallbacks)
        providers_to_try = [primary]
        fallbacks = self.registry.get_fallback_providers(
            model_id=model_id,
            exclude_provider=primary.name,
        )
        providers_to_try.extend(fallbacks[:max_retries - 1])

        # Filter out providers that are circuit-broken
        providers_to_try = [
            p for p in providers_to_try
            if self.health_tracker.is_available(model_id, p.name)
        ]

        if not providers_to_try:
            return {
                "success": False,
                "response": None,
                "provider": None,
                "error": f"All providers for {model_id} are currently unavailable (circuit breakers open)",
                "attempts": [],
            }

        # Try providers in order
        attempts = []
        last_error = None

        for i, provider in enumerate(providers_to_try):
            attempt_info = {
                "provider": provider.name,
                "model_id": provider.model_id,
                "priority": provider.priority,
                "attempt_number": i + 1,
            }

            try:
                logger.info(
                    f"Attempt {i + 1}/{len(providers_to_try)}: "
                    f"Trying {provider.name} for {model_id} "
                    f"(provider model ID: {provider.model_id})"
                )

                # Execute request with this provider
                response = execute_fn(provider.name, provider.model_id)

                # Success!
                self.health_tracker.record_success(model_id, provider.name)

                attempt_info["success"] = True
                attempt_info["duration_ms"] = 0  # Could be tracked if needed
                attempts.append(attempt_info)

                logger.info(
                    f"✓ Request successful with {provider.name} for {model_id} "
                    f"(attempt {i + 1}/{len(providers_to_try)})"
                )

                return {
                    "success": True,
                    "response": response,
                    "provider": provider.name,
                    "provider_model_id": provider.model_id,
                    "error": None,
                    "attempts": attempts,
                }

            except Exception as e:
                # Request failed with this provider
                last_error = str(e)
                attempt_info["success"] = False
                attempt_info["error"] = last_error
                attempts.append(attempt_info)

                logger.warning(
                    f"✗ Request failed with {provider.name} for {model_id}: {last_error}"
                )

                # Record failure and check if circuit breaker should open
                should_disable = self.health_tracker.record_failure(model_id, provider.name)

                if should_disable:
                    # Disable this provider in the registry temporarily
                    self.registry.disable_provider(model_id, provider.name)

                # Continue to next provider
                continue

        # All providers failed
        logger.error(
            f"All {len(attempts)} providers failed for {model_id}. Last error: {last_error}"
        )

        return {
            "success": False,
            "response": None,
            "provider": None,
            "error": f"All providers failed. Last error: {last_error}",
            "attempts": attempts,
        }

    def get_model_providers(self, model_id: str) -> Optional[List[str]]:
        """Get list of provider names available for a model"""
        model = self.registry.get_model(model_id)
        if not model:
            return None

        return [p.name for p in model.get_enabled_providers()]

    def check_provider_health(self, model_id: str, provider_name: str) -> Dict[str, Any]:
        """
        Check the health status of a provider for a model.

        Returns:
            Dict with health information
        """
        model = self.registry.get_model(model_id)
        if not model:
            return {"available": False, "reason": "Model not found"}

        provider = model.get_provider_by_name(provider_name)
        if not provider:
            return {"available": False, "reason": "Provider not found"}

        if not provider.enabled:
            return {"available": False, "reason": "Provider disabled in configuration"}

        is_available = self.health_tracker.is_available(model_id, provider_name)
        if not is_available:
            return {"available": False, "reason": "Circuit breaker open (too many failures)"}

        return {"available": True, "reason": "Provider healthy"}


# Global selector instance
_selector = ProviderSelector()


def get_selector() -> ProviderSelector:
    """Get the global provider selector instance"""
    return _selector
