import logging

from openai import OpenAI

from src.config import Config

from fastapi import APIRouter

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


PORTKEY_BASE_URL = "https://api.portkey.ai/v1"


def _resolve_virtual_key(provider: str, override: str | None = None) -> str | None:
    """Resolve the Portkey virtual key from explicit request or environment."""
    if override:
        return override
    return Config.get_portkey_virtual_key(provider)


def get_portkey_client():
    """Get Portkey client with proper configuration"""
    try:
        if not Config.PORTKEY_API_KEY:
            raise ValueError("Portkey API key not configured")

        headers = {
            "x-portkey-api-key": Config.PORTKEY_API_KEY,
        }

        return OpenAI(
            base_url=PORTKEY_BASE_URL,
            api_key=Config.PORTKEY_API_KEY,
            default_headers=headers,
        )
    except Exception as e:
        logger.error(f"Failed to initialize Portkey client: {e}")
        raise


def make_portkey_request_openai(messages, model, **kwargs):
    """Make request to Portkey using OpenAI client"""
    try:
        client = get_portkey_client()
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )
        return response
    except Exception as e:
        logger.error(f"Portkey request failed: {e}")
        raise


def process_portkey_response(response):
    """Process Portkey response to extract relevant data"""
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
        logger.error(f"Failed to process Portkey response: {e}")
        raise


def make_portkey_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Portkey using OpenAI client"""
    try:
        client = get_portkey_client()
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Portkey streaming request failed: {e}")
        raise
