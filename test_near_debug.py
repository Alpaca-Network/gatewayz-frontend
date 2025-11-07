#!/usr/bin/env python3
"""
Diagnostic script for debugging the Near AI provider integration
"""

import sys
import logging
import os
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_config():
    """Test 1: Verify Near API configuration"""
    logger.info("=" * 60)
    logger.info("TEST 1: Configuration Check")
    logger.info("=" * 60)

    try:
        from src.config import Config

        near_api_key = Config.NEAR_API_KEY
        if near_api_key:
            logger.info(f"✓ NEAR_API_KEY is configured: {near_api_key[:20]}...")
        else:
            logger.error("✗ NEAR_API_KEY is NOT configured")
            return False
        return True
    except Exception as e:
        logger.error(f"✗ Error loading config: {e}")
        return False

def test_model_transformations():
    """Test 2: Verify model transformations for Near"""
    logger.info("\n" + "=" * 60)
    logger.info("TEST 2: Model Transformations")
    logger.info("=" * 60)

    try:
        from src.services.model_transformations import (
            transform_model_id,
            get_model_id_mapping,
            detect_provider_from_model_id
        )

        # Check if Near has mappings
        near_mapping = get_model_id_mapping("near")
        logger.info(f"✓ Near mapping found with {len(near_mapping)} entries:")
        for k, v in near_mapping.items():
            logger.info(f"  {k} -> {v}")

        # Test transformation
        test_cases = [
            ("deepseek-ai/deepseek-v3", "near"),
            ("deepseek-v3", "near"),
            ("near/deepseek-v3", "near"),
            ("meta-llama/llama-3.1-70b", "near"),
            ("llama-3.1-70b", "near"),
        ]

        logger.info("\nTesting transformations:")
        for model_id, provider in test_cases:
            transformed = transform_model_id(model_id, provider)
            logger.info(f"  {model_id} -> {transformed}")

        # Test provider detection
        logger.info("\nTesting provider detection:")
        detection_tests = [
            "near/deepseek-v3",
            "deepseek-ai/deepseek-v3",
            "deepseek-v3",
        ]

        for model_id in detection_tests:
            detected = detect_provider_from_model_id(model_id)
            logger.info(f"  {model_id} -> detected as {detected}")

        return True
    except Exception as e:
        logger.error(f"✗ Error in transformations: {e}", exc_info=True)
        return False

def test_near_client():
    """Test 3: Test Near client initialization"""
    logger.info("\n" + "=" * 60)
    logger.info("TEST 3: Near Client Initialization")
    logger.info("=" * 60)

    try:
        from src.services.near_client import get_near_client

        client = get_near_client()
        logger.info(f"✓ Near client initialized successfully")
        logger.info(f"  Base URL: {client.base_url}")
        logger.info(f"  Client type: {type(client).__name__}")
        return True
    except Exception as e:
        logger.error(f"✗ Error initializing Near client: {e}", exc_info=True)
        return False

def test_near_models():
    """Test 4: Test Near models fetching"""
    logger.info("\n" + "=" * 60)
    logger.info("TEST 4: Near Models Fetching")
    logger.info("=" * 60)

    try:
        from src.services.models import fetch_models_from_near, get_cached_models

        # Try to fetch models
        logger.info("Fetching models from Near...")
        models = fetch_models_from_near()

        if models:
            logger.info(f"✓ Fetched {len(models)} models from Near")
            for model in models[:3]:
                logger.info(f"  - {model.get('id', 'N/A')} ({model.get('provider_slug', 'N/A')})")
            if len(models) > 3:
                logger.info(f"  ... and {len(models) - 3} more")
        else:
            logger.warning("⚠ No models returned (may be using fallback)")

            # Check cache
            cached = get_cached_models("near")
            if cached:
                logger.info(f"✓ Found {len(cached)} models in cache")

        return True
    except Exception as e:
        logger.error(f"✗ Error fetching Near models: {e}", exc_info=True)
        return False

def test_provider_routing():
    """Test 5: Test provider routing logic"""
    logger.info("\n" + "=" * 60)
    logger.info("TEST 5: Provider Routing")
    logger.info("=" * 60)

    try:
        from src.services.providers import get_provider_for_model

        test_models = [
            "near/deepseek-v3",
            "deepseek-ai/deepseek-v3",
            "deepseek-v3",
        ]

        logger.info("Testing provider routing:")
        for model_id in test_models:
            try:
                provider = get_provider_for_model(model_id)
                logger.info(f"  {model_id} -> {provider}")
            except Exception as e:
                logger.warning(f"  {model_id} -> Error: {e}")

        return True
    except Exception as e:
        logger.error(f"✗ Error in provider routing: {e}", exc_info=True)
        return False

def test_http_connectivity():
    """Test 6: Test HTTP connectivity to Near API"""
    logger.info("\n" + "=" * 60)
    logger.info("TEST 6: HTTP Connectivity to Near API")
    logger.info("=" * 60)

    try:
        import httpx
        from src.config import Config

        if not Config.NEAR_API_KEY:
            logger.warning("⚠ NEAR_API_KEY not configured, skipping connectivity test")
            return True

        headers = {
            "Authorization": f"Bearer {Config.NEAR_API_KEY}",
            "Content-Type": "application/json",
        }

        logger.info("Testing connectivity to https://cloud-api.near.ai/v1/models")

        try:
            response = httpx.get(
                "https://cloud-api.near.ai/v1/models",
                headers=headers,
                timeout=10.0,
            )

            logger.info(f"✓ HTTP Status: {response.status_code}")

            if response.status_code == 200:
                payload = response.json()
                models = payload.get("data", [])
                logger.info(f"✓ API returned {len(models)} models")
                if models:
                    for model in models[:2]:
                        logger.info(f"  - {model.get('id', 'N/A')}")
            else:
                logger.warning(f"⚠ Unexpected status code: {response.status_code}")
                logger.warning(f"  Response: {response.text[:200]}")

        except httpx.ConnectError as e:
            logger.error(f"✗ Connection error: {e}")
            return False
        except httpx.TimeoutException as e:
            logger.error(f"✗ Timeout error: {e}")
            return False

        return True
    except Exception as e:
        logger.error(f"✗ Error testing connectivity: {e}", exc_info=True)
        return False

def test_openai_compatibility():
    """Test 7: Test OpenAI compatibility of Near API"""
    logger.info("\n" + "=" * 60)
    logger.info("TEST 7: OpenAI Compatibility Test")
    logger.info("=" * 60)

    try:
        from src.services.near_client import get_near_client
        from src.config import Config

        if not Config.NEAR_API_KEY:
            logger.warning("⚠ NEAR_API_KEY not configured, skipping API test")
            return True

        client = get_near_client()

        # Test listing models
        logger.info("Testing client.models.list()...")
        try:
            models = client.models.list()
            logger.info(f"✓ Listed {len(models.data)} models via OpenAI client")
            if models.data:
                logger.info(f"  - {models.data[0].id}")
        except Exception as e:
            logger.warning(f"⚠ Error listing models: {e}")

        # Note: We won't actually make a chat request without proper setup
        logger.info("✓ OpenAI client initialized and accessible")

        return True
    except Exception as e:
        logger.error(f"✗ Error testing OpenAI compatibility: {e}", exc_info=True)
        return False

def main():
    """Run all diagnostic tests"""
    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + " NEAR AI PROVIDER DIAGNOSTIC TEST ".center(58) + "║")
    logger.info("║" + " " * 58 + "║")
    logger.info("║" + f" Started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".ljust(58) + "║")
    logger.info("╚" + "=" * 58 + "╝")

    results = {
        "Configuration": test_config(),
        "Model Transformations": test_model_transformations(),
        "Near Client": test_near_client(),
        "Near Models": test_near_models(),
        "Provider Routing": test_provider_routing(),
        "HTTP Connectivity": test_http_connectivity(),
        "OpenAI Compatibility": test_openai_compatibility(),
    }

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("SUMMARY")
    logger.info("=" * 60)

    all_passed = True
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        logger.info(f"{test_name}: {status}")
        if not passed:
            all_passed = False

    logger.info("=" * 60)

    if all_passed:
        logger.info("\n✓ All tests passed!")
        return 0
    else:
        logger.error("\n✗ Some tests failed. See details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
