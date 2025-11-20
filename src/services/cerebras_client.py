"""
Cerebras client for direct API integration.

This client uses the official cerebras-cloud-sdk to interact with Cerebras AI models.
Falls back to OpenAI SDK with custom base URL if the official SDK is not available.
"""

import logging

# Initialize logging
logger = logging.getLogger(__name__)


def get_cerebras_client():
    """Get Cerebras client using official cerebras-cloud-sdk

    Cerebras provides ultra-fast inference through their official SDK.
    Falls back to OpenAI SDK with custom base URL if official SDK is not available.
    Base URL (for OpenAI SDK fallback): https://api.cerebras.ai/v1
    """
    try:
        # Lazy import to avoid circular dependencies
        from src.config import Config

        if not Config.CEREBRAS_API_KEY:
            raise ValueError("Cerebras API key not configured")

        # Try using the official Cerebras SDK first
        try:
            from cerebras.cloud.sdk import Cerebras

            return Cerebras(api_key=Config.CEREBRAS_API_KEY)
        except ImportError:
            # Fallback to OpenAI SDK with Cerebras base URL
            logger.info("Cerebras SDK not available, using OpenAI SDK with Cerebras base URL")
            from openai import OpenAI

            return OpenAI(base_url="https://api.cerebras.ai/v1", api_key=Config.CEREBRAS_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Cerebras client: {e}")
        raise


def make_cerebras_request_openai(messages, model, **kwargs):
    """Make request to Cerebras using official SDK or OpenAI-compatible client

    Args:
        messages: List of message objects
        model: Model name (e.g., "llama3.1-8b", "llama-3.3-70b", etc.)
        **kwargs: Additional parameters like max_tokens, temperature, etc.

    Returns:
        Response object from Cerebras API
    """
    try:
        client = get_cerebras_client()

        # Log request for debugging
        logger.debug(f"Cerebras request - model: {model}, messages: {len(messages)}")

        response = client.chat.completions.create(model=model, messages=messages, **kwargs)

        return response
    except Exception as e:
        logger.error(f"Cerebras request failed: {e}")
        raise


def make_cerebras_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Cerebras using official SDK or OpenAI-compatible client

    Args:
        messages: List of message objects
        model: Model name (e.g., "llama3.1-8b", "llama-3.3-70b", etc.)
        **kwargs: Additional parameters like max_tokens, temperature, etc.

    Returns:
        Streaming response generator from Cerebras API
    """
    try:
        client = get_cerebras_client()

        # Log request for debugging
        logger.debug(f"Cerebras streaming request - model: {model}, messages: {len(messages)}")

        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )

        return stream
    except Exception as e:
        logger.error(f"Cerebras streaming request failed: {e}")
        raise


def process_cerebras_response(response):
    """Process Cerebras response to extract relevant data

    Args:
        response: Response object from Cerebras API

    Returns:
        Standardized response dictionary
    """
    try:
        # Lazy import to avoid circular dependencies
        from src.services.anthropic_transformer import extract_message_with_tools

        choices = []
        for choice in response.choices:
            msg = extract_message_with_tools(choice.message)

            choices.append(
                {
                    "index": choice.index,
                    "message": msg,
                    "finish_reason": choice.finish_reason,
                }
            )

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
        logger.error(f"Failed to process Cerebras response: {e}")
        raise


def fetch_models_from_cerebras():
    """Fetch models from Cerebras API

    Cerebras does not provide a public API to list available models.
    Returns None to indicate no dynamic model listing is available.
    """
    logger.info("Cerebras does not provide a public model listing API")
    return None
