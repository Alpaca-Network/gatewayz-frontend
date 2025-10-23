import logging
from openai import OpenAI
from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def get_near_client():
    """Get Near AI client using OpenAI-compatible interface

    Near AI is a decentralized AI infrastructure providing private, verifiable, and user-owned AI services
    Base URL: https://cloud-api.near.ai/v1
    """
    try:
        if not Config.NEAR_API_KEY:
            raise ValueError("Near AI API key not configured")

        return OpenAI(
            base_url="https://cloud-api.near.ai/v1",
            api_key=Config.NEAR_API_KEY
        )
    except Exception as e:
        logger.error(f"Failed to initialize Near AI client: {e}")
        raise


def make_near_request_openai(messages, model, **kwargs):
    """Make request to Near AI using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "deepseek-v3.1")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_near_client()
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )
        return response
    except Exception as e:
        logger.error(f"Near AI request failed: {e}")
        raise


def make_near_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Near AI using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "deepseek-v3.1")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_near_client()
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Near AI streaming request failed: {e}")
        raise


def process_near_response(response):
    """Process Near AI response to extract relevant data"""
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
        logger.error(f"Failed to process Near AI response: {e}")
        raise
