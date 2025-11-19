import logging

from openai import OpenAI

from src.config import Config
from src.services.anthropic_transformer import extract_message_with_tools

# Initialize logging
logger = logging.getLogger(__name__)


def get_alibaba_cloud_client():
    """Get Alibaba Cloud client with proper configuration"""
    try:
        if not Config.ALIBABA_CLOUD_API_KEY:
            raise ValueError("Alibaba Cloud API key not configured")

        # Use Singapore region by default, can be switched to Beijing
        base_url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

        return OpenAI(
            base_url=base_url,
            api_key=Config.ALIBABA_CLOUD_API_KEY,
        )
    except Exception as e:
        logger.error(f"Failed to initialize Alibaba Cloud client: {e}")
        raise


def make_alibaba_cloud_request_openai(messages, model, **kwargs):
    """Make request to Alibaba Cloud using OpenAI-compatible API"""
    try:
        client = get_alibaba_cloud_client()
        response = client.chat.completions.create(model=model, messages=messages, **kwargs)
        return response
    except Exception as e:
        logger.error(f"Alibaba Cloud request failed: {e}")
        raise


def process_alibaba_cloud_response(response):
    """Process Alibaba Cloud response to extract relevant data"""
    try:
        # Validate response has expected structure
        if not hasattr(response, "choices") or not response.choices:
            logger.error("Response missing 'choices' attribute")
            raise ValueError("Invalid Alibaba Cloud response format: missing choices")

        choices = []
        for choice in response.choices:
            # Extract message with fallback for different response formats
            if hasattr(choice, "message"):
                msg = extract_message_with_tools(choice.message)
            else:
                logger.warning("Choice missing 'message' attribute, creating default")
                msg = {"role": "assistant", "content": ""}

            finish_reason = getattr(choice, "finish_reason", "stop")
            choice_index = getattr(choice, "index", 0)

            choices.append(
                {
                    "index": choice_index,
                    "message": msg,
                    "finish_reason": finish_reason,
                }
            )

        # Build response with safe attribute access
        result = {
            "id": getattr(response, "id", "unknown"),
            "object": getattr(response, "object", "chat.completion"),
            "created": getattr(response, "created", 0),
            "model": getattr(response, "model", "unknown"),
            "choices": choices,
        }

        # Handle usage data safely
        if hasattr(response, "usage") and response.usage:
            result["usage"] = {
                "prompt_tokens": getattr(response.usage, "prompt_tokens", 0),
                "completion_tokens": getattr(response.usage, "completion_tokens", 0),
                "total_tokens": getattr(response.usage, "total_tokens", 0),
            }
        else:
            result["usage"] = {}

        logger.debug(f"Processed Alibaba Cloud response: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to process Alibaba Cloud response: {e}")
        raise


def make_alibaba_cloud_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Alibaba Cloud using OpenAI-compatible API"""
    try:
        client = get_alibaba_cloud_client()
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True, **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Alibaba Cloud streaming request failed: {e}")
        raise


def validate_stream_chunk(chunk):
    """Validate and ensure Alibaba Cloud stream chunk has required attributes"""
    try:
        # DashScope returns OpenAI-compatible format, but ensure attributes exist
        if not hasattr(chunk, "choices") or not chunk.choices:
            logger.warning("Stream chunk missing 'choices' attribute")
            return False

        for choice in chunk.choices:
            if not hasattr(choice, "delta"):
                logger.warning("Choice missing 'delta' attribute")
                return False

        return True
    except Exception as e:
        logger.error(f"Error validating stream chunk: {e}")
        return False
