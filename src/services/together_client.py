import logging

from openai import OpenAI

from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def get_together_client():
    """Get Together.ai client using OpenAI-compatible interface

    Together.ai provides OpenAI-compatible API endpoints for various models
    """
    try:
        if not Config.TOGETHER_API_KEY:
            raise ValueError("Together API key not configured")

        return OpenAI(base_url="https://api.together.xyz/v1", api_key=Config.TOGETHER_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Together client: {e}")
        raise


def make_together_request_openai(messages, model, **kwargs):
    """Make request to Together.ai using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_together_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"Together request failed: {e}")
        raise


def make_together_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Together.ai using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_together_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Together streaming request failed: {e}")
        raise


def process_together_response(response):
    """Process Together response to extract relevant data"""
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
        logger.error(f"Failed to process Together response: {e}")
        raise
