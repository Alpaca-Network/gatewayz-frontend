import logging
import os
import time
from typing import Any, Dict

import httpx

from src.config import Config

# Initialize logging
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
    **kwargs,
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
        headers = {"x-portkey-api-key": Config.PORTKEY_API_KEY, "Content-Type": "application/json"}

        # Method 1: Use virtual key if provided
        if virtual_key:
            headers["x-portkey-virtual-key"] = virtual_key
        # Method 2: Use @provider format (Portkey SDK style)
        # Normalize provider to lowercase for case-insensitive @ prefix checking
        elif provider and provider.lower().startswith("@"):
            # Use config-based provider format
            import json

            config = {"provider": provider.lower()}  # e.g., "@openai", "@stability-ai"
            headers["x-portkey-config"] = json.dumps(config)
        # Method 3: Legacy provider header
        elif provider:
            headers["x-portkey-provider"] = provider.lower()
        else:
            raise ValueError(
                "Either virtual_key or provider must be specified for Portkey image generation"
            )

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
        logger.error(
            f"Portkey image generation HTTP error: {e.response.status_code} - {e.response.text}"
        )
        raise
    except Exception as e:
        logger.error(f"Portkey image generation request failed: {e}")
        raise


def make_deepinfra_image_request(
    prompt: str, model: str = "stabilityai/sd3.5", size: str = "1024x1024", n: int = 1, **kwargs
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
            raise ValueError(
                "DeepInfra API key not configured. Please set DEEPINFRA_API_KEY environment variable"
            )

        url = "https://api.deepinfra.com/v1/openai/images/generations"

        headers = {
            "Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}",
            "Content-Type": "application/json",
        }

        payload = {"prompt": prompt, "model": model, "size": size, "n": n}

        # Add any additional kwargs
        payload.update(kwargs)

        logger.info(f"Making image generation request to DeepInfra with model {model}")

        # Make request
        response = httpx.post(url, headers=headers, json=payload, timeout=120.0)
        response.raise_for_status()

        return response.json()

    except httpx.HTTPStatusError as e:
        logger.error(
            f"DeepInfra image generation HTTP error: {e.response.status_code} - {e.response.text}"
        )
        raise
    except Exception as e:
        logger.error(f"DeepInfra image generation request failed: {e}")
        raise


def make_google_vertex_image_request(
    prompt: str,
    model: str = "stable-diffusion-1.5",
    size: str = "1024x1024",
    n: int = 1,
    project_id: str = None,
    location: str = None,
    endpoint_id: str = None,
    **kwargs,
) -> Dict[str, Any]:
    """Make image generation request to Google Vertex AI endpoint

    Args:
        prompt: Text description of the image to generate
        model: Model identifier (used for logging/tracking)
        size: Image dimensions (e.g., "512x512", "1024x1024")
        n: Number of images to generate
        project_id: Google Cloud project ID
        location: Google Cloud region (e.g., "us-central1")
        endpoint_id: Vertex AI endpoint ID
        **kwargs: Additional parameters for the model

    Returns:
        Dict containing generated images in OpenAI-compatible format
    """
    try:
        # Import Google Cloud AI Platform SDK
        try:
            from google.auth import impersonated_credentials
            from google.cloud import aiplatform
        except ImportError:
            raise ImportError(
                "google-cloud-aiplatform and google-auth packages are required. "
                "Install with: pip install google-cloud-aiplatform google-auth"
            ) from None

        # Use config values if not provided
        project_id = project_id or Config.GOOGLE_PROJECT_ID
        location = location or Config.GOOGLE_VERTEX_LOCATION
        endpoint_id = endpoint_id or Config.GOOGLE_VERTEX_ENDPOINT_ID

        if not project_id:
            raise ValueError(
                "Google Cloud project ID not configured. Set GOOGLE_PROJECT_ID environment variable"
            )
        if not endpoint_id:
            raise ValueError(
                "Google Vertex AI endpoint ID not configured. Set GOOGLE_VERTEX_ENDPOINT_ID environment variable"
            )

        logger.info(f"Making image generation request to Google Vertex AI endpoint {endpoint_id}")

        # Service account to impersonate (if key creation is disabled)
        target_sa = os.getenv(
            "GOOGLE_VERTEX_SERVICE_ACCOUNT", "vertex-client@gatewayz-468519.iam.gserviceaccount.com"
        )

        # Initialize Vertex AI using ADC (Application Default Credentials)
        # The initialize_vertex_ai() function handles GOOGLE_VERTEX_CREDENTIALS_JSON
        # and other credential sources automatically
        try:
            from src.services.google_vertex_client import initialize_vertex_ai

            # This will use ADC and handle temp file creation for GOOGLE_VERTEX_CREDENTIALS_JSON
            initialize_vertex_ai()
            logger.info("✓ Successfully initialized Vertex AI with ADC")

        except Exception as auth_error:
            logger.warning(f"Authentication setup: {auth_error}")
            # Fall back to default aiplatform initialization
            aiplatform.init(project=project_id, location=location)

        # Get the endpoint
        endpoint = aiplatform.Endpoint(endpoint_id)

        # Parse size to width and height
        try:
            width, height = map(int, size.split("x"))
        except (ValueError, AttributeError):
            width, height = 1024, 1024  # Default size

        # Prepare instance for Stability Diffusion model
        # The exact format depends on your model deployment
        instances = []
        for _ in range(n):
            instance = {
                "prompt": prompt,
                "width": width,
                "height": height,
                **kwargs,  # Allow additional parameters
            }
            instances.append(instance)

        # Make prediction request
        response = endpoint.predict(instances=instances)

        # Process predictions to OpenAI-compatible format
        # The response format depends on your model output
        data = []

        if hasattr(response, "predictions"):
            for prediction in response.predictions:
                # If the prediction contains base64 encoded image
                if isinstance(prediction, dict):
                    if "image" in prediction:
                        # Image is already base64 encoded
                        image_b64 = prediction["image"]
                    elif "b64_json" in prediction:
                        image_b64 = prediction["b64_json"]
                    else:
                        # Assume the prediction itself is the base64 string
                        image_b64 = str(prediction)
                else:
                    # Assume prediction is base64 string
                    image_b64 = str(prediction)

                data.append(
                    {
                        "b64_json": image_b64,
                        "url": None,  # Vertex AI typically returns base64, not URLs
                    }
                )

        # Return in OpenAI-compatible format
        return {
            "created": int(time.time()),
            "data": data,
            "provider": "google-vertex",
            "model": model,
        }

    except Exception as e:
        logger.error(f"Google Vertex AI image generation request failed: {e}")
        raise


def process_image_generation_response(
    response: Dict[str, Any], provider: str, model: str
) -> Dict[str, Any]:
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
            "model": model,
        }

    except Exception as e:
        logger.error(f"Failed to process image generation response: {e}")
        raise
