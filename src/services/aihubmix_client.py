import logging

from openai import OpenAI

from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
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
        logger.error(f"Failed to process AiHubMix response: {e}")
        raise


def fetch_models_from_aihubmix():
    """Fetch available models from AiHubMix API"""
    try:
        client = get_aihubmix_client()
        response = client.models.list()

        if not response or not hasattr(response, "data"):
            logger.warning("No models returned from AiHubMix")
            return []

        models = [model for model in response.data if model]
        logger.info(f"Fetched {len(models)} models from AiHubMix")
        return models
    except Exception as e:
        logger.error(f"Failed to fetch models from AiHubMix: {e}")
        return []


def normalize_aihubmix_model(model) -> dict | None:
    """Normalize AiHubMix model to catalog schema

    Args:
        model: Model object from AiHubMix API

    Returns:
        Normalized model dictionary or None if invalid
    """
    try:
        model_id = getattr(model, "id", None)
        if not model_id:
            logger.warning(f"AiHubMix model missing 'id': {model}")
            return None

        return {
            "id": model_id,
            "slug": f"aihubmix/{model_id}",
            "canonical_slug": f"aihubmix/{model_id}",
            "hugging_face_id": None,
            "name": getattr(model, "name", model_id),
            "created": getattr(model, "created_at", None),
            "description": getattr(model, "description", f"Model from AiHubMix"),
            "context_length": getattr(model, "context_length", 4096),
            "architecture": {
                "modality": "text->text",
                "input_modalities": ["text"],
                "output_modalities": ["text"],
                "instruct_type": "chat",
            },
            "pricing": {
                "prompt": "0",
                "completion": "0",
                "request": "0",
                "image": "0",
            },
            "top_provider": None,
            "per_request_limits": None,
            "supported_parameters": [],
            "default_parameters": {},
            "provider_slug": "aihubmix",
            "provider_site_url": "https://aihubmix.com",
            "model_logo_url": None,
            "source_gateway": "aihubmix",
        }
    except Exception as e:
        logger.error(f"Failed to normalize AiHubMix model: {e}")
        return None
