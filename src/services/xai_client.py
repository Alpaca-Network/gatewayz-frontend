import logging
from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def get_xai_client():
    """Get xAI client using official xai-sdk

    xAI provides Grok models through their official SDK.
    Falls back to OpenAI SDK with custom base URL if official SDK is not available.
    Base URL (for OpenAI SDK fallback): https://api.x.ai/v1
    """
    try:
        if not Config.XAI_API_KEY:
            raise ValueError("xAI API key not configured")

        # Try using the official xAI SDK first
        try:
            from xai_sdk import Client

            return Client(api_key=Config.XAI_API_KEY)
        except ImportError:
            # Fallback to OpenAI SDK with xAI base URL
            logger.info("xAI SDK not available, using OpenAI SDK with xAI base URL")
            from openai import OpenAI

            return OpenAI(
                base_url="https://api.x.ai/v1",
                api_key=Config.XAI_API_KEY
            )
    except Exception as e:
        logger.error(f"Failed to initialize xAI client: {e}")
        raise


def make_xai_request_openai(messages, model, **kwargs):
    """Make request to xAI using official SDK or OpenAI-compatible client

    Args:
        messages: List of message objects
        model: Model name (e.g., "grok-beta", "grok-vision-beta")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_xai_client()
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )
        return response
    except Exception as e:
        logger.error(f"xAI request failed: {e}")
        raise


def make_xai_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to xAI using official SDK or OpenAI-compatible client

    Args:
        messages: List of message objects
        model: Model name (e.g., "grok-beta", "grok-vision-beta")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_xai_client()
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"xAI streaming request failed: {e}")
        raise


def process_xai_response(response):
    """Process xAI response to extract relevant data"""
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
        logger.error(f"Failed to process xAI response: {e}")
        raise
