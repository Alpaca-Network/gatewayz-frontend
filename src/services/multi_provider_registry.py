"""Multi-provider model registry and canonical catalog support."""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)


def _merge_dicts(base: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two dictionaries preferring non-empty values from the incoming dict."""

    if not incoming:
        return base

    for key, value in incoming.items():
        if value in (None, "", [], {}):
            continue

        current = base.get(key)
        if current in (None, "", [], {}):
            base[key] = value
            continue

        if isinstance(current, dict) and isinstance(value, dict):
            base[key] = _merge_dicts(dict(current), value)
        elif isinstance(current, list) and isinstance(value, list):
            merged_list = list(dict.fromkeys([*current, *value]))
            base[key] = merged_list
        else:
            base[key] = value

    return base


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
    features: List[str] = field(
        default_factory=list
    )  # Supported features (e.g., "streaming", "function_calling")

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


@dataclass
class CanonicalModelProvider:
    """Representation of a provider-specific adapter for a canonical model."""

    provider_slug: str
    native_model_id: str
    capabilities: Dict[str, Any] = field(default_factory=dict)
    pricing: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def merge(self, other: "CanonicalModelProvider") -> None:
        if other.provider_slug != self.provider_slug:
            raise ValueError("Cannot merge providers with different slugs")

        if other.native_model_id:
            self.native_model_id = other.native_model_id

        self.capabilities = _merge_dicts(self.capabilities, other.capabilities)
        self.pricing = _merge_dicts(self.pricing, other.pricing)
        self.metadata = _merge_dicts(self.metadata, other.metadata)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "provider_slug": self.provider_slug,
            "native_model_id": self.native_model_id,
            "capabilities": self.capabilities,
            "pricing": self.pricing,
            "metadata": self.metadata,
        }


@dataclass
class CanonicalModel:
    """Canonical model definition spanning multiple providers."""

    id: str
    display: Dict[str, Any] = field(default_factory=dict)
    providers: Dict[str, CanonicalModelProvider] = field(default_factory=dict)

    def merge_display(self, incoming: Dict[str, Any]) -> None:
        if not incoming:
            return
        self.display = _merge_dicts(self.display, dict(incoming))

    def add_provider(self, provider: CanonicalModelProvider) -> None:
        existing = self.providers.get(provider.provider_slug)
        if existing:
            existing.merge(provider)
        else:
            self.providers[provider.provider_slug] = provider

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "display": self.display,
            "providers": [p.to_dict() for p in self.providers.values()],
        }


class MultiProviderRegistry:
    """
    Registry for multi-provider models with provider selection and failover logic.

    This class maintains a registry of models that can be accessed through multiple
    providers and provides methods for intelligent provider selection based on
    priority, availability, cost, and features.
    """

    def __init__(self):
        self._models: Dict[str, MultiProviderModel] = {}
        self._canonical_models: Dict[str, "CanonicalModel"] = {}
        self._canonical_slug_index: Dict[str, str] = {}
        logger.info("Initialized MultiProviderRegistry")

    def register_model(self, model: MultiProviderModel) -> None:
        """Register a multi-provider model"""
        self._models[model.id] = model
        logger.info(
            f"Registered multi-provider model: {model.id} with " f"{len(model.providers)} providers"
        )

        # Also register canonical representation for compatibility
        try:
            display = {
                "name": model.name,
                "description": model.description,
                "context_length": model.context_length,
                "modalities": model.modalities,
            }

            for provider in model.providers:
                canonical_provider = CanonicalModelProvider(
                    provider_slug=provider.name,
                    native_model_id=provider.model_id,
                    capabilities={
                        "max_tokens": provider.max_tokens,
                        "features": provider.features,
                        "requires_credentials": provider.requires_credentials,
                    },
                    pricing={
                        "prompt": provider.cost_per_1k_input,
                        "completion": provider.cost_per_1k_output,
                    },
                    metadata={"priority": provider.priority},
                )
                self.register_canonical_provider(model.id, display, canonical_provider)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.debug(
                "Failed to backfill canonical model from MultiProviderModel %s: %s",
                model.id,
                exc,
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

    # ------------------------------------------------------------------
    # Canonical catalog support
    # ------------------------------------------------------------------

    def reset_canonical_models(self) -> None:
        """Clear the canonical catalog in preparation for a fresh rebuild."""

        logger.debug("Resetting canonical model registry")
        self._canonical_models.clear()
        self._canonical_slug_index.clear()

    def _resolve_canonical_id(self, *candidates: Iterable[Optional[str]]) -> Optional[str]:
        for group in candidates:
            if not group:
                continue
            for candidate in group:
                if not candidate:
                    continue
                existing = self._canonical_slug_index.get(candidate)
                if existing:
                    return existing
        return None

    def _update_slug_index(self, canonical_id: str, slugs: Iterable[str]) -> None:
        for slug in slugs:
            if slug:
                self._canonical_slug_index[slug] = canonical_id

    def register_canonical_provider(
        self,
        canonical_id: Optional[str],
        display_metadata: Optional[Dict[str, Any]],
        provider: "CanonicalModelProvider",
    ) -> "CanonicalModel":
        """Register a canonical model provider mapping.

        Args:
            canonical_id: Shared ID across providers.
            display_metadata: Human-friendly metadata for the canonical model.
            provider: Provider adapter definition.
        """

        slug_candidates: List[str] = []
        if display_metadata:
            slug_candidates.extend(
                str(value)
                for key in ("slug", "canonical_slug")
                if (value := display_metadata.get(key))
            )
            aliases = display_metadata.get("aliases")
            if aliases:
                if isinstance(aliases, (list, tuple, set)):
                    slug_candidates.extend(str(alias) for alias in aliases if alias)
                else:
                    slug_candidates.append(str(aliases))

        slug_candidates.extend(
            str(value)
            for key in ("slug", "canonical_slug")
            if (value := provider.metadata.get(key))
        )
        slug_candidates.append(provider.native_model_id)

        resolved_id = (
            canonical_id or provider.metadata.get("canonical_slug") or provider.native_model_id
        )

        existing_id = self._resolve_canonical_id(slug_candidates, [resolved_id])
        if existing_id:
            resolved_id = existing_id

        model = self._canonical_models.get(resolved_id)
        if not model:
            model = CanonicalModel(id=resolved_id)
            self._canonical_models[resolved_id] = model

        if display_metadata:
            model.merge_display(display_metadata)

        model.add_provider(provider)

        # Update slug index for quick lookup
        self._update_slug_index(resolved_id, slug_candidates + [resolved_id])

        return model

    def get_canonical_model(self, canonical_id: str) -> Optional["CanonicalModel"]:
        return self._canonical_models.get(canonical_id)

    def get_canonical_models(self) -> List["CanonicalModel"]:
        return list(self._canonical_models.values())

    def get_canonical_catalog_snapshot(self) -> List[Dict[str, Any]]:
        return [model.to_dict() for model in self.get_canonical_models()]

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
                p for p in candidates if all(feature in p.features for feature in required_features)
            ]
            if not candidates:
                logger.warning(
                    f"No providers for {model_id} support required features: {required_features}"
                )
                return None

        # Filter by cost
        if max_cost is not None:
            candidates = [
                p
                for p in candidates
                if p.cost_per_1k_input is None or p.cost_per_1k_input <= max_cost
            ]
            if not candidates:
                logger.warning(f"No providers for {model_id} within cost limit: {max_cost}")
                return None

        # If preferred provider specified and available, use it
        if preferred_provider:
            for provider in candidates:
                if provider.name == preferred_provider:
                    logger.info(f"Selected preferred provider {preferred_provider} for {model_id}")
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
