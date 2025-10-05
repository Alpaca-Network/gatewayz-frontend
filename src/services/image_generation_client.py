import logging
import httpx
import time
from typing import Dict, Any

from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def make_portkey_image_request(
    prompt: str,
    model: str = "dall-e-3",
    provider: str = None,  # Can be "@openai", "@stability-ai", etc.
    virtual_key: str = None,
    size: str = "1024x1024",
    n: int = 1,
    quality: str = "standard",
    style: str = "natural",
    **kwargs
) -> Dict[str, Any]:
    """Make image generation request to Portkey

    Args:
        prompt: Text description of the image to generate
        model: Model to use for image generation
        provider: Provider to route through Portkey (e.g., "stability-ai", "openai")
        virtual_key: Optional Portkey virtual key ID
        size: Image dimensions (e.g., "1024x1024")
        n: Number of images to generate
        quality: Image quality ("standard" or "hd")
        style: Image style ("natural" or "vivid")
        **kwargs: Additional provider-specific parameters
    """
    try:
        if not Config.PORTKEY_API_KEY:
            raise ValueError("Portkey API key not configured")

        # Portkey image generation endpoint
        url = "https://api.portkey.ai/v1/images/generations"

        # Build headers
        headers = {
            "x-portkey-api-key": Config.PORTKEY_API_KEY,
            "Content-Type": "application/json"
        }

        # Method 1: Use virtual key if provided
        if virtual_key:
            headers["x-portkey-virtual-key"] = virtual_key
        # Method 2: Use @provider format (Portkey SDK style)
        elif provider and provider.startswith("@"):
            # Use config-based provider format
            import json
            config = {
                "provider": provider  # e.g., "@openai", "@stability-ai"
            }
            headers["x-portkey-config"] = json.dumps(config)
        # Method 3: Legacy provider header
        elif provider:
            headers["x-portkey-provider"] = provider
        else:
            raise ValueError("Either virtual_key or provider must be specified for Portkey image generation")

        # Build request payload
        payload = {
            "prompt": prompt,
            "model": model,
            "n": n,
            "size": size,
        }

        # Add optional parameters
        if quality:
            payload["quality"] = quality
        if style:
            payload["style"] = style

        # Add any additional kwargs
        payload.update(kwargs)

        logger.info(f"Making image generation request to Portkey with model {model}")

        # Make request
        response = httpx.post(url, headers=headers, json=payload, timeout=120.0)
        response.raise_for_status()

        return response.json()

    except httpx.HTTPStatusError as e:
        logger.error(f"Portkey image generation HTTP error: {e.response.status_code} - {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"Portkey image generation request failed: {e}")
        raise


def make_deepinfra_image_request(
    prompt: str,
    model: str = "stabilityai/sd3.5",
    size: str = "1024x1024",
    n: int = 1,
    **kwargs
) -> Dict[str, Any]:
    """Make image generation request directly to DeepInfra

    Args:
        prompt: Text description of the image to generate
        model: Model to use (e.g., "stabilityai/sd3.5")
        size: Image dimensions
        n: Number of images
        **kwargs: Additional parameters
    """
    try:
        if not Config.DEEPINFRA_API_KEY:
            raise ValueError("DeepInfra API key not configured. Please set DEEPINFRA_API_KEY environment variable")

        url = "https://api.deepinfra.com/v1/openai/images/generations"

        headers = {
            "Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "prompt": prompt,
            "model": model,
            "size": size,
            "n": n
        }

        # Add any additional kwargs
        payload.update(kwargs)

        logger.info(f"Making image generation request to DeepInfra with model {model}")

        # Make request
        response = httpx.post(url, headers=headers, json=payload, timeout=120.0)
        response.raise_for_status()

        return response.json()

    except httpx.HTTPStatusError as e:
        logger.error(f"DeepInfra image generation HTTP error: {e.response.status_code} - {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"DeepInfra image generation request failed: {e}")
        raise


def process_image_generation_response(response: Dict[str, Any], provider: str, model: str) -> Dict[str, Any]:
    """Process image generation response to standard format

    Args:
        response: Raw response from provider
        provider: Provider that generated the images
        model: Model used for generation

    Returns:
        Standardized response matching ImageGenerationResponse model
    """
    try:
        # Check if response already has the expected format
        if "data" in response and "created" in response:
            # Already in correct format, just add provider and model if missing
            if "provider" not in response:
                response["provider"] = provider
            if "model" not in response:
                response["model"] = model
            return response

        # Otherwise, build standard response
        return {
            "created": int(time.time()),
            "data": response.get("data", []),
            "provider": provider,
            "model": model
        }

    except Exception as e:
        logger.error(f"Failed to process image generation response: {e}")
        raise
