import logging

from openai import OpenAI

from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def get_aimo_client():
    """Get AIMO Network client using OpenAI-compatible interface

    AIMO Network is a decentralized AI marketplace providing OpenAI-compatible API endpoints
    Base URL: https://devnet.aimo.network/api/v1/
    """
    try:
        if not Config.AIMO_API_KEY:
            raise ValueError("AIMO API key not configured")

        return OpenAI(base_url="https://devnet.aimo.network/api/v1", api_key=Config.AIMO_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize AIMO client: {e}")
        raise


def make_aimo_request_openai(messages, model, **kwargs):
    """Make request to AIMO Network using OpenAI client

    Args:
        messages: List of message objects
        model: Model name in format "provider_pubkey:model_name"
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_aimo_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"AIMO request failed: {e}")
        raise


def make_aimo_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to AIMO Network using OpenAI client

    Args:
        messages: List of message objects
        model: Model name in format "provider_pubkey:model_name"
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_aimo_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"AIMO streaming request failed: {e}")
        raise


def process_aimo_response(response):
    """Process AIMO response to extract relevant data"""
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
        logger.error(f"Failed to process AIMO response: {e}")
        raise
