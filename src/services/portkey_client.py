import logging

from openai import OpenAI

from src.config import Config

from fastapi import APIRouter

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


def get_portkey_client(provider: str = "openai", virtual_key: str = None):
    """Get Portkey client with proper configuration

    Args:
        provider: The AI provider to use (e.g., "openai", "anthropic", "google-ai", etc.)
        virtual_key: Optional Portkey virtual key ID. If provided, uses Portkey's virtual key vault.
                    Otherwise, uses provider API key from environment variables.

    Note: Portkey supports two authentication methods:
    1. Virtual Keys (recommended): Store provider API keys in Portkey's secure vault and use virtual key ID
    2. Direct Provider Keys: Provide provider API keys directly via environment variables (PROVIDER_OPENAI_API_KEY, etc.)
    """
    try:
        if not Config.PORTKEY_API_KEY:
            raise ValueError("Portkey API key not configured")

        # Method 1: Using Portkey Virtual Keys (recommended)
        if virtual_key:
            return OpenAI(
                base_url="https://api.portkey.ai/v1",
                api_key="portkey",  # Dummy key when using virtual keys
                default_headers={
                    "x-portkey-api-key": Config.PORTKEY_API_KEY,
                    "x-portkey-virtual-key": virtual_key
                }
            )

        # Method 2: Using direct provider API keys
        else:
            # Get the provider-specific API key from environment
            provider_api_key = None
            if provider == "openai":
                provider_api_key = Config.PROVIDER_OPENAI_API_KEY
            elif provider == "anthropic":
                provider_api_key = Config.PROVIDER_ANTHROPIC_API_KEY
            # Add more providers as needed

            if not provider_api_key:
                raise ValueError(
                    f"Provider API key not configured for {provider}. "
                    f"Either set PROVIDER_{provider.upper()}_API_KEY environment variable "
                    f"or use Portkey virtual keys by providing a virtual_key parameter."
                )

            return OpenAI(
                base_url="https://api.portkey.ai/v1",
                api_key=provider_api_key,  # The provider's actual API key
                default_headers={
                    "x-portkey-api-key": Config.PORTKEY_API_KEY,
                    "x-portkey-provider": provider
                }
            )
    except Exception as e:
        logger.error(f"Failed to initialize Portkey client: {e}")
        raise


def make_portkey_request_openai(messages, model, provider: str = "openai", virtual_key: str = None, **kwargs):
    """Make request to Portkey using OpenAI client

    Args:
        messages: List of message objects
        model: Model name to use
        provider: AI provider (e.g., "openai", "anthropic", "google-ai")
        virtual_key: Optional Portkey virtual key ID for secure key vault usage
        **kwargs: Additional parameters like max_tokens, temperature, etc.
    """
    try:
        client = get_portkey_client(provider, virtual_key)
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
