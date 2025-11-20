"""
Model ID transformation logic for supporting multiple input formats.
Converts simplified "{org}/{model}" format to provider-specific formats.

This module handles transformations between user-friendly model IDs
(like "deepseek-ai/deepseek-v3") and provider-specific formats
(like "accounts/fireworks/models/deepseek-v3p1").
"""

import logging

from typing import Optional, Dict
logger = logging.getLogger(__name__)

MODEL_PROVIDER_OVERRIDES = {
    "katanemo/arch-router-1.5b": "huggingface",
    "zai-org/glm-4.6-fp8": "near",
    # Llama models are better served through OpenRouter, Featherless, or HuggingFace
    # rather than directly through Cerebras which doesn't have native Llama models
    "cerebras/llama-3.3-70b": "openrouter",
    "cerebras/llama-3.3-70b-instruct": "openrouter",
    "cerebras/llama-3.1-70b": "openrouter",
    "cerebras/llama-3.1-70b-instruct": "openrouter",
}

# Gemini model name constants to reduce duplication
GEMINI_2_5_FLASH_LITE_PREVIEW = "gemini-2.5-flash-lite-preview-09-2025"
GEMINI_2_5_FLASH_PREVIEW = "gemini-2.5-flash-preview-09-2025"
GEMINI_2_5_PRO_PREVIEW = "gemini-2.5-pro-preview-09-2025"
GEMINI_2_0_FLASH = "gemini-2.0-flash"
GEMINI_2_0_PRO = "gemini-2.0-pro"
GEMINI_1_5_PRO = "gemini-1.5-pro"
GEMINI_1_5_FLASH = "gemini-1.5-flash"
GEMINI_1_0_PRO = "gemini-1.0-pro"

# Claude model name constants to reduce duplication
CLAUDE_SONNET_4_5 = "anthropic/claude-sonnet-4.5"


def transform_model_id(model_id: str, provider: str, use_multi_provider: bool = True) -> str:
    """
    Transform model ID from simplified format to provider-specific format.

    Now supports multi-provider models - will automatically get the correct
    provider-specific model ID from the registry.

    NOTE: All model IDs are normalized to lowercase before being sent to providers
    to ensure compatibility. Fireworks requires lowercase, while other providers
    are case-insensitive, so lowercase works universally.

    Args:
        model_id: The input model ID (e.g., "deepseek-ai/deepseek-v3")
        provider: The target provider (e.g., "fireworks", "openrouter")
        use_multi_provider: Whether to check multi-provider registry first (default: True)

    Returns:
        The transformed model ID suitable for the provider's API (always lowercase)

    Examples:
        Input: "deepseek-ai/DeepSeek-V3", provider="fireworks"
        Output: "accounts/fireworks/models/deepseek-v3p1"

        Input: "meta-llama/Llama-3.3-70B", provider="fireworks"
        Output: "accounts/fireworks/models/llama-v3p3-70b-instruct"

        Input: "OpenAI/GPT-4", provider="openrouter"
        Output: "openai/gpt-4"
    """

    # Check multi-provider registry first (if enabled)
    if use_multi_provider:
        try:
            from src.services.multi_provider_registry import get_registry

            registry = get_registry()
            if registry.has_model(model_id):
                # Get provider-specific model ID from registry
                model = registry.get_model(model_id)
                if model:
                    provider_config = model.get_provider_by_name(provider)
                    if provider_config:
                        provider_model_id = provider_config.model_id
                        logger.info(
                            f"Multi-provider transform: {model_id} -> {provider_model_id} "
                            f"(provider: {provider})"
                        )
                        return provider_model_id.lower()
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"Error checking multi-provider registry for transform: {e}")

    # Normalize input to lowercase for case-insensitive matching
    # Store original for logging
    original_model_id = model_id
    model_id = model_id.lower()

    if original_model_id != model_id:
        logger.debug(f"Normalized model ID to lowercase: '{original_model_id}' -> '{model_id}'")

    # If already in full Fireworks path format, return as-is (already lowercase)
    if model_id.startswith("accounts/fireworks/models/"):
        logger.debug(f"Model ID already in Fireworks format: {model_id}")
        return model_id

    # If model starts with @, but is not a Google model, keep as-is
    # (@ prefix is used by some providers but Portkey has been removed)
    if model_id.startswith("@") and not model_id.startswith("@google/models/"):
        logger.debug(f"Model ID with @ prefix (non-Google): {model_id}")
        return model_id

    provider_lower = provider.lower()

    # Special handling for OpenRouter: strip 'openrouter/' prefix if present
    # EXCEPT for openrouter/auto which needs to keep the prefix
    if provider_lower == "openrouter" and model_id.startswith("openrouter/"):
        # Don't strip the prefix from openrouter/auto - it needs the full ID
        if model_id != "openrouter/auto":
            stripped = model_id[len("openrouter/") :]
            logger.info(
                f"Stripped 'openrouter/' prefix: '{model_id}' -> '{stripped}' for OpenRouter"
            )
            model_id = stripped
        else:
            logger.info("Preserving 'openrouter/auto' - this model requires the full ID")

    # Special handling for Near: strip 'near/' prefix if present
    if provider_lower == "near" and model_id.startswith("near/"):
        stripped = model_id[len("near/") :]
        logger.info(f"Stripped 'near/' prefix: '{model_id}' -> '{stripped}' for Near")
        model_id = stripped

    # Special handling for AIMO: strip 'aimo/' prefix if present
    # AIMO models need to be in provider_pubkey:model_name format for actual API calls
    # The aimo_native_id field contains the correct format
    if provider_lower == "aimo" and model_id.startswith("aimo/"):
        stripped = model_id[len("aimo/") :]
        logger.info(f"Stripped 'aimo/' prefix: '{model_id}' -> '{stripped}' for AIMO")
        model_id = stripped

    # Get the mapping for this provider
    mapping = get_model_id_mapping(provider_lower)

    # Check direct mapping first
    if model_id in mapping:
        transformed = mapping[model_id]
        logger.info(f"Transformed '{model_id}' to '{transformed}' for {provider}")
        return transformed

    # Check for partial matches (e.g., without org prefix)
    if "/" in model_id:
        _, model_name = model_id.split("/", 1)
        # Try without org prefix
        if model_name in mapping:
            transformed = mapping[model_name]
            logger.info(
                f"Transformed '{model_id}' to '{transformed}' for {provider} (matched by model name)"
            )
            return transformed

    # Check fuzzy matching for version variations
    normalized = normalize_model_name(model_id)
    for incoming, native in mapping.items():
        if normalize_model_name(incoming) == normalized:
            logger.info(f"Transformed '{model_id}' to '{native}' for {provider} (fuzzy match)")
            return native

    # Special handling for Fireworks - try to construct the path
    if provider_lower == "fireworks" and "/" in model_id:
        # For unknown models, try constructing the Fireworks path
        org, model_name = model_id.split("/", 1)
        # Convert common patterns
        model_name_fixed = model_name.replace(".", "p")  # v3.1 -> v3p1
        constructed = f"accounts/fireworks/models/{model_name_fixed}"
        logger.warning(f"No mapping for '{model_id}', constructed: '{constructed}'")
        return constructed

    # If no transformation needed or found, return original
    logger.debug(f"No transformation for '{model_id}' with provider {provider}")
    return model_id


def get_model_id_mapping(provider: str) -> Dict[str, str]:
    """
    Get simplified -> native format mapping for a specific provider.
    This maps user-friendly input to what the provider API expects.
    """

    mappings = {
        "fireworks": {
            # Full format with org
            "deepseek-ai/deepseek-v3": "accounts/fireworks/models/deepseek-v3p1",
            "deepseek-ai/deepseek-v3.1": "accounts/fireworks/models/deepseek-v3p1",
            "deepseek-ai/deepseek-v3p1": "accounts/fireworks/models/deepseek-v3p1",
            "deepseek-ai/deepseek-r1": "accounts/fireworks/models/deepseek-r1-0528",
            # Llama models
            "meta-llama/llama-3.3-70b": "accounts/fireworks/models/llama-v3p3-70b-instruct",
            "meta-llama/llama-3.3-70b-instruct": "accounts/fireworks/models/llama-v3p3-70b-instruct",
            "meta-llama/llama-3.1-70b": "accounts/fireworks/models/llama-v3p1-70b-instruct",
            "meta-llama/llama-3.1-70b-instruct": "accounts/fireworks/models/llama-v3p1-70b-instruct",
            "meta-llama/llama-3.1-8b": "accounts/fireworks/models/llama-v3p1-8b-instruct",
            "meta-llama/llama-3.1-8b-instruct": "accounts/fireworks/models/llama-v3p1-8b-instruct",
            "meta-llama/llama-4-scout": "accounts/fireworks/models/llama4-scout-instruct-basic",
            "meta-llama/llama-4-maverick": "accounts/fireworks/models/llama4-maverick-instruct-basic",
            # Without org prefix (common shortcuts)
            "deepseek-v3": "accounts/fireworks/models/deepseek-v3p1",
            "deepseek-v3.1": "accounts/fireworks/models/deepseek-v3p1",
            "deepseek-v3p1": "accounts/fireworks/models/deepseek-v3p1",
            "deepseek-r1": "accounts/fireworks/models/deepseek-r1-0528",
            "llama-3.3-70b": "accounts/fireworks/models/llama-v3p3-70b-instruct",
            "llama-3.1-70b": "accounts/fireworks/models/llama-v3p1-70b-instruct",
            "llama-3.1-8b": "accounts/fireworks/models/llama-v3p1-8b-instruct",
            # Qwen models
            "qwen/qwen-2.5-32b": "accounts/fireworks/models/qwen2p5-vl-32b-instruct",
            "qwen/qwen-3-235b": "accounts/fireworks/models/qwen3-235b-a22b",
            "qwen/qwen-3-235b-instruct": "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
            "qwen/qwen-3-235b-thinking": "accounts/fireworks/models/qwen3-235b-a22b-thinking-2507",
            "qwen/qwen-3-30b-thinking": "accounts/fireworks/models/qwen3-30b-a3b-thinking-2507",
            "qwen/qwen-3-coder-480b": "accounts/fireworks/models/qwen3-coder-480b-a35b-instruct",
            # Other models
            "moonshot-ai/kimi-k2": "accounts/fireworks/models/kimi-k2-instruct",
            "moonshot-ai/kimi-k2-instruct": "accounts/fireworks/models/kimi-k2-instruct",
            "zhipu-ai/glm-4.5": "accounts/fireworks/models/glm-4p5",
            "gpt-oss/gpt-120b": "accounts/fireworks/models/gpt-oss-120b",
            "gpt-oss/gpt-20b": "accounts/fireworks/models/gpt-oss-20b",
        },
        "openrouter": {
            # OpenRouter already uses org/model format, so mostly pass-through
            # But support common variations
            "openai/gpt-4": "openai/gpt-4",
            "openai/gpt-4-turbo": "openai/gpt-4-turbo",
            "openai/gpt-3.5-turbo": "openai/gpt-3.5-turbo",
            # Claude 3 models
            "anthropic/claude-3-opus": "anthropic/claude-3-opus-20240229",
            "anthropic/claude-3-sonnet": "anthropic/claude-3-sonnet-20240229",
            "anthropic/claude-3-haiku": "anthropic/claude-3-haiku-20240307",
            # Claude Sonnet 4.5 - support multiple input formats
            "claude-sonnet-4-5-20250929": CLAUDE_SONNET_4_5,
            "anthropic/claude-sonnet-4.5": CLAUDE_SONNET_4_5,
            "anthropic/claude-4.5-sonnet": CLAUDE_SONNET_4_5,
            "anthropic/claude-4.5-sonnet-20250929": CLAUDE_SONNET_4_5,
            "claude-sonnet-4.5": CLAUDE_SONNET_4_5,
            # Other models
            "meta-llama/llama-3.1-70b": "meta-llama/llama-3.1-70b-instruct",
            "deepseek-ai/deepseek-v3": "deepseek/deepseek-chat",
        },
        "featherless": {
            # Featherless uses direct provider/model format
            # Most pass through directly
            "deepseek-ai/deepseek-v3": "deepseek-ai/DeepSeek-V3",
            "meta-llama/llama-3.3-70b": "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/llama-3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        },
        "together": {
            # Together AI uses specific naming
            "meta-llama/llama-3.3-70b": "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/llama-3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            "deepseek-ai/deepseek-v3": "deepseek-ai/DeepSeek-V3",
        },
        "huggingface": {
            # HuggingFace uses org/model format directly
            # Most models pass through as-is, but we map common variations
            "meta-llama/llama-3.3-70b": "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/llama-3.3-70b-instruct": "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/llama-3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct",
            "meta-llama/llama-3.1-70b-instruct": "meta-llama/Meta-Llama-3.1-70B-Instruct",
            "meta-llama/llama-3.1-8b": "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "meta-llama/llama-3.1-8b-instruct": "meta-llama/Meta-Llama-3.1-8B-Instruct",
            # DeepSeek models
            "deepseek-ai/deepseek-v3": "deepseek-ai/DeepSeek-V3",
            "deepseek-ai/deepseek-r1": "deepseek-ai/DeepSeek-R1",
            # Qwen models
            "qwen/qwen-2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
            "qwen/qwen-2.5-72b-instruct": "Qwen/Qwen2.5-72B-Instruct",
            "qwen/qwen-2.5-7b": "Qwen/Qwen2.5-7B-Instruct",
            "qwen/qwen-2.5-7b-instruct": "Qwen/Qwen2.5-7B-Instruct",
            # Mistral models
            "mistralai/mistral-7b": "mistralai/Mistral-7B-Instruct-v0.3",
            "mistralai/mistral-7b-instruct": "mistralai/Mistral-7B-Instruct-v0.3",
            "mistralai/mixtral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "mistralai/mixtral-8x7b-instruct": "mistralai/Mixtral-8x7B-Instruct-v0.1",
            # Microsoft models
            "microsoft/phi-3": "microsoft/Phi-3-medium-4k-instruct",
            "microsoft/phi-3-medium": "microsoft/Phi-3-medium-4k-instruct",
            # Google Gemma models removed - they should use Google Vertex AI provider
        },
        "hug": {
            # Alias for huggingface - use same mappings
            # HuggingFace uses org/model format directly
            # Most models pass through as-is, but we map common variations
            "meta-llama/llama-3.3-70b": "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/llama-3.3-70b-instruct": "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/llama-3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct",
            "meta-llama/llama-3.1-70b-instruct": "meta-llama/Meta-Llama-3.1-70B-Instruct",
            "meta-llama/llama-3.1-8b": "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "meta-llama/llama-3.1-8b-instruct": "meta-llama/Meta-Llama-3.1-8B-Instruct",
            # DeepSeek models
            "deepseek-ai/deepseek-v3": "deepseek-ai/DeepSeek-V3",
            "deepseek-ai/deepseek-r1": "deepseek-ai/DeepSeek-R1",
            # Qwen models
            "qwen/qwen-2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
            "qwen/qwen-2.5-72b-instruct": "Qwen/Qwen2.5-72B-Instruct",
            "qwen/qwen-2.5-7b": "Qwen/Qwen2.5-7B-Instruct",
            "qwen/qwen-2.5-7b-instruct": "Qwen/Qwen2.5-7B-Instruct",
            # Mistral models
            "mistralai/mistral-7b": "mistralai/Mistral-7B-Instruct-v0.3",
            "mistralai/mistral-7b-instruct": "mistralai/Mistral-7B-Instruct-v0.3",
            "mistralai/mixtral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "mistralai/mixtral-8x7b-instruct": "mistralai/Mixtral-8x7B-Instruct-v0.1",
            # Microsoft models
            "microsoft/phi-3": "microsoft/Phi-3-medium-4k-instruct",
            "microsoft/phi-3-medium": "microsoft/Phi-3-medium-4k-instruct",
            # Google Gemma models removed - they should use Google Vertex AI provider
        },
        "chutes": {
            # Chutes uses org/model format directly
            # Most models pass through as-is from their catalog
            # Keep the exact format from the catalog for proper routing
        },
        "google-vertex": {
            # Google Vertex AI models - simple names
            # Full resource names are constructed by the client
            # Gemini 2.5 models (newest)
            # Flash Lite (stable GA version - use stable by default)
            "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",  # Use stable GA version
            "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
            "@google/models/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
            # Preview version (only if explicitly requested)
            "gemini-2.5-flash-lite-preview-09-2025": GEMINI_2_5_FLASH_LITE_PREVIEW,
            "google/gemini-2.5-flash-lite-preview-09-2025": GEMINI_2_5_FLASH_LITE_PREVIEW,
            "@google/models/gemini-2.5-flash-lite-preview-09-2025": GEMINI_2_5_FLASH_LITE_PREVIEW,
            "gemini-2.5-flash-lite-preview-06-17": "gemini-2.5-flash-lite-preview-06-17",
            "google/gemini-2.5-flash-lite-preview-06-17": "gemini-2.5-flash-lite-preview-06-17",
            # Gemini 2.5 flash models
            "gemini-2.5-flash": GEMINI_2_5_FLASH_PREVIEW,
            "gemini-2.5-flash-preview-09-2025": GEMINI_2_5_FLASH_PREVIEW,
            "gemini-2.5-flash-preview": GEMINI_2_5_FLASH_PREVIEW,
            "google/gemini-2.5-flash": GEMINI_2_5_FLASH_PREVIEW,
            "google/gemini-2.5-flash-preview-09-2025": GEMINI_2_5_FLASH_PREVIEW,
            "@google/models/gemini-2.5-flash": GEMINI_2_5_FLASH_PREVIEW,
            "@google/models/gemini-2.5-flash-preview-09-2025": GEMINI_2_5_FLASH_PREVIEW,
            # Image-specific models
            "google/gemini-2.5-flash-image": "gemini-2.5-flash-image",
            "google/gemini-2.5-flash-image-preview": "gemini-2.5-flash-image-preview",
            "gemini-2.5-flash-image": "gemini-2.5-flash-image",
            "gemini-2.5-flash-image-preview": "gemini-2.5-flash-image-preview",
            # Pro (use stable GA version by default)
            "gemini-2.5-pro": "gemini-2.5-pro",  # Use stable GA version
            "google/gemini-2.5-pro": "gemini-2.5-pro",
            "@google/models/gemini-2.5-pro": "gemini-2.5-pro",
            # Preview version (only if explicitly requested)
            "gemini-2.5-pro-preview-09-2025": GEMINI_2_5_PRO_PREVIEW,
            "google/gemini-2.5-pro-preview-09-2025": GEMINI_2_5_PRO_PREVIEW,
            "@google/models/gemini-2.5-pro-preview-09-2025": GEMINI_2_5_PRO_PREVIEW,
            "gemini-2.5-pro-preview": GEMINI_2_5_PRO_PREVIEW,
            "google/gemini-2.5-pro-preview": GEMINI_2_5_PRO_PREVIEW,
            "gemini-2.5-pro-preview-05-06": "gemini-2.5-pro-preview-05-06",
            "google/gemini-2.5-pro-preview-05-06": "gemini-2.5-pro-preview-05-06",
            # Gemini 2.0 models (stable versions)
            "gemini-2.0-flash": GEMINI_2_0_FLASH,
            "gemini-2.0-flash-thinking": "gemini-2.0-flash-thinking",
            "gemini-2.0-flash-001": "gemini-2.0-flash-001",
            "gemini-2.0-flash-lite-001": "gemini-2.0-flash-lite-001",
            "gemini-2.0-flash-exp": "gemini-2.0-flash-exp",
            "google/gemini-2.0-flash": GEMINI_2_0_FLASH,
            "google/gemini-2.0-flash-001": "gemini-2.0-flash-001",
            "google/gemini-2.0-flash-lite-001": "gemini-2.0-flash-lite-001",
            "google/gemini-2.0-flash-exp": "gemini-2.0-flash-exp",
            "@google/models/gemini-2.0-flash": GEMINI_2_0_FLASH,
            "gemini-2.0-pro": GEMINI_2_0_PRO,
            "gemini-2.0-pro-001": "gemini-2.0-pro-001",
            "google/gemini-2.0-pro": GEMINI_2_0_PRO,
            "@google/models/gemini-2.0-pro": GEMINI_2_0_PRO,
            # Gemini 1.5 models
            "gemini-1.5-pro": GEMINI_1_5_PRO,
            "gemini-1.5-pro-002": "gemini-1.5-pro-002",
            "google/gemini-1.5-pro": GEMINI_1_5_PRO,
            "@google/models/gemini-1.5-pro": GEMINI_1_5_PRO,
            "gemini-1.5-flash": GEMINI_1_5_FLASH,
            "gemini-1.5-flash-002": "gemini-1.5-flash-002",
            "google/gemini-1.5-flash": GEMINI_1_5_FLASH,
            "@google/models/gemini-1.5-flash": GEMINI_1_5_FLASH,
            # Gemini 1.0 models
            "gemini-1.0-pro": GEMINI_1_0_PRO,
            "gemini-1.0-pro-vision": "gemini-1.0-pro-vision",
            "google/gemini-1.0-pro": GEMINI_1_0_PRO,
            "@google/models/gemini-1.0-pro": GEMINI_1_0_PRO,
            # Aliases for convenience
            "gemini-2.0": GEMINI_2_0_FLASH,
            "gemini-1.5": GEMINI_1_5_PRO,
            # Gemma models (open source models from Google)
            "google/gemma-2-9b": "gemma-2-9b-it",
            "google/gemma-2-9b-it": "gemma-2-9b-it",
            "google/gemma-2-27b-it": "gemma-2-27b-it",
            "google/gemma-3-4b-it": "gemma-3-4b-it",
            "google/gemma-3-12b-it": "gemma-3-12b-it",
            "google/gemma-3-27b-it": "gemma-3-27b-it",
            "google/gemma-3n-e2b-it": "gemma-3n-e2b-it",
            "google/gemma-3n-e4b-it": "gemma-3n-e4b-it",
            "gemma-2-9b-it": "gemma-2-9b-it",
            "gemma-2-27b-it": "gemma-2-27b-it",
            "gemma-3-4b-it": "gemma-3-4b-it",
            "gemma-3-12b-it": "gemma-3-12b-it",
            "gemma-3-27b-it": "gemma-3-27b-it",
            "gemma-3n-e2b-it": "gemma-3n-e2b-it",
            "gemma-3n-e4b-it": "gemma-3n-e4b-it",
        },
        "vercel-ai-gateway": {
            # Vercel AI Gateway uses standard model identifiers
            # The gateway automatically routes requests to the appropriate provider
            # Using pass-through format - any model ID is supported
            # Minimal mappings to avoid conflicts with other providers during auto-detection
        },
        "helicone": {
            # Helicone AI Gateway uses standard model identifiers
            # The gateway provides observability on top of standard provider APIs
            # Using pass-through format - any model ID is supported
            # Minimal mappings to avoid conflicts with other providers during auto-detection
        },
        "aihubmix": {
            # AiHubMix uses OpenAI-compatible model identifiers
            # Pass-through format - any model ID is supported
            # Minimal mappings to avoid conflicts with other providers during auto-detection
        },
        "anannas": {
            # Anannas uses OpenAI-compatible model identifiers
            # Pass-through format - any model ID is supported
            # Minimal mappings to avoid conflicts with other providers during auto-detection
        },
        "near": {
            # Near AI uses HuggingFace-style model naming with proper case
            # Maps lowercase input variants to actual NEAR model IDs
            # Reference: https://cloud.near.ai/models for current available models

            # DeepSeek models - only DeepSeek-V3.1 is currently available on Near AI
            "deepseek-ai/deepseek-v3": "deepseek-ai/DeepSeek-V3.1",  # Map v3 to v3.1 (only available)
            "deepseek-ai/deepseek-v3.1": "deepseek-ai/DeepSeek-V3.1",
            "deepseek-v3": "deepseek-ai/DeepSeek-V3.1",
            "deepseek-v3.1": "deepseek-ai/DeepSeek-V3.1",

            # GPT-OSS models - requires openai/ prefix
            "gpt-oss/gpt-oss-120b": "openai/gpt-oss-120b",
            "gpt-oss-120b": "openai/gpt-oss-120b",

            # Qwen models
            "qwen/qwen-2-72b": "Qwen/Qwen3-30B-A3B-Instruct-2507",  # Map old qwen-2-72b to qwen-3-30b
            "qwen-2-72b": "Qwen/Qwen3-30B-A3B-Instruct-2507",
            # Qwen3 models - proper case required
            "qwen/qwen-3-30b": "Qwen/Qwen3-30B-A3B-Instruct-2507",
            "qwen/qwen-3-30b-instruct": "Qwen/Qwen3-30B-A3B-Instruct-2507",
            "qwen-3-30b": "Qwen/Qwen3-30B-A3B-Instruct-2507",
            "qwen/qwen3-30b-a3b-instruct-2507": "Qwen/Qwen3-30B-A3B-Instruct-2507",
            "qwen3-30b-a3b-instruct-2507": "Qwen/Qwen3-30B-A3B-Instruct-2507",
            "qwen/qwen3-30b-a3b-thinking-2507": "Qwen/Qwen3-30B-A3B-Thinking-2507",
            "qwen3-30b-a3b-thinking-2507": "Qwen/Qwen3-30B-A3B-Thinking-2507",

            # GLM models from Zhipu AI
            "zai-org/glm-4.6-fp8": "zai-org/GLM-4.6",
            "zai-org/glm-4.6": "zai-org/GLM-4.6",
            "glm-4.6-fp8": "zai-org/GLM-4.6",
            "glm-4.6": "zai-org/GLM-4.6",
        },
        "alpaca-network": {
            # Alpaca Network uses Anyscale infrastructure with DeepSeek models
            # Service: deepseek-v3-1 via https://deepseek-v3-1-b18ty.cld-kvytpjjrw13e2gvq.s.anyscaleuserdata.com

            # DeepSeek V3.1 models
            "deepseek-ai/deepseek-v3.1": "deepseek-v3-1",
            "deepseek-ai/deepseek-v3": "deepseek-v3-1",  # Map v3 to v3.1
            "deepseek/deepseek-v3.1": "deepseek-v3-1",
            "deepseek/deepseek-v3": "deepseek-v3-1",
            "deepseek-v3.1": "deepseek-v3-1",
            "deepseek-v3": "deepseek-v3-1",
            "deepseek-v3-1": "deepseek-v3-1",  # Direct service name
        },
        "alibaba-cloud": {
            # Alibaba Cloud / DashScope models
            # Uses OpenAI-compatible API with direct model IDs
            # Reference: https://dashscope.aliyuncs.com/compatible-mode/v1

            # Qwen commercial models
            "qwen/qwen-plus": "qwen-plus",
            "qwen/qwen-max": "qwen-max",
            "qwen/qwen-flash": "qwen-flash",
            "qwen-plus": "qwen-plus",
            "qwen-max": "qwen-max",
            "qwen-flash": "qwen-flash",

            # Qwen specialized models
            "qwen/qwq-plus": "qwq-plus",
            "qwen/qwen-long": "qwen-long",
            "qwen/qwen-omni": "qwen-omni",
            "qwen/qwen-vl": "qwen-vl",
            "qwen/qwen-math": "qwen-math",
            "qwen/qwen-mt": "qwen-mt",
            "qwen/qvq": "qvq",
            "qwq-plus": "qwq-plus",
            "qwen-long": "qwen-long",
            "qwen-omni": "qwen-omni",
            "qwen-vl": "qwen-vl",
            "qwen-math": "qwen-math",
            "qwen-mt": "qwen-mt",
            "qvq": "qvq",

            # Qwen Coder models
            "qwen/qwen-coder": "qwen-coder",
            "qwen-coder": "qwen-coder",

            # Qwen reasoning models
            "qwen/qwq-32b-preview": "qwq-32b-preview",
            "qwq-32b-preview": "qwq-32b-preview",

            # Qwen thinking models
            "qwen/qwen-3-30b-a3b-thinking": "qwen-3-30b-a3b-thinking",
            "qwen/qwen-3-80b-a3b-thinking": "qwen-3-80b-a3b-thinking",
            "qwen-3-30b-a3b-thinking": "qwen-3-30b-a3b-thinking",
            "qwen-3-80b-a3b-thinking": "qwen-3-80b-a3b-thinking",

            # Qwen 3 series
            "qwen/qwen-3-30b": "qwen-3-30b-a3b-instruct",
            "qwen/qwen-3-80b": "qwen-3-80b-a3b-instruct",
            "qwen/qwen3-32b": "qwen-3-32b-a3b-instruct",
            "qwen3-30b": "qwen-3-30b-a3b-instruct",
            "qwen3-80b": "qwen-3-80b-a3b-instruct",
            "qwen3-32b": "qwen-3-32b-a3b-instruct",

            # Qwen 2.5 series
            "qwen/qwen-2.5-72b": "qwen-2.5-72b-instruct",
            "qwen/qwen-2.5-7b": "qwen-2.5-7b-instruct",
            "qwen-2.5-72b": "qwen-2.5-72b-instruct",
            "qwen-2.5-7b": "qwen-2.5-7b-instruct",

            # Qwen 2 series
            "qwen/qwen-2-72b": "qwen-2-72b-instruct",
            "qwen/qwen-2-7b": "qwen-2-7b-instruct",
            "qwen-2-72b": "qwen-2-72b-instruct",
            "qwen-2-7b": "qwen-2-7b-instruct",

            # Qwen 1.5 models
            "qwen/qwen-1.5-72b": "qwen-1.5-72b-chat",
            "qwen/qwen-1.5-14b": "qwen-1.5-14b-chat",
            "qwen-1.5-72b": "qwen-1.5-72b-chat",
            "qwen-1.5-14b": "qwen-1.5-14b-chat",

            # Alternative naming formats (shorthand)
            "qwen": "qwen-plus",  # Default to Plus for unspecified qwen
            "qwen-max-latest": "qwen-max",
            "qwen-plus-latest": "qwen-plus",
        },
        "clarifai": {
            # Clarifai supports many models through its unified API
            # Most models pass through directly using their standard naming
            # Anthropic models
            "anthropic/claude-3-opus": "claude-3-opus",
            "anthropic/claude-3.5-sonnet": "claude-3.5-sonnet",
            "claude-3-opus": "claude-3-opus",
            "claude-3.5-sonnet": "claude-3.5-sonnet",
            # OpenAI models
            "openai/gpt-4": "gpt-4",
            "openai/gpt-4-turbo": "gpt-4-turbo",
            "gpt-4": "gpt-4",
            "gpt-4-turbo": "gpt-4-turbo",
            # Meta Llama models
            "meta-llama/llama-3.1-70b": "llama-3.1-70b-instruct",
            "meta-llama/llama-3-70b": "llama-3-70b-instruct",
            "llama-3.1-70b": "llama-3.1-70b-instruct",
            "llama-3-70b": "llama-3-70b-instruct",
            # Mistral models
            "mistralai/mistral-7b": "mistral-7b-instruct",
            "mistralai/mixtral-8x7b": "mixtral-8x7b-instruct",
            "mistral-7b": "mistral-7b-instruct",
            "mixtral-8x7b": "mixtral-8x7b-instruct",
        },
    }

    return mappings.get(provider, {})


def normalize_model_name(model_id: str) -> str:
    """
    Normalize model name for fuzzy matching.
    Handles common variations in model naming.
    """
    normalized = model_id.lower()

    # Remove org prefix if present
    if "/" in normalized:
        _, normalized = normalized.split("/", 1)

    # Normalize version numbers
    normalized = normalized.replace("v3p1", "v3")
    normalized = normalized.replace("v3.1", "v3")
    normalized = normalized.replace("3.3", "3p3")
    normalized = normalized.replace("3.1", "3p1")
    normalized = normalized.replace(".", "p")

    # Normalize separators
    normalized = normalized.replace("_", "-")

    # Remove common suffixes for matching
    for suffix in ["-instruct", "-chat", "-turbo", "-basic"]:
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]

    return normalized


def get_simplified_model_id(native_id: str, provider: str) -> str:
    """
    Convert a native provider model ID back to simplified format.
    This is the reverse of transform_model_id.

    Args:
        native_id: The provider's native model ID
        provider: The provider name

    Returns:
        A simplified, user-friendly model ID

    Examples:
        Input: "accounts/fireworks/models/deepseek-v3p1", provider="fireworks"
        Output: "deepseek-ai/deepseek-v3"
    """

    # Get reverse mapping
    mapping = get_model_id_mapping(provider)
    reverse_mapping = {v: k for k, v in mapping.items() if "/" in k}  # Only keep ones with org

    if native_id in reverse_mapping:
        return reverse_mapping[native_id]

    # For Fireworks, try to construct a reasonable simplified version
    if provider == "fireworks" and native_id.startswith("accounts/fireworks/models/"):
        model_name = native_id.replace("accounts/fireworks/models/", "")

        # Try to guess the org based on model name
        if model_name.startswith("deepseek"):
            return f"deepseek-ai/{model_name.replace('p', '.')}"
        elif model_name.startswith("llama"):
            return f"meta-llama/{model_name}"
        elif model_name.startswith("qwen"):
            return f"qwen/{model_name}"
        elif model_name.startswith("kimi"):
            return f"moonshot-ai/{model_name}"
        elif model_name.startswith("glm"):
            return f"zhipu-ai/{model_name}"
        else:
            # Unknown org, just return the model name
            return model_name

    # Return as-is if no transformation found
    return native_id


def detect_provider_from_model_id(model_id: str, preferred_provider: Optional[str] = None) -> Optional[str]:
    """
    Try to detect which provider a model belongs to based on its ID.

    Now supports multi-provider models with automatic provider selection.

    Args:
        model_id: The model ID to analyze
        preferred_provider: Optional preferred provider (for multi-provider models)

    Returns:
        The detected provider name, or None if unable to detect
    """

    # Check multi-provider registry first
    try:
        from src.services.multi_provider_registry import get_registry

        registry = get_registry()
        if registry.has_model(model_id):
            # Model is in multi-provider registry
            from src.services.provider_selector import get_selector

            selector = get_selector()
            selected_provider = selector.registry.select_provider(
                model_id=model_id,
                preferred_provider=preferred_provider,
            )

            if selected_provider:
                logger.info(
                    f"Multi-provider model {model_id}: selected {selected_provider.name} "
                    f"(priority {selected_provider.priority})"
                )
                return selected_provider.name
    except ImportError:
        # Multi-provider modules not available, fall through to legacy detection
        pass
    except Exception as e:
        logger.warning(f"Error checking multi-provider registry: {e}")
        # Fall through to legacy detection

    # Apply explicit overrides first
    normalized_id = (model_id or "").lower()
    normalized_base = normalized_id.split(":", 1)[0]
    override = MODEL_PROVIDER_OVERRIDES.get(normalized_base)
    if override:
        logger.info(f"Provider override for model '{model_id}': {override}")
        return override

    # OpenRouter models with colon-based suffixes (e.g., :exacto, :free, :extended)
    # These are OpenRouter-specific model variants
    if ":" in model_id and "/" in model_id:
        # Models like "z-ai/glm-4.6:exacto", "google/gemini-2.0-flash-exp:free"
        suffix = model_id.split(":", 1)[1]
        if suffix in ["exacto", "free", "extended"]:
            logger.info(f"Detected OpenRouter model with :{suffix} suffix: {model_id}")
            return "openrouter"

    # Check if it's already in a provider-specific format
    if model_id.startswith("accounts/fireworks/models/"):
        return "fireworks"

    # Normalize to lowercase for consistency in all @ prefix checks
    normalized_model = model_id.lower()

    # Check for Google Vertex AI models first (before Portkey check)
    if model_id.startswith("projects/") and "/models/" in model_id:
        return "google-vertex"
    if normalized_model.startswith("@google/models/") and any(
        pattern in normalized_model
        for pattern in ["gemini-2.5", "gemini-2.0", "gemini-1.5", "gemini-1.0"]
    ):
        # Patterns like "@google/models/gemini-2.5-flash"
        return "google-vertex"
    if (
        any(
            pattern in normalized_model
            for pattern in ["gemini-2.5", "gemini-2.0", "gemini-1.5", "gemini-1.0"]
        )
        and "/" not in model_id
    ):
        # Simple patterns like "gemini-2.5-flash", "gemini-2.0-flash" or "gemini-1.5-pro"
        return "google-vertex"
    if model_id.startswith("google/") and "gemini" in normalized_model:
        # Patterns like "google/gemini-2.5-flash" or "google/gemini-2.0-flash-001"
        # These can go to either Vertex AI or OpenRouter
        # Check if Vertex AI credentials are available
        import os

        # Debug logging
        gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        gvc = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
        logger.info(
            f"[CREDENTIAL CHECK] model={model_id}, "
            f"GOOGLE_APPLICATION_CREDENTIALS={'SET' if gac else 'NOT SET'}, "
            f"GOOGLE_VERTEX_CREDENTIALS_JSON={'SET (len=' + str(len(gvc)) + ')' if gvc else 'NOT SET'}"
        )

        has_credentials = gac or gvc
        if has_credentials:
            logger.info(f"✅ Routing {model_id} to google-vertex (credentials available)")
            return "google-vertex"
        else:
            # No Vertex credentials, route to OpenRouter which supports google/ prefix
            logger.warning(f"⚠️ Routing {model_id} to openrouter (no Vertex credentials found)")
            return "openrouter"

    # Note: @ prefix used to indicate Portkey format, but Portkey has been removed
    # After Portkey removal, @ prefix models are now routed through OpenRouter
    # which supports multi-provider model format
    if model_id.startswith("@") and "/" in model_id:
        if not normalized_model.startswith("@google/models/"):
            # Route @ prefix models (e.g., "@anthropic/claude-3-sonnet") to OpenRouter
            logger.info(f"Routing @ prefix model {model_id} to openrouter (Portkey removed)")
            return "openrouter"

    # Check all mappings to see if this model exists
    for provider in [
        "fireworks",
        "openrouter",
        "featherless",
        "together",
        "huggingface",
        "hug",
        "chutes",
        "google-vertex",
        "vercel-ai-gateway",
        "helicone",
        "aihubmix",
        "anannas",
        "near",
        "alpaca-network",
        "alibaba-cloud",
        "fal",
    ]:
        mapping = get_model_id_mapping(provider)
        if model_id in mapping:
            logger.info(f"Detected provider '{provider}' for model '{model_id}'")
            return provider

        # Also check the values (native formats)
        if model_id in mapping.values():
            logger.info(f"Detected provider '{provider}' for native model '{model_id}'")
            return provider

    # Check by model patterns
    if "/" in model_id:
        org, model_name = model_id.split("/", 1)

        # Google Vertex models should only be routed if explicitly in the mapping above
        # OpenRouter also has google/ models (with :free suffix) that should stay with OpenRouter
        # So we comment this out to avoid routing OpenRouter's google/ models to Vertex AI
        # if org == "google":
        #     return "google-vertex"

        # Near AI models (e.g., "near/deepseek-ai/DeepSeek-V3", "near/deepseek-ai/DeepSeek-R1")
        if org == "near":
            return "near"

        # Anannas models (e.g., "anannas/openai/gpt-4o")
        if org == "anannas":
            return "anannas"

        # OpenRouter models (e.g., "openrouter/auto")
        if org == "openrouter":
            return "openrouter"

        # Helicone models (e.g., "helicone/gpt-4o-mini")
        if org == "helicone":
            return "helicone"

        # Alpaca Network models (e.g., "alpaca-network/deepseek-v3-1")
        if org == "alpaca-network" or org == "alpaca":
            return "alpaca-network"

        # Alibaba Cloud / Qwen models (e.g., "qwen/qwen-plus", "alibaba-cloud/qwen-max")
        if org == "qwen" or org == "alibaba-cloud" or org == "alibaba":
            return "alibaba-cloud"

        # DeepSeek models are primarily on Fireworks in this system
        if org == "deepseek-ai" and "deepseek" in model_name.lower():
            return "fireworks"

        # OpenAI models go to OpenRouter
        if org == "openai":
            return "openrouter"

        # Anthropic models go to OpenRouter
        if org == "anthropic":
            return "openrouter"

        # Fal.ai models (e.g., "fal-ai/stable-diffusion-v15", "minimax/video-01")
        if org == "fal-ai" or org in [
            "fal",
            "minimax",
            "stabilityai",
            "hunyuan3d",
            "meshy",
            "tripo3d",
        ]:
            return "fal"

    logger.debug(f"Could not detect provider for model '{model_id}'")
    return None
