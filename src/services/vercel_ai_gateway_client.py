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
            # If no API key is configured, create a client with a placeholder
            # The actual error will be caught at request time if needed
            api_key = "placeholder-key"
            logger.warning("Vercel AI Gateway API key not configured, using placeholder")

        return OpenAI(
            base_url="https://ai-gateway.vercel.sh/v1",
            api_key=api_key
        )
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
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )
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
            model=model,
            messages=messages,
            stream=True,
            **kwargs
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
                    "message": {
                        "role": choice.message.role,
                        "content": choice.message.content
                    },
                    "finish_reason": choice.finish_reason
                }
                for choice in response.choices
            ],
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            } if response.usage else {}
        }
    except Exception as e:
        logger.error(f"Failed to process Vercel AI Gateway response: {e}")
        raise
