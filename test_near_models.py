#!/usr/bin/env python3
"""
Test script to validate that Near AI models are working correctly.
This script tests the Near AI integration with sample prompts.
"""

import asyncio
import logging
import json
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_near_models():
    """Test Near AI models with sample prompts"""
    from src.config import Config
    from src.services.models import fetch_models_from_near
    from src.services.near_client import make_near_request_openai, process_near_response

    logger.info("\n" + "="*70)
    logger.info("NEAR AI MODELS VALIDATION TEST")
    logger.info("="*70)

    # Check configuration
    if not Config.NEAR_API_KEY:
        logger.error("✗ NEAR_API_KEY is not configured")
        logger.error("  Please set NEAR_API_KEY in your .env file")
        logger.error("  Get your API key from: https://docs.near.ai/cloud/get-started/")
        return False

    logger.info("✓ NEAR_API_KEY is configured")

    # Fetch available models
    logger.info("\nFetching available Near models...")
    try:
        models = fetch_models_from_near()
        logger.info(f"✓ Fetched {len(models)} models from Near AI")

        if models:
            logger.info("\nAvailable models:")
            for i, model in enumerate(models[:5], 1):
                logger.info(f"  {i}. {model.get('id')} (context: {model.get('context_length', 'N/A')})")
            if len(models) > 5:
                logger.info(f"  ... and {len(models) - 5} more models")
        else:
            logger.warning("⚠ No models returned from Near AI")
            return False

    except Exception as e:
        logger.error(f"✗ Failed to fetch models: {e}")
        return False

    # Test with sample prompts
    logger.info("\n" + "="*70)
    logger.info("TESTING WITH SAMPLE PROMPTS")
    logger.info("="*70)

    test_prompts = [
        {
            "name": "Simple greeting",
            "model": "deepseek-v3",
            "messages": [{"role": "user", "content": "Hello! Say hello back briefly."}],
            "params": {"max_tokens": 100, "temperature": 0.7}
        },
        {
            "name": "Math question",
            "model": "deepseek-v3",
            "messages": [{"role": "user", "content": "What is 2+2?"}],
            "params": {"max_tokens": 50, "temperature": 0.0}
        },
        {
            "name": "Creative prompt",
            "model": "deepseek-v3",
            "messages": [{"role": "user", "content": "Write a one-line haiku about AI."}],
            "params": {"max_tokens": 100, "temperature": 0.8}
        }
    ]

    results = []
    for i, test in enumerate(test_prompts, 1):
        logger.info(f"\nTest {i}: {test['name']}")
        logger.info(f"  Model: {test['model']}")
        logger.info(f"  Prompt: {test['messages'][0]['content']}")

        try:
            # Make request to Near API
            response = await asyncio.to_thread(
                make_near_request_openai,
                test['messages'],
                test['model'],
                **test['params']
            )

            # Process response
            processed = await asyncio.to_thread(process_near_response, response)

            # Extract content
            if processed.get('choices'):
                choice = processed['choices'][0]
                message = choice.get('message', {})
                content = message.get('content', 'No content')
                finish_reason = choice.get('finish_reason')

                logger.info(f"  ✓ Response: {content[:100]}...")
                logger.info(f"  Finish reason: {finish_reason}")

                # Log usage stats if available
                if processed.get('usage'):
                    usage = processed['usage']
                    logger.info(
                        f"  Usage: {usage.get('prompt_tokens')} prompt, "
                        f"{usage.get('completion_tokens')} completion, "
                        f"{usage.get('total_tokens')} total tokens"
                    )

                results.append({
                    "test": test['name'],
                    "status": "success",
                    "response": content[:200]
                })
            else:
                logger.warning("  ⚠ No choices in response")
                results.append({
                    "test": test['name'],
                    "status": "warning",
                    "error": "No choices in response"
                })

        except Exception as e:
            logger.error(f"  ✗ Error: {e}")
            results.append({
                "test": test['name'],
                "status": "error",
                "error": str(e)
            })

    # Summary
    logger.info("\n" + "="*70)
    logger.info("TEST SUMMARY")
    logger.info("="*70)

    successful = sum(1 for r in results if r['status'] == 'success')
    errors = sum(1 for r in results if r['status'] == 'error')

    for result in results:
        status_icon = "✓" if result['status'] == 'success' else "✗"
        logger.info(f"{status_icon} {result['test']}: {result['status']}")
        if 'error' in result:
            logger.info(f"    Error: {result['error']}")

    logger.info("\n" + "="*70)
    logger.info(f"Results: {successful} successful, {errors} errors")
    logger.info("="*70)

    return errors == 0


async def test_near_api_key_validation():
    """Validate Near API key format and access"""
    from src.config import Config
    import httpx

    logger.info("\n" + "="*70)
    logger.info("NEAR API KEY VALIDATION")
    logger.info("="*70)

    if not Config.NEAR_API_KEY:
        logger.error("✗ NEAR_API_KEY is not set")
        logger.info("  Steps to get API key:")
        logger.info("  1. Visit: https://docs.near.ai/cloud/get-started/")
        logger.info("  2. Sign up or log in to Near Protocol")
        logger.info("  3. Create an API key in your dashboard")
        logger.info("  4. Add to .env: NEAR_API_KEY=your_key_here")
        return False

    logger.info(f"✓ NEAR_API_KEY is set: {Config.NEAR_API_KEY[:20]}...")

    # Test connectivity
    logger.info("\nTesting API connectivity...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://cloud-api.near.ai/v1/models",
                headers={"Authorization": f"Bearer {Config.NEAR_API_KEY}"},
                timeout=10.0
            )

            logger.info(f"✓ API connection successful (HTTP {response.status_code})")

            if response.status_code == 200:
                data = response.json()
                models = data.get('data', [])
                logger.info(f"✓ Retrieved {len(models)} available models")
                return True
            elif response.status_code == 401:
                logger.error("✗ Unauthorized - API key is invalid")
                return False
            else:
                logger.warning(f"⚠ Unexpected status code: {response.status_code}")
                return False

    except httpx.ConnectError as e:
        logger.error(f"✗ Connection failed: {e}")
        return False
    except Exception as e:
        logger.error(f"✗ Error: {e}")
        return False


async def main():
    """Run all tests"""
    logger.info("\n")
    logger.info("╔" + "="*68 + "╗")
    logger.info("║" + " NEAR AI MODELS VALIDATION ".center(68) + "║")
    logger.info("║" + f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".center(68) + "║")
    logger.info("╚" + "="*68 + "╝")

    # Test 1: API key validation
    key_valid = await test_near_api_key_validation()

    if not key_valid:
        logger.error("\nCannot proceed without valid API key")
        return 1

    # Test 2: Near models
    models_ok = await test_near_models()

    logger.info("\n" + "="*70)
    logger.info("OVERALL RESULT")
    logger.info("="*70)

    if key_valid and models_ok:
        logger.info("✓ All tests passed! Near AI models are working correctly.")
        logger.info("\nYou can now use Near models in chat requests:")
        logger.info("  curl -X POST http://localhost:8000/v1/chat/completions \\")
        logger.info("    -H 'Content-Type: application/json' \\")
        logger.info("    -H 'Authorization: Bearer YOUR_API_KEY' \\")
        logger.info("    -d '{")
        logger.info("      \"model\": \"near/deepseek-v3\",")
        logger.info("      \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]")
        logger.info("    }'")
        return 0
    else:
        logger.error("✗ Some tests failed. See details above.")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
