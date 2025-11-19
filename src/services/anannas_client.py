import logging

from openai import OpenAI

from src.config import Config
from src.services.anthropic_transformer import extract_message_with_tools

# Initialize logging
logger = logging.getLogger(__name__)


def get_anannas_client():
    """Get Anannas client using OpenAI-compatible interface

    Anannas provides OpenAI-compatible API endpoints for accessing various models
    """
    try:
        if not Config.ANANNAS_API_KEY:
            raise ValueError("Anannas API key not configured")

        return OpenAI(base_url="https://api.anannas.ai/v1", api_key=Config.ANANNAS_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Anannas client: {e}")
        raise


def make_anannas_request_openai(messages, model, **kwargs):
    """Make request to Anannas using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_anannas_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"Anannas request failed: {e}")
        raise


def make_anannas_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Anannas using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_anannas_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Anannas streaming request failed: {e}")
        raise


def process_anannas_response(response):
    """Process Anannas response to extract relevant data"""
    try:
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
        logger.error(f"Failed to process Anannas response: {e}")
        raise
