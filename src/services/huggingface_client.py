import logging
from openai import OpenAI
from src.config import Config

# Initialize logging
logger = logging.getLogger(__name__)

# Hugging Face Inference Router base URL
HF_INFERENCE_BASE_URL = "https://router.huggingface.co/v1"


def get_huggingface_client():
    """Get Hugging Face Inference API client using OpenAI-compatible interface

    Hugging Face Inference API provides OpenAI-compatible endpoints for various models.
    Requires HF_TOKEN environment variable (stored in HUG_API_KEY config).
    """
    try:
        if not Config.HUG_API_KEY:
            raise ValueError("Hugging Face API key (HUG_API_KEY) not configured")

        return OpenAI(
            base_url=HF_INFERENCE_BASE_URL,
            api_key=Config.HUG_API_KEY
        )
    except Exception as e:
        logger.error(f"Failed to initialize Hugging Face client: {e}")
        raise


def make_huggingface_request_openai(messages, model, **kwargs):
    """Make request to Hugging Face Inference API using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use (e.g., "meta-llama/Llama-2-7b-chat-hf", "katanemo/Arch-Router-1.5B:hf-inference")
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        logger.info(f"Making Hugging Face request with model: {model}")
        logger.debug(f"Request params: message_count={len(messages)}, kwargs={list(kwargs.keys())}")

        client = get_huggingface_client()
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )

        logger.info(f"Hugging Face request successful for model: {model}")
        return response
    except Exception as e:
        try:
            logger.error(f"Hugging Face request failed for model '{model}': {e}")
            logger.error(f"Error type: {type(e).__name__}")
            if hasattr(e, 'response'):
                logger.error(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
        except UnicodeEncodeError:
            logger.error(f"Hugging Face request failed (encoding error in logging)")
        raise


def make_huggingface_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Hugging Face Inference API using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        logger.info(f"Making Hugging Face streaming request with model: {model}")
        logger.debug(f"Request params: message_count={len(messages)}, kwargs={list(kwargs.keys())}")

        client = get_huggingface_client()
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            **kwargs
        )

        logger.info(f"Hugging Face streaming request initiated for model: {model}")
        return stream
    except Exception as e:
        try:
            logger.error(f"Hugging Face streaming request failed for model '{model}': {e}")
            logger.error(f"Error type: {type(e).__name__}")
            if hasattr(e, 'response'):
                logger.error(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
        except UnicodeEncodeError:
            logger.error(f"Hugging Face streaming request failed (encoding error in logging)")
        raise


def process_huggingface_response(response):
    """Process Hugging Face response to extract relevant data"""
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
        logger.error(f"Failed to process Hugging Face response: {e}")
        raise
