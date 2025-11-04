import logging
from openai import OpenAI
from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def get_vercel_ai_gateway_client():
    """Get Vercel AI Gateway client using OpenAI-compatible interface

    Vercel AI Gateway is a unified interface to multiple AI providers with automatic failover,
    caching, and analytics. It provides access to hundreds of models across different providers.

    Base URL: https://ai-gateway.vercel.sh/v1
    Documentation: https://vercel.com/docs/ai-gateway
    """
    try:
        api_key = Config.VERCEL_AI_GATEWAY_API_KEY
        if not api_key:
            raise ValueError(
                "Vercel AI Gateway API key not configured. Please set VERCEL_AI_GATEWAY_API_KEY environment variable."
            )

        return OpenAI(base_url="https://ai-gateway.vercel.sh/v1", api_key=api_key)
    except Exception as e:
        logger.error(f"Failed to initialize Vercel AI Gateway client: {e}")
        raise


def make_vercel_ai_gateway_request_openai(messages, model, **kwargs):
    """Make request to Vercel AI Gateway using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "gpt-4", "claude-3-sonnet")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_vercel_ai_gateway_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"Vercel AI Gateway request failed: {e}")
        raise


def make_vercel_ai_gateway_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Vercel AI Gateway using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "gpt-4", "claude-3-sonnet")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_vercel_ai_gateway_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Vercel AI Gateway streaming request failed: {e}")
        raise


def process_vercel_ai_gateway_response(response):
    """Process Vercel AI Gateway response to extract relevant data"""
    try:
        return {
            "id": response.id,
            "object": response.object,
            "created": response.created,
            "model": response.model,
            "choices": [
                {
                    "index": choice.index,
                    "message": {"role": choice.message.role, "content": choice.message.content},
                    "finish_reason": choice.finish_reason,
                }
                for choice in response.choices
            ],
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
        logger.error(f"Failed to process Vercel AI Gateway response: {e}")
        raise


def fetch_model_pricing_from_vercel(model_id: str):
    """Fetch pricing information for a specific model from Vercel AI Gateway

    Vercel AI Gateway routes requests to various providers (OpenAI, Google, Anthropic, etc.)
    This function attempts to determine the pricing by looking up the base provider's pricing.

    Args:
        model_id: Model identifier (e.g., "openai/gpt-4", "claude-3-sonnet")

    Returns:
        dict with 'prompt' and 'completion' pricing per 1M tokens, or None if not available
    """
    try:
        import httpx

        # Try to get pricing from Vercel's pricing endpoint if available
        # Note: As of documentation check, Vercel doesn't expose model pricing via API
        # Instead, we cross-reference with known provider pricing

        api_key = Config.VERCEL_AI_GATEWAY_API_KEY
        if not api_key or api_key == "placeholder-key":
            logger.debug(f"Cannot fetch pricing for {model_id}: no valid API key configured")
            return None

        # Attempt to fetch from Vercel pricing endpoint (if it exists)
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        try:
            response = httpx.get(
                "https://ai-gateway.vercel.sh/v1/pricing", headers=headers, timeout=5.0
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
            logger.debug(f"Vercel pricing endpoint not available: {e}")

        # Fallback: use provider-specific pricing lookup
        return get_provider_pricing_for_vercel_model(model_id)

    except Exception as e:
        logger.error(f"Failed to fetch pricing for Vercel model {model_id}: {e}")
        return None


def get_provider_pricing_for_vercel_model(model_id: str):
    """Get pricing for a Vercel model by looking up the underlying provider's pricing

    Vercel routes models to providers like OpenAI, Google, Anthropic, etc.
    We can determine pricing by identifying the provider and looking up their rates.

    Args:
        model_id: Model identifier (e.g., "openai/gpt-4", "anthropic/claude-3-sonnet")

    Returns:
        dict with 'prompt' and 'completion' pricing per 1M tokens
    """
    try:
        # Cross-reference with known provider pricing from the system
        # This leverages the existing pricing infrastructure
        try:
            from src.services.pricing import get_model_pricing

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
