"""
Google Models Multi-Provider Configuration

This module defines Google models (Gemini and Gemma) with support for
multiple providers: direct Vertex AI access and OpenRouter proxy.
"""

import logging
from typing import List

from src.services.multi_provider_registry import (
    MultiProviderModel,
    ProviderConfig,
    get_registry,
    CanonicalModelProvider,
)

logger = logging.getLogger(__name__)


def get_google_models() -> List[MultiProviderModel]:
    """
    Get Google models configured with multiple providers.

    Each model can be accessed through:
    1. Google Vertex AI (direct, priority 1) - requires GOOGLE_VERTEX_CREDENTIALS_JSON
    2. OpenRouter (proxied, priority 2) - fallback when Vertex AI unavailable
    """

    models = [
        # Gemini 2.5 Models
        MultiProviderModel(
            id="gemini-2.5-flash",
            name="Gemini 2.5 Flash",
            description="Google's fastest multimodal model with breakthrough speed",
            context_length=1000000,
            modalities=["text", "image", "audio", "video"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemini-2.5-flash-preview-09-2025",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=0.075,  # Example pricing
                    cost_per_1k_output=0.30,
                    max_tokens=8192,
                    features=["streaming", "multimodal", "function_calling"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemini-2.5-flash-preview-09-2025",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=0.10,  # OpenRouter markup
                    cost_per_1k_output=0.40,
                    max_tokens=8192,
                    features=["streaming", "multimodal"],
                ),
            ],
        ),
        MultiProviderModel(
            id="gemini-2.5-flash-lite",
            name="Gemini 2.5 Flash Lite",
            description="Ultra-fast, cost-effective model for simple tasks",
            context_length=1000000,
            modalities=["text", "image", "audio", "video"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemini-2.5-flash-lite",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=0.03,
                    cost_per_1k_output=0.12,
                    max_tokens=8192,
                    features=["streaming", "multimodal"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemini-2.5-flash-lite",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=0.05,
                    cost_per_1k_output=0.15,
                    max_tokens=8192,
                    features=["streaming"],
                ),
            ],
        ),
        MultiProviderModel(
            id="gemini-2.5-pro",
            name="Gemini 2.5 Pro",
            description="Most capable Gemini model for complex reasoning",
            context_length=1000000,
            modalities=["text", "image", "audio", "video"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemini-2.5-pro",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=1.25,
                    cost_per_1k_output=5.00,
                    max_tokens=8192,
                    features=["streaming", "multimodal", "function_calling"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemini-2.5-pro-preview",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=1.50,
                    cost_per_1k_output=6.00,
                    max_tokens=8192,
                    features=["streaming", "multimodal"],
                ),
            ],
        ),
        # Gemini 2.0 Models
        MultiProviderModel(
            id="gemini-2.0-flash-exp",
            name="Gemini 2.0 Flash (Experimental)",
            description="Experimental preview of Gemini 2.0 Flash",
            context_length=1000000,
            modalities=["text", "image", "audio", "video"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemini-2.0-flash-exp",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=0.00,  # Free during preview
                    cost_per_1k_output=0.00,
                    max_tokens=8192,
                    features=["streaming", "multimodal", "function_calling"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemini-2.0-flash-exp:free",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=0.00,
                    cost_per_1k_output=0.00,
                    max_tokens=8192,
                    features=["streaming", "multimodal"],
                ),
            ],
        ),
        MultiProviderModel(
            id="gemini-2.0-flash",
            name="Gemini 2.0 Flash",
            description="Fast and versatile model for diverse tasks",
            context_length=1000000,
            modalities=["text", "image", "audio", "video"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemini-2.0-flash",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=0.075,
                    cost_per_1k_output=0.30,
                    max_tokens=8192,
                    features=["streaming", "multimodal", "function_calling"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemini-2.0-flash-001",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=0.10,
                    cost_per_1k_output=0.40,
                    max_tokens=8192,
                    features=["streaming", "multimodal"],
                ),
            ],
        ),
        # Gemini 1.5 Models
        MultiProviderModel(
            id="gemini-1.5-pro",
            name="Gemini 1.5 Pro",
            description="Mid-generation model with excellent performance",
            context_length=1000000,
            modalities=["text", "image", "audio", "video"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemini-1.5-pro",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=1.25,
                    cost_per_1k_output=5.00,
                    max_tokens=8192,
                    features=["streaming", "multimodal", "function_calling"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemini-pro-1.5",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=1.50,
                    cost_per_1k_output=6.00,
                    max_tokens=8192,
                    features=["streaming", "multimodal"],
                ),
            ],
        ),
        MultiProviderModel(
            id="gemini-1.5-flash",
            name="Gemini 1.5 Flash",
            description="Fast and efficient model for everyday tasks",
            context_length=1000000,
            modalities=["text", "image", "audio", "video"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemini-1.5-flash",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=0.075,
                    cost_per_1k_output=0.30,
                    max_tokens=8192,
                    features=["streaming", "multimodal", "function_calling"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemini-flash-1.5",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=0.10,
                    cost_per_1k_output=0.40,
                    max_tokens=8192,
                    features=["streaming", "multimodal"],
                ),
            ],
        ),
        # Gemma Models (Open source)
        MultiProviderModel(
            id="gemma-2-9b-it",
            name="Gemma 2 9B Instruct",
            description="Google's open-source 9B parameter instruction-tuned model",
            context_length=8192,
            modalities=["text"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemma-2-9b-it",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=0.03,
                    cost_per_1k_output=0.06,
                    max_tokens=8192,
                    features=["streaming"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemma-2-9b-it:free",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=0.00,
                    cost_per_1k_output=0.00,
                    max_tokens=8192,
                    features=["streaming"],
                ),
            ],
        ),
        MultiProviderModel(
            id="gemma-2-27b-it",
            name="Gemma 2 27B Instruct",
            description="Google's open-source 27B parameter instruction-tuned model",
            context_length=8192,
            modalities=["text"],
            providers=[
                ProviderConfig(
                    name="google-vertex",
                    model_id="gemma-2-27b-it",
                    priority=1,
                    requires_credentials=True,
                    cost_per_1k_input=0.10,
                    cost_per_1k_output=0.20,
                    max_tokens=8192,
                    features=["streaming"],
                ),
                ProviderConfig(
                    name="openrouter",
                    model_id="google/gemma-2-27b-it",
                    priority=2,
                    requires_credentials=False,
                    cost_per_1k_input=0.15,
                    cost_per_1k_output=0.25,
                    max_tokens=8192,
                    features=["streaming"],
                ),
            ],
        ),
    ]

    return models


def initialize_google_models() -> None:
    """
    Initialize the multi-provider registry with Google models.

    This should be called during application startup to register all
    Google models with their provider configurations.
    """
    registry = get_registry()
    models = get_google_models()

    logger.info(f"Initializing {len(models)} Google models with multi-provider support")

    for model in models:
        registry.register_model(model)
        logger.debug(
            f"Registered {model.id} with providers: "
            f"{[p.name for p in model.providers]}"
        )

    logger.info(
        f"✓ Successfully initialized {len(models)} Google models in multi-provider registry"
    )

    register_google_models_in_canonical_registry()


def register_google_models_in_canonical_registry() -> None:
    """Populate the canonical model registry with Google static definitions."""

    registry = get_registry()
    models = get_google_models()

    for model in models:
        display = {
            "name": model.name,
            "description": model.description,
            "context_length": model.context_length,
            "modalities": model.modalities,
            "canonical_slug": model.id,
            "aliases": list({
                model.id,
                f"google/{model.id}",
                f"google-vertex/{model.id}",
            }),
        }

        for provider in model.providers:
            canonical_provider = CanonicalModelProvider(
                provider_slug=provider.name,
                native_model_id=provider.model_id,
                capabilities={
                    "features": provider.features,
                    "max_tokens": provider.max_tokens,
                    "requires_credentials": provider.requires_credentials,
                    "priority": provider.priority,
                },
                pricing={
                    "prompt": provider.cost_per_1k_input,
                    "completion": provider.cost_per_1k_output,
                },
                metadata={
                    "canonical_slug": model.id,
                    "provider_priority": provider.priority,
                },
            )

            registry.register_canonical_provider(model.id, display, canonical_provider)
