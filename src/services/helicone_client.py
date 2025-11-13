import logging
from openai import OpenAI
from src.config import Config
from src.services.anthropic_transformer import extract_message_with_tools

# Initialize logging
logger = logging.getLogger(__name__)


def get_helicone_client():
    """Get Helicone AI Gateway client using OpenAI-compatible interface

    Helicone AI Gateway is an observability and monitoring platform that provides
    access to multiple AI providers with logging, caching, and analytics capabilities.

    Base URL: https://ai-gateway.helicone.ai/v1
    Documentation: https://docs.helicone.ai/gateway/overview
    """
    try:
        api_key = Config.HELICONE_API_KEY
        if not api_key:
            raise ValueError(
                "Helicone AI Gateway API key not configured. Please set HELICONE_API_KEY environment variable."
            )

        # Create client with reasonable timeout (60s for completion requests)
        # Default timeout for OpenAI is 600s which is too long
        return OpenAI(
            base_url="https://ai-gateway.helicone.ai/v1",
            api_key=api_key,
            timeout=60.0,
            max_retries=2,
        )
    except Exception as e:
        logger.error(f"Failed to initialize Helicone AI Gateway client: {e}")
        raise


def make_helicone_request_openai(messages, model, **kwargs):
    """Make request to Helicone AI Gateway using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "gpt-4o-mini", "claude-3-sonnet")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_helicone_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"Helicone AI Gateway request failed: {e}")
        raise


def make_helicone_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Helicone AI Gateway using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "gpt-4o-mini", "claude-3-sonnet")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_helicone_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Helicone AI Gateway streaming request failed: {e}")
        raise


def process_helicone_response(response):
    """Process Helicone AI Gateway response to extract relevant data"""
    try:
        choices = []
        for choice in response.choices:
            msg = extract_message_with_tools(choice.message)

            choices.append({
                "index": choice.index,
                "message": msg,
                "finish_reason": choice.finish_reason,
            })

        return {
            "id": response.id,
            "object": response.object,
            "created": response.created,
            "model": response.model,
            "choices": choices,
            "usage": (
                {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }
                if response.usage
                else {}
            ),
        }
    except Exception as e:
        logger.error(f"Failed to process Helicone AI Gateway response: {e}")
        raise


def fetch_model_pricing_from_helicone(model_id: str):
    """Fetch pricing information for a specific model from Helicone AI Gateway

    Helicone AI Gateway routes requests to various providers (OpenAI, Anthropic, etc.)
    This function attempts to determine the pricing by looking up the base provider's pricing.

    Args:
        model_id: Model identifier (e.g., "gpt-4o-mini", "claude-3-sonnet")

    Returns:
        dict with 'prompt' and 'completion' pricing per 1M tokens, or None if not available
    """
    try:
        import httpx
        from src.services.models import _is_building_catalog

        # If we're building the catalog, return None to avoid circular dependency
        if _is_building_catalog():
            logger.debug(f"Skipping pricing fetch for {model_id} (catalog building in progress)")
            return None

        api_key = Config.HELICONE_API_KEY
        if not api_key or api_key == "placeholder-key":
            logger.debug(f"Cannot fetch pricing for {model_id}: no valid API key configured")
            return None

        # Attempt to fetch from Helicone pricing endpoint (if it exists)
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        try:
            response = httpx.get(
                "https://ai-gateway.helicone.ai/v1/pricing", headers=headers, timeout=5.0
            )

            if response.status_code == 200:
                pricing_data = response.json()
                # Look for model in response
                if isinstance(pricing_data, dict):
                    if model_id in pricing_data:
                        return pricing_data[model_id]
                    # Try without provider prefix
                    model_name = model_id.split("/")[-1] if "/" in model_id else model_id
                    if model_name in pricing_data:
                        return pricing_data[model_name]
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.debug(f"Helicone pricing endpoint not available: {e}")

        # Fallback: use provider-specific pricing lookup
        return get_provider_pricing_for_helicone_model(model_id)

    except Exception as e:
        logger.error(f"Failed to fetch pricing for Helicone model {model_id}: {e}")
        return None


def get_provider_pricing_for_helicone_model(model_id: str):
    """Get pricing for a Helicone model by looking up the underlying provider's pricing

    Helicone routes models to providers like OpenAI, Anthropic, etc.
    We can determine pricing by identifying the provider and looking up their rates.

    Args:
        model_id: Model identifier (e.g., "gpt-4o-mini", "claude-3-sonnet")

    Returns:
        dict with 'prompt' and 'completion' pricing per 1M tokens
    """
    try:
        # Cross-reference with known provider pricing from the system
        # This leverages the existing pricing infrastructure
        try:
            from src.services.models import _is_building_catalog
            from src.services.pricing import get_model_pricing

            # If we're building the catalog, return None to avoid circular dependency
            # The pricing will be populated in a later pass if needed
            if _is_building_catalog():
                logger.debug(
                    f"Skipping provider pricing lookup for {model_id} (catalog building in progress)"
                )
                return None

            # Try the full model ID first
            pricing = get_model_pricing(model_id)
            if pricing and pricing.get("found"):
                return {
                    "prompt": pricing.get("prompt", "0"),
                    "completion": pricing.get("completion", "0"),
                }

            # Try without the provider prefix
            model_name_only = model_id.split("/")[-1] if "/" in model_id else model_id
            pricing = get_model_pricing(model_name_only)
            if pricing and pricing.get("found"):
                return {
                    "prompt": pricing.get("prompt", "0"),
                    "completion": pricing.get("completion", "0"),
                }
        except ImportError:
            logger.debug("pricing module not available for cross-reference")

        return None

    except Exception as e:
        logger.debug(f"Failed to get provider pricing for {model_id}: {e}")
        return None
