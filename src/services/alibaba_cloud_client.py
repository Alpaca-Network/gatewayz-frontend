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
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )
        return response
    except Exception as e:
        logger.error(f"Alibaba Cloud request failed: {e}")
        raise


def process_alibaba_cloud_response(response):
    """Process Alibaba Cloud response to extract relevant data"""
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
        logger.error(f"Failed to process Alibaba Cloud response: {e}")
        raise


def make_alibaba_cloud_request_openai_stream(messages, model, **kwargs):
    """Make streaming request to Alibaba Cloud using OpenAI-compatible API"""
    try:
        client = get_alibaba_cloud_client()
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            **kwargs
        )
        return stream
    except Exception as e:
        logger.error(f"Alibaba Cloud streaming request failed: {e}")
        raise
