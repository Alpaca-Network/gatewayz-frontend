"""
Multi-Provider Model Registry

This module provides support for models that can be accessed through multiple providers
with automatic failover, priority-based selection, and cost optimization.
"""

import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ProviderConfig:
    """Configuration for a single provider for a model"""

    name: str  # Provider name (e.g., "google-vertex", "openrouter")
    model_id: str  # Provider-specific model ID
    priority: int = 1  # Lower number = higher priority (1 is highest)
    requires_credentials: bool = False  # Whether this provider needs user credentials
    cost_per_1k_input: Optional[float] = None  # Cost in credits per 1k input tokens
    cost_per_1k_output: Optional[float] = None  # Cost in credits per 1k output tokens
    enabled: bool = True  # Whether this provider is currently enabled
    max_tokens: Optional[int] = None  # Max tokens supported by this provider
    features: List[str] = field(default_factory=list)  # Supported features (e.g., "streaming", "function_calling")

    def __post_init__(self):
        """Validate the configuration"""
        if self.priority < 1:
            raise ValueError(f"Priority must be >= 1, got {self.priority}")


@dataclass
class MultiProviderModel:
    """A model that can be accessed through multiple providers"""

    id: str  # Canonical model ID (what users specify)
    name: str  # Display name
    providers: List[ProviderConfig]  # List of provider configurations
    description: Optional[str] = None
    context_length: Optional[int] = None
    modalities: List[str] = field(default_factory=lambda: ["text"])

    def __post_init__(self):
        """Validate and sort providers by priority"""
        if not self.providers:
            raise ValueError(f"Model {self.id} must have at least one provider")

        # Sort providers by priority (lower number = higher priority)
        self.providers.sort(key=lambda p: p.priority)

        logger.debug(
            f"Model {self.id} configured with {len(self.providers)} providers: "
            f"{[p.name for p in self.providers]}"
        )

    def get_enabled_providers(self) -> List[ProviderConfig]:
        """Get list of enabled providers, sorted by priority"""
        return [p for p in self.providers if p.enabled]

    def get_primary_provider(self) -> Optional[ProviderConfig]:
        """Get the highest priority enabled provider"""
        enabled = self.get_enabled_providers()
        return enabled[0] if enabled else None

    def get_provider_by_name(self, name: str) -> Optional[ProviderConfig]:
        """Get a specific provider configuration by name"""
        for provider in self.providers:
            if provider.name == name:
                return provider
        return None

    def supports_provider(self, provider_name: str) -> bool:
        """Check if this model supports a specific provider"""
        return any(p.name == provider_name and p.enabled for p in self.providers)


class MultiProviderRegistry:
    """
    Registry for multi-provider models with provider selection and failover logic.

    This class maintains a registry of models that can be accessed through multiple
    providers and provides methods for intelligent provider selection based on
    priority, availability, cost, and features.
    """

    def __init__(self):
        self._models: Dict[str, MultiProviderModel] = {}
        logger.info("Initialized MultiProviderRegistry")

    def register_model(self, model: MultiProviderModel) -> None:
        """Register a multi-provider model"""
        self._models[model.id] = model
        logger.info(
            f"Registered multi-provider model: {model.id} with "
            f"{len(model.providers)} providers"
        )

    def register_models(self, models: List[MultiProviderModel]) -> None:
        """Register multiple models at once"""
        for model in models:
            self.register_model(model)

    def get_model(self, model_id: str) -> Optional[MultiProviderModel]:
        """Get a multi-provider model by ID"""
        return self._models.get(model_id)

    def has_model(self, model_id: str) -> bool:
        """Check if a model is registered"""
        return model_id in self._models

    def get_all_models(self) -> List[MultiProviderModel]:
        """Get all registered models"""
        return list(self._models.values())

    def select_provider(
        self,
        model_id: str,
        preferred_provider: Optional[str] = None,
        required_features: Optional[List[str]] = None,
        max_cost: Optional[float] = None,
    ) -> Optional[ProviderConfig]:
        """
        Select the best provider for a model based on criteria.

        Args:
            model_id: The model to select a provider for
            preferred_provider: If specified, try to use this provider first
            required_features: List of required features (e.g., ["streaming"])
            max_cost: Maximum acceptable cost per 1k tokens

        Returns:
            The selected provider configuration, or None if no suitable provider found
        """
        model = self.get_model(model_id)
        if not model:
            logger.warning(f"Model {model_id} not found in multi-provider registry")
            return None

        # Get enabled providers
        candidates = model.get_enabled_providers()
        if not candidates:
            logger.error(f"No enabled providers for model {model_id}")
            return None

        # Filter by required features
        if required_features:
            candidates = [
                p for p in candidates
                if all(feature in p.features for feature in required_features)
            ]
            if not candidates:
                logger.warning(
                    f"No providers for {model_id} support required features: {required_features}"
                )
                return None

        # Filter by cost
        if max_cost is not None:
            candidates = [
                p for p in candidates
                if p.cost_per_1k_input is None or p.cost_per_1k_input <= max_cost
            ]
            if not candidates:
                logger.warning(
                    f"No providers for {model_id} within cost limit: {max_cost}"
                )
                return None

        # If preferred provider specified and available, use it
        if preferred_provider:
            for provider in candidates:
                if provider.name == preferred_provider:
                    logger.info(
                        f"Selected preferred provider {preferred_provider} for {model_id}"
                    )
                    return provider
            logger.warning(
                f"Preferred provider {preferred_provider} not available for {model_id}, "
                f"falling back to priority-based selection"
            )

        # Return highest priority provider
        selected = candidates[0]
        logger.info(
            f"Selected provider {selected.name} (priority {selected.priority}) for {model_id}"
        )
        return selected

    def get_fallback_providers(
        self,
        model_id: str,
        exclude_provider: Optional[str] = None,
    ) -> List[ProviderConfig]:
        """
        Get ordered list of fallback providers for a model.

        Args:
            model_id: The model to get fallbacks for
            exclude_provider: Provider to exclude (typically the one that just failed)

        Returns:
            List of provider configurations ordered by priority
        """
        model = self.get_model(model_id)
        if not model:
            return []

        providers = model.get_enabled_providers()

        # Exclude specified provider
        if exclude_provider:
            providers = [p for p in providers if p.name != exclude_provider]

        return providers

    def disable_provider(self, model_id: str, provider_name: str) -> bool:
        """
        Temporarily disable a provider for a model (e.g., after repeated failures).

        Returns:
            True if provider was disabled, False if not found
        """
        model = self.get_model(model_id)
        if not model:
            return False

        provider = model.get_provider_by_name(provider_name)
        if provider:
            provider.enabled = False
            logger.warning(f"Disabled provider {provider_name} for model {model_id}")
            return True

        return False

    def enable_provider(self, model_id: str, provider_name: str) -> bool:
        """
        Re-enable a previously disabled provider.

        Returns:
            True if provider was enabled, False if not found
        """
        model = self.get_model(model_id)
        if not model:
            return False

        provider = model.get_provider_by_name(provider_name)
        if provider:
            provider.enabled = True
            logger.info(f"Enabled provider {provider_name} for model {model_id}")
            return True

        return False


# Global registry instance
_registry = MultiProviderRegistry()


def get_registry() -> MultiProviderRegistry:
    """Get the global multi-provider registry instance"""
    return _registry
