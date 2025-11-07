import logging

from openai import OpenAI

from src.config import Config
from src.services.anthropic_transformer import extract_message_with_tools

# Initialize logging
logger = logging.getLogger(__name__)


def get_aihubmix_client():
    """Get AiHubMix client using OpenAI-compatible interface

    AiHubMix is a gateway service providing access to multiple AI models
    with a unified OpenAI-compatible API.

    Base URL: https://aihubmix.com/v1
    Documentation: https://aihubmix.com
    """
    try:
        api_key = Config.AIHUBMIX_API_KEY
        if not api_key:
            raise ValueError(
                "AiHubMix API key not configured. Please set AIHUBMIX_API_KEY environment variable."
            )

        app_code = Config.AIHUBMIX_APP_CODE
        if not app_code:
            raise ValueError(
                "AiHubMix APP-Code not configured. Please set AIHUBMIX_APP_CODE environment variable."
            )

        headers = {
            "APP-Code": app_code,
            "Content-Type": "application/json",
        }

        return OpenAI(
            base_url="https://aihubmix.com/v1",
            api_key=api_key,
            default_headers=headers,
        )
    except Exception as e:
        logger.error(f"Failed to initialize AiHubMix client: {e}")
        raise


def make_aihubmix_request_openai(messages, model, **kwargs):
    """Make request to AiHubMix using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "gpt-4o", "claude-3-sonnet")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_aihubmix_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"AiHubMix request failed: {e}")
        raise


def make_aihubmix_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to AiHubMix using OpenAI client

    Args:
        messages: List of message objects
        model: Model name (e.g., "gpt-4o", "claude-3-sonnet")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_aihubmix_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"AiHubMix streaming request failed: {e}")
        raise


def process_aihubmix_response(response):
    """Process AiHubMix response to extract relevant data"""
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
        logger.error(f"Failed to process AiHubMix response: {e}")
        raise
