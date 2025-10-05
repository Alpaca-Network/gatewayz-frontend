import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from fastapi import APIRouter, Depends, HTTPException

from src.db.api_keys import increment_api_key_usage
from src.db.users import get_user, deduct_credits, record_usage
from src.models import ImageGenerationRequest, ImageGenerationResponse
from src.security.deps import get_api_key
from src.services.image_generation_client import make_portkey_image_request, make_deepinfra_image_request, process_image_generation_response

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/v1/images/generations", response_model=ImageGenerationResponse, tags=["images"])
async def generate_images(req: ImageGenerationRequest, api_key: str = Depends(get_api_key)):
    """
    OpenAI-compatible image generation endpoint.

    Generate images from text prompts using various AI models.
    Supports providers like Stability AI (Stable Diffusion), OpenAI (DALL-E), and more through Portkey.

    Example request:
    ```json
    {
        "prompt": "A serene mountain landscape at sunset",
        "model": "stable-diffusion-3.5-large",
        "size": "1024x1024",
        "n": 1,
        "quality": "standard",
        "provider": "portkey",
        "portkey_provider": "stability-ai",
        "portkey_virtual_key": "your-virtual-key-id"
    }
    ```
    """
    try:
        # Get running event loop for async operations
        loop = asyncio.get_running_loop()

        # Create thread pool executor for sync database operations
        executor = ThreadPoolExecutor()

        try:
            # Get user asynchronously
            user = await loop.run_in_executor(executor, get_user, api_key)

            if not user:
                raise HTTPException(status_code=401, detail="Invalid API key")

            # Image generation is more expensive - estimate ~100 tokens per image
            estimated_tokens = 100 * req.n

            # Check if user has enough credits
            if user['credits'] < estimated_tokens:
                raise HTTPException(
                    status_code=402,
                    detail=f"Insufficient credits. Image generation requires ~{estimated_tokens} credits. Available: {user['credits']}"
                )

            # Prepare request parameters
            prompt = req.prompt
            model = req.model if req.model else "stable-diffusion-3.5-large"
            provider = req.provider if req.provider else "deepinfra"  # Default to DeepInfra for images

            # Make image generation request
            logger.info(f"Generating {req.n} image(s) with prompt: {prompt[:50]}...")

            if provider == "deepinfra":
                # Direct DeepInfra request
                make_request_func = partial(
                    make_deepinfra_image_request,
                    prompt=prompt,
                    model=model,
                    size=req.size,
                    n=req.n
                )
                actual_provider = "deepinfra"
            elif provider == "portkey":
                # Portkey request
                portkey_provider = req.portkey_provider if req.portkey_provider else "stability-ai"
                portkey_virtual_key = req.portkey_virtual_key if hasattr(req, 'portkey_virtual_key') else None

                make_request_func = partial(
                    make_portkey_image_request,
                    prompt=prompt,
                    model=model,
                    provider=portkey_provider,
                    virtual_key=portkey_virtual_key,
                    size=req.size,
                    n=req.n,
                    quality=req.quality,
                    style=req.style
                )
                actual_provider = portkey_provider
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Provider '{provider}' is not supported for image generation. Use 'deepinfra' or 'portkey'"
                )

            response = await loop.run_in_executor(executor, make_request_func)
            processed_response = await loop.run_in_executor(
                executor,
                process_image_generation_response,
                response,
                actual_provider,
                model
            )

            # Deduct credits (100 tokens per image generated)
            tokens_charged = 100 * req.n

            try:
                await loop.run_in_executor(executor, deduct_credits, api_key, tokens_charged)
                cost = tokens_charged * 0.02 / 1000
                await loop.run_in_executor(executor, record_usage, user['id'], api_key, model, tokens_charged, cost)

                # Increment API key usage count
                await loop.run_in_executor(executor, increment_api_key_usage, api_key)

            except ValueError as e:
                logger.error(f"Failed to deduct credits: {e}")
            except Exception as e:
                logger.error(f"Error in usage recording process: {e}")

            # Add gateway usage info
            processed_response['gateway_usage'] = {
                'tokens_charged': tokens_charged,
                'user_balance_after': user['credits'] - tokens_charged,
                'user_api_key': f"{api_key[:10]}...",
                'images_generated': req.n
            }

            return processed_response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in image generation: {e}")
            raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

        finally:
            # Clean up executor
            executor.shutdown(wait=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in image generation endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
