"""
Clarifai client for LLM inference integration.

This client uses the official Clarifai Python SDK to interact with language models
available on the Clarifai platform. It supports both standard LLM models and
specialized models for reasoning and multimodal tasks.

Clarifai provides access to models like Claude, GPT-4, Llama, Mistral, and others
through a unified API.
"""

import json
import logging
from typing import Iterator, Optional

from src.config import Config
from src.services.anthropic_transformer import extract_message_with_tools
from src.services.connection_pool import get_clarifai_pooled_client

# Initialize logging
logger = logging.getLogger(__name__)


def get_clarifai_client():
    """Get Clarifai client with connection pooling.

    Uses the Clarifai API gateway endpoint that is compatible with OpenAI SDK
    via the universal inference API.
    """
    try:
        # Use pooled client for ~10-20ms performance improvement per request
        return get_clarifai_pooled_client()
    except Exception as e:
        logger.error(f"Failed to initialize Clarifai client: {e}")
        raise


def make_clarifai_request_openai(messages, model, **kwargs):
    """Make request to Clarifai using OpenAI-compatible API.

    Args:
        messages: List of message objects in OpenAI format
        model: Model ID (e.g., "claude-3.5-sonnet" or with user/app prefix)
        **kwargs: Additional parameters like max_tokens, temperature, etc.

    Returns:
        Response object from Clarifai API (OpenAI-compatible format)
    """
    try:
        client = get_clarifai_client()

        # Log request for debugging
        logger.debug(f"Clarifai request - model: {model}, messages: {len(messages)}")

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )

        return response
    except Exception as e:
        logger.error(f"Clarifai request failed: {e}")
        raise


def make_clarifai_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Clarifai using OpenAI-compatible API.

    Args:
        messages: List of message objects in OpenAI format
        model: Model ID (e.g., "claude-3.5-sonnet" or with user/app prefix)
        **kwargs: Additional parameters like max_tokens, temperature, etc.

    Returns:
        Streaming response generator from Clarifai API
    """
    try:
        client = get_clarifai_client()

        # Log request for debugging
        logger.debug(f"Clarifai streaming request - model: {model}, messages: {len(messages)}")

        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            **kwargs
        )

        return stream
    except Exception as e:
        logger.error(f"Clarifai streaming request failed: {e}")
        raise


def process_clarifai_response(response):
    """Process Clarifai response to extract relevant data.

    Normalizes Clarifai response to standard format compatible with
    the gateway's response handling.

    Args:
        response: Response object from Clarifai API

    Returns:
        Dict with normalized response data
    """
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
        logger.error(f"Failed to process Clarifai response: {e}")
        raise
