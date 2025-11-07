"""
Pricing Service
Handles model pricing calculations and credit cost computation
"""

from typing import Dict
import logging

from src.services.models import get_cached_models

logger = logging.getLogger(__name__)


def get_model_pricing(model_id: str) -> Dict[str, float]:
    """
    Get pricing information for a specific model

    Args:
        model_id: The model ID (e.g., "openai/gpt-4", "anthropic/claude-3-opus")

    Returns:
        Dictionary with pricing info:
        {
            "prompt": float,      # Cost per prompt token in USD
            "completion": float,  # Cost per completion token in USD
            "found": bool         # Whether the model was found in catalog
        }
    """
    try:
        # Get all models from cache
        models = get_cached_models("all")
        if not models:
            logger.warning(f"No models in cache, using default pricing for {model_id}")
            return {"prompt": 0.00002, "completion": 0.00002, "found": False}

        # Strip provider-specific suffixes for matching
        # HuggingFace adds :hf-inference, other providers may add similar suffixes
        normalized_model_id = model_id
        provider_suffixes = [":hf-inference", ":openai", ":anthropic"]
        for suffix in provider_suffixes:
            if normalized_model_id.endswith(suffix):
                normalized_model_id = normalized_model_id[: -len(suffix)]
                logger.debug(
                    f"Normalized model ID from '{model_id}' to '{normalized_model_id}' for pricing lookup"
                )
                break

        # Find the specific model - try both original and normalized IDs
        for model in models:
            model_catalog_id = model.get("id")
            model_slug = model.get("slug")

            # Match against both original and normalized model IDs
            if model_catalog_id in (model_id, normalized_model_id) or model_slug in (
                model_id,
                normalized_model_id,
            ):
                pricing = model.get("pricing", {})

                # Convert pricing strings to floats, handling None and empty strings
                # Also ensure negative values (e.g., -1 for dynamic pricing) are treated as 0
                prompt_price = float(pricing.get("prompt", "0") or "0")
                prompt_price = max(0.0, prompt_price)  # Convert negative to 0

                completion_price = float(pricing.get("completion", "0") or "0")
                completion_price = max(0.0, completion_price)  # Convert negative to 0

                logger.info(
                    f"Found pricing for {model_id} (normalized: {normalized_model_id}): prompt=${prompt_price}, completion=${completion_price}"
                )

                return {"prompt": prompt_price, "completion": completion_price, "found": True}

        # Model not found, use default pricing
        logger.warning(
            f"Model {model_id} (normalized: {normalized_model_id}) not found in catalog, using default pricing"
        )
        return {"prompt": 0.00002, "completion": 0.00002, "found": False}

    except Exception as e:
        logger.error(f"Error getting pricing for model {model_id}: {e}")
        return {"prompt": 0.00002, "completion": 0.00002, "found": False}


def calculate_cost(model_id: str, prompt_tokens: int, completion_tokens: int) -> float:
    """
    Calculate the total cost for a chat completion based on model pricing

    Args:
        model_id: The model ID
        prompt_tokens: Number of prompt tokens used
        completion_tokens: Number of completion tokens used

    Returns:
        Total cost in USD
    """
    try:
        pricing = get_model_pricing(model_id)

        prompt_cost = prompt_tokens * pricing["prompt"]
        completion_cost = completion_tokens * pricing["completion"]
        total_cost = prompt_cost + completion_cost

        logger.info(
            f"Cost calculation for {model_id}: "
            f"{prompt_tokens} prompt tokens (${prompt_cost:.6f}) + "
            f"{completion_tokens} completion tokens (${completion_cost:.6f}) = "
            f"${total_cost:.6f}"
        )

        return total_cost

    except Exception as e:
        logger.error(f"Error calculating cost for {model_id}: {e}")
        # Fallback to simple calculation
        total_tokens = prompt_tokens + completion_tokens
        return total_tokens * 0.00002
