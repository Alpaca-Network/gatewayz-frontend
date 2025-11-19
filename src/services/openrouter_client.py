import logging

from fastapi import APIRouter

from src.config import Config
from src.services.anthropic_transformer import extract_message_with_tools
from src.services.connection_pool import get_openrouter_pooled_client

# Initialize logging
logger = logging.getLogger(__name__)

router = APIRouter()


def get_openrouter_client():
    """Get OpenRouter client with connection pooling for better performance"""
    try:
        if not Config.OPENROUTER_API_KEY:
            raise ValueError("OpenRouter API key not configured")

        # Use pooled client for ~10-20ms performance improvement per request
        return get_openrouter_pooled_client()
    except Exception as e:
        logger.error(f"Failed to initialize OpenRouter client: {e}")
        raise


def make_openrouter_request_openai(messages, model, **kwargs):
    """Make request to OpenRouter using OpenAI client"""
    try:
        client = get_openrouter_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"OpenRouter request failed: {e}")
        raise


def process_openrouter_response(response):
    """Process OpenRouter response to extract relevant data"""
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
        logger.error(f"Failed to process OpenRouter response: {e}")
        raise


def make_openrouter_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to OpenRouter using OpenAI client"""
    try:
        client = get_openrouter_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"OpenRouter streaming request failed: {e}")
        raise
