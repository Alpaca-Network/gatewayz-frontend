"""
Pricing Lookup Service
Provides manual pricing lookup for providers that don't expose pricing via API
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Cache for pricing data
_pricing_cache: Optional[Dict[str, Any]] = None


def load_manual_pricing() -> Dict[str, Any]:
    """Load manual pricing data from JSON file"""
    global _pricing_cache

    if _pricing_cache is not None:
        return _pricing_cache

    try:
        pricing_file = Path(__file__).parent.parent / "data" / "manual_pricing.json"

        if not pricing_file.exists():
            logger.warning(f"Manual pricing file not found: {pricing_file}")
            return {}

        with open(pricing_file) as f:
            _pricing_cache = json.load(f)

        logger.info(f"Loaded manual pricing data for {len(_pricing_cache) - 1} providers")
        return _pricing_cache

    except Exception as e:
        logger.error(f"Failed to load manual pricing: {e}")
        return {}


def get_model_pricing(gateway: str, model_id: str) -> Optional[Dict[str, str]]:
    """
    Get pricing for a specific model from manual pricing data

    Args:
        gateway: Gateway name (e.g., 'deepinfra', 'featherless', 'chutes')
        model_id: Model ID (e.g., 'meta-llama/Meta-Llama-3.1-8B-Instruct')

    Returns:
        Pricing dictionary or None if not found
    """
    try:
        pricing_data = load_manual_pricing()

        if not pricing_data:
            return None

        gateway_lower = gateway.lower()

        if gateway_lower not in pricing_data:
            return None

        gateway_pricing = pricing_data[gateway_lower]

        if model_id in gateway_pricing:
            return gateway_pricing[model_id]

        # Try case-insensitive match
        for key, value in gateway_pricing.items():
            if key.lower() == model_id.lower():
                return value

        return None

    except Exception as e:
        logger.error(f"Error getting pricing for {gateway}/{model_id}: {e}")
        return None


def enrich_model_with_pricing(model_data: Dict[str, Any], gateway: str) -> Dict[str, Any]:
    """
    Enrich model data with manual pricing if available

    Args:
        model_data: Model dictionary
        gateway: Gateway name

    Returns:
        Enhanced model dictionary with pricing
    """
    try:
        model_id = model_data.get("id")
        if not model_id:
            return model_data

        # Skip if pricing already exists and is not None
        existing_pricing = model_data.get("pricing")
        if existing_pricing and any(v for v in existing_pricing.values() if v is not None):
            return model_data

        # Try to get manual pricing
        manual_pricing = get_model_pricing(gateway, model_id)

        if manual_pricing:
            model_data["pricing"] = manual_pricing
            model_data["pricing_source"] = "manual"
            logger.debug(f"Enriched {model_id} with manual pricing")

        return model_data

    except Exception as e:
        logger.error(f"Error enriching model with pricing: {e}")
        return model_data


def get_all_gateway_pricing(gateway: str) -> Dict[str, Dict[str, str]]:
    """
    Get all pricing for a specific gateway

    Args:
        gateway: Gateway name

    Returns:
        Dictionary of model_id -> pricing
    """
    try:
        pricing_data = load_manual_pricing()

        if not pricing_data:
            return {}

        gateway_lower = gateway.lower()

        if gateway_lower not in pricing_data:
            return {}

        return pricing_data[gateway_lower]

    except Exception as e:
        logger.error(f"Error getting all pricing for {gateway}: {e}")
        return {}


def get_pricing_metadata() -> Dict[str, Any]:
    """Get pricing metadata (last updated, sources, etc.)"""
    try:
        pricing_data = load_manual_pricing()
        return pricing_data.get("_metadata", {})
    except Exception as e:
        logger.error(f"Error getting pricing metadata: {e}")
        return {}


def refresh_pricing_cache():
    """Refresh the pricing cache by reloading from file"""
    global _pricing_cache
    _pricing_cache = None
    return load_manual_pricing()
