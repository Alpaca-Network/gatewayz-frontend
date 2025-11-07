import logging

from openai import OpenAI

from src.config import Config
from src.services.anthropic_transformer import extract_message_with_tools

# Initialize logging
logger = logging.getLogger(__name__)


def get_fireworks_client():
    """Get Fireworks.ai client using OpenAI-compatible interface

    Fireworks.ai provides OpenAI-compatible API endpoints for various models
    """
    try:
        if not Config.FIREWORKS_API_KEY:
            raise ValueError("Fireworks API key not configured")

        return OpenAI(
            base_url="https://api.fireworks.ai/inference/v1", api_key=Config.FIREWORKS_API_KEY
        )
    except Exception as e:
        logger.error(f"Failed to initialize Fireworks client: {e}")
        raise


def make_fireworks_request_openai(messages, model, **kwargs):
    """Make request to Fireworks.ai using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        logger.info(f"Making Fireworks request with model: {model}")
        # Don't log messages content as it might contain emojis that break Windows logging
        logger.debug(f"Request params: message_count={len(messages)}, kwargs={list(kwargs.keys())}")

        client = get_fireworks_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)

        logger.info(f"Fireworks request successful for model: {model}")
        return response
    except Exception as e:
        try:
            logger.error(f"Fireworks request failed for model '{model}': {e}")
            logger.error(f"Error type: {type(e).__name__}")
            if hasattr(e, "response"):
                logger.error(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
                # Don't log response body as it might contain problematic characters
        except UnicodeEncodeError:
            # Fallback if logging fails due to encoding issues
            logger.error("Fireworks request failed (encoding error in logging)")
        raise


def make_fireworks_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Fireworks.ai using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        logger.info(f"Making Fireworks streaming request with model: {model}")
        # Don't log messages content as it might contain emojis that break Windows logging
        logger.debug(f"Request params: message_count={len(messages)}, kwargs={list(kwargs.keys())}")

        client = get_fireworks_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )

        logger.info(f"Fireworks streaming request initiated for model: {model}")
        return stream
    except Exception as e:
        try:
            logger.error(f"Fireworks streaming request failed for model '{model}': {e}")
            logger.error(f"Error type: {type(e).__name__}")
            if hasattr(e, "response"):
                logger.error(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
                # Don't log response body as it might contain problematic characters
        except UnicodeEncodeError:
            # Fallback if logging fails due to encoding issues
            logger.error("Fireworks streaming request failed (encoding error in logging)")
        raise


def process_fireworks_response(response):
    """Process Fireworks response to extract relevant data"""
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
        logger.error(f"Failed to process Fireworks response: {e}")
        raise
