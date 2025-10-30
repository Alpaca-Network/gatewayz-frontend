import logging
import httpx
import time
from typing import Dict, Any

from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)


def make_fal_image_request(
    prompt: str,
    model: str = "fal-ai/stable-diffusion-v15",
    size: str = "1024x1024",
    n: int = 1,
    **kwargs
) -> Dict[str, Any]:
    """Make image generation request to Fal.ai

    Args:
        prompt: Text description of the image to generate
        model: Model to use (e.g., "fal-ai/stable-diffusion-v15")
        size: Image dimensions (e.g., "512x512", "1024x1024")
        n: Number of images to generate
        **kwargs: Additional parameters like negative_prompt, guidance_scale, etc.

    Returns:
        Dict containing generated images in OpenAI-compatible format
    """
    try:
        if not Config.FAL_API_KEY:
            raise ValueError("Fal.ai API key not configured. Please set FAL_API_KEY environment variable")

        # Fal.ai API endpoint - using subscribe endpoint for synchronous requests
        url = f"https://fal.run/{model}"

        headers = {
            "Authorization": f"Key {Config.FAL_API_KEY}",
            "Content-Type": "application/json"
        }

        # Parse size to width and height for Fal.ai
        try:
            width, height = map(int, size.split('x'))
        except (ValueError, AttributeError):
            width, height = 1024, 1024  # Default size

        # Map standard size strings to Fal.ai image_size format
        size_mapping = {
            "512x512": "square",
            "1024x1024": "square_hd",
            "768x1024": "portrait_4_3",
            "576x1024": "portrait_16_9",
            "1024x768": "landscape_4_3",
            "1024x576": "landscape_16_9"
        }

        # Build Fal.ai request payload
        payload = {
            "prompt": prompt,
            "num_images": n
        }

        # Add image size - use mapping or custom dimensions
        if size in size_mapping:
            payload["image_size"] = size_mapping[size]
        else:
            payload["image_size"] = {
                "width": width,
                "height": height
            }

        # Add optional Fal.ai-specific parameters from kwargs
        fal_params = [
            "negative_prompt",
            "num_inference_steps",
            "seed",
            "guidance_scale",
            "sync_mode",
            "enable_safety_checker",
            "expand_prompt",
            "format"
        ]

        for param in fal_params:
            if param in kwargs:
                payload[param] = kwargs[param]

        logger.info(f"Making image generation request to Fal.ai with model {model}")

        # Make synchronous request to Fal.ai
        response = httpx.post(url, headers=headers, json=payload, timeout=120.0)
        response.raise_for_status()

        fal_response = response.json()

        # Convert Fal.ai response to OpenAI-compatible format
        data = []
        if "images" in fal_response:
            for img in fal_response["images"]:
                data.append({
                    "url": img.get("url"),
                    "b64_json": None  # Fal.ai returns URLs by default
                })

        return {
            "created": int(time.time()),
            "data": data,
            "provider": "fal",
            "model": model
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"Fal.ai image generation HTTP error: {e.response.status_code} - {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"Fal.ai image generation request failed: {e}")
        raise
