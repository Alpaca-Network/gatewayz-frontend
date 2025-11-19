import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from src.config import Config

# Initialize logging
logger = logging.getLogger(__name__)

# Cache for Fal.ai models catalog
_fal_models_cache: Optional[List[Dict[str, Any]]] = None

# Fal.ai API configuration
FAL_API_BASE = "https://fal.run"
FAL_QUEUE_API_BASE = "https://queue.fal.run"
FAL_REQUEST_TIMEOUT = 120.0  # seconds
FAL_QUEUE_POLL_INTERVAL = 1.0  # seconds
FAL_QUEUE_MAX_WAIT = 300.0  # 5 minutes


def load_fal_models_catalog() -> List[Dict[str, Any]]:
    """Load Fal.ai models catalog from the static JSON file

    Returns:
        List of Fal.ai model definitions with metadata
    """
    global _fal_models_cache

    if _fal_models_cache is not None:
        return _fal_models_cache

    try:
        catalog_path = Path(__file__).parent.parent / "data" / "fal_catalog.json"

        if catalog_path.exists():
            logger.info(f"Loading Fal.ai models from catalog: {catalog_path}")
            with open(catalog_path) as f:
                raw_data = json.load(f)

            # Filter out metadata objects and only keep actual model objects
            # Model objects must have an "id" field
            _fal_models_cache = [
                item for item in raw_data if isinstance(item, dict) and "id" in item
            ]

            logger.info(f"Loaded {len(_fal_models_cache)} Fal.ai models from catalog")
            return _fal_models_cache
        else:
            logger.warning(f"Fal.ai catalog not found at {catalog_path}")
            return []
    except Exception as e:
        logger.error(f"Failed to load Fal.ai models catalog: {e}")
        return []


def get_fal_models() -> List[Dict[str, Any]]:
    """Get list of all available Fal.ai models

    Returns:
        List of model dictionaries with id, name, type, and description
    """
    return load_fal_models_catalog()


def get_fal_models_by_type(model_type: str) -> List[Dict[str, Any]]:
    """Get Fal.ai models filtered by type

    Args:
        model_type: Type of model (e.g., "text-to-image", "image-to-video", "text-to-video")

    Returns:
        List of models matching the specified type
    """
    all_models = load_fal_models_catalog()
    return [model for model in all_models if model.get("type") == model_type]


def validate_fal_model(model_id: str) -> bool:
    """Check if a model ID is valid in the Fal.ai catalog

    Args:
        model_id: Model identifier to validate

    Returns:
        True if model exists in catalog, False otherwise
    """
    all_models = load_fal_models_catalog()
    return any(model.get("id") == model_id for model in all_models)


def _parse_image_size(size: str) -> tuple[int, int]:
    """Parse size string to width and height

    Args:
        size: Size string in format "WIDTHxHEIGHT"

    Returns:
        Tuple of (width, height)
    """
    try:
        width, height = map(int, size.lower().split("x"))
        return width, height
    except (ValueError, AttributeError):
        return 1024, 1024  # Default size


def _get_fal_image_size_param(size: str) -> dict | str:
    """Convert standard size to Fal.ai image_size parameter

    Fal.ai supports both named presets and custom dimensions

    Args:
        size: Size string in format "WIDTHxHEIGHT"

    Returns:
        Either a preset name (str) or custom dimensions dict
    """
    # Map standard sizes to Fal.ai preset names
    size_mapping = {
        "512x512": "square",
        "1024x1024": "square_hd",
        "768x1024": "portrait_4_3",
        "576x1024": "portrait_16_9",
        "1024x768": "landscape_4_3",
        "1024x576": "landscape_16_9",
    }

    if size in size_mapping:
        return size_mapping[size]

    # For custom sizes, return width and height dict
    width, height = _parse_image_size(size)
    return {"width": width, "height": height}


def _build_fal_payload(
    prompt: str,
    size: str,
    n: int,
    **kwargs,
) -> Dict[str, Any]:
    """Build Fal.ai request payload

    Args:
        prompt: Text description
        size: Image size
        n: Number of images
        **kwargs: Additional parameters

    Returns:
        Request payload for Fal.ai API
    """
    payload = {
        "prompt": prompt,
        "num_images": n,
        "image_size": _get_fal_image_size_param(size),
    }

    # Fal.ai model-specific parameters that can be passed through
    fal_params = [
        "negative_prompt",
        "num_inference_steps",
        "seed",
        "guidance_scale",
        "sync_mode",
        "enable_safety_checker",
        "expand_prompt",
        "format",
    ]

    for param in fal_params:
        if param in kwargs:
            payload[param] = kwargs[param]

    return payload


def _extract_images_from_response(fal_response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract images from Fal.ai response in OpenAI format

    Fal.ai responses vary by model type. This function handles:
    - Direct image URLs in "images" field
    - Other response formats common to video/3D models

    Args:
        fal_response: Raw response from Fal.ai API

    Returns:
        List of image objects in OpenAI format
    """
    data = []

    if "images" in fal_response:
        # Standard image generation response
        for img in fal_response["images"]:
            if isinstance(img, dict):
                data.append({
                    "url": img.get("url"),
                    "b64_json": None,
                })
            elif isinstance(img, str):
                # Sometimes Fal returns just URLs
                data.append({
                    "url": img,
                    "b64_json": None,
                })
    elif "image" in fal_response:
        # Single image response
        img = fal_response["image"]
        if isinstance(img, dict):
            data.append({
                "url": img.get("url"),
                "b64_json": None,
            })
        elif isinstance(img, str):
            data.append({
                "url": img,
                "b64_json": None,
            })
    elif "url" in fal_response:
        # Direct URL response
        data.append({
            "url": fal_response["url"],
            "b64_json": None,
        })

    return data


def make_fal_image_request(
    prompt: str,
    model: str = "fal-ai/stable-diffusion-v15",
    size: str = "1024x1024",
    n: int = 1,
    **kwargs,
) -> Dict[str, Any]:
    """Make image generation request to Fal.ai

    This endpoint supports ALL 839+ models available on Fal.ai!

    You can use ANY model from https://fal.ai/models by passing its model ID.
    The catalog includes popular models plus hundreds more across all categories.

    POPULAR MODELS:
    Text-to-Image:
      - fal-ai/flux-pro/v1.1-ultra - Highest quality FLUX model
      - fal-ai/flux/dev - Fast, high-quality generation
      - fal-ai/flux/schnell - Ultra-fast generation (1-4 steps)
      - fal-ai/imagen4/preview - Google's Imagen 4
      - fal-ai/recraft/v3/text-to-image - Recraft v3
      - fal-ai/stable-diffusion-v15 - Classic default
      - fal-ai/aura-flow - High-quality generation
      - fal-ai/omnigen-v1 - Versatile generation

    Text-to-Video:
      - fal-ai/veo3.1 - Google Veo 3.1 (latest)
      - fal-ai/sora-2/text-to-video - OpenAI Sora 2
      - fal-ai/sora-2/text-to-video/pro - Sora 2 Pro
      - fal-ai/kling-video/v2.5-turbo/pro/text-to-video - Kling Turbo
      - fal-ai/minimax/video-01 - MiniMax Video
      - fal-ai/wan-25-preview/text-to-video - WAN 2.5

    Image-to-Video:
      - fal-ai/veo3.1/image-to-video
      - fal-ai/sora-2/image-to-video
      - fal-ai/kling-video/v2.5-turbo/pro/image-to-video
      - fal-ai/wan-25-preview/image-to-video

    Plus 800+ more models for:
      - Image editing, upscaling, background removal
      - Video-to-video, lipsync, effects
      - Text-to-speech, audio generation
      - 3D generation, LoRA training
      - And much more!

    USAGE:
    Browse all models at https://fal.ai/models and use the model ID directly.
    Example: model="fal-ai/flux/dev" or model="bria/fibo/generate"

    Args:
        prompt: Text description of the content to generate
        model: Model ID from https://fal.ai/models (default: "fal-ai/stable-diffusion-v15")
               Supports ALL 839+ Fal.ai models - just pass the model ID!
        size: Image dimensions (e.g., "512x512", "1024x1024")
        n: Number of images to generate
        **kwargs: Model-specific parameters (negative_prompt, guidance_scale, etc.)

    Returns:
        Dict containing generated content in OpenAI-compatible format

    Raises:
        ValueError: If API key is not configured
        httpx.HTTPStatusError: If API request fails
    """
    if not Config.FAL_API_KEY:
        logger.error("FAL_API_KEY not configured")
        raise ValueError(
            "Fal.ai API key not configured. Please set FAL_API_KEY environment variable"
        )

    api_url = f"{FAL_API_BASE}/{model}"
    headers = {
        "Authorization": f"Key {Config.FAL_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        logger.info(f"Making Fal.ai request to {api_url} for model {model}")
        logger.debug(f"Request parameters: prompt={prompt[:50]}..., size={size}, n={n}")

        # Build request payload
        payload = _build_fal_payload(prompt, size, n, **kwargs)

        # Submit request using context manager for proper resource cleanup
        with httpx.Client(timeout=FAL_REQUEST_TIMEOUT) as client:
            response = client.post(api_url, headers=headers, json=payload)
            response.raise_for_status()
            fal_response = response.json()

        logger.info(f"Fal.ai request completed successfully for model {model}")

        # Extract images from response
        data = _extract_images_from_response(fal_response)

        if not data:
            logger.warning(f"Fal.ai response contained no images: {fal_response}")

        return {
            "created": int(time.time()),
            "data": data,
            "provider": "fal",
            "model": model,
        }

    except httpx.HTTPStatusError as e:
        logger.error(
            f"Fal.ai HTTP {e.response.status_code} error for model {model}: {e.response.text}"
        )
        raise
    except httpx.RequestError as e:
        logger.error(f"Fal.ai request error for model {model}: {e}")
        raise
    except Exception as e:
        logger.error(f"Fal.ai request failed for model {model}: {e}", exc_info=True)
        raise
