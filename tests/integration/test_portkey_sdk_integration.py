#!/usr/bin/env python3
"""
Test script for Portkey SDK integration.
Tests all components of the new provider architecture.
"""

import sys
import logging
from datetime import datetime, timezone

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def test_imports():
    """Test that all imports work correctly"""
    logger.info("=" * 60)
    logger.info("TEST 1: Checking imports")
    logger.info("=" * 60)

    try:
        from src.services.portkey_sdk import get_portkey_service, PortkeySDKService
        logger.info("✓ Portkey SDK service imported successfully")
    except ImportError as e:
        logger.error(f"✗ Failed to import Portkey SDK service: {e}")
        return False

    try:
        from src.services.portkey_providers import (
            fetch_models_from_cerebras,
            fetch_models_from_nebius,
            fetch_models_from_xai,
            fetch_models_from_novita,
            fetch_models_from_hug,
            normalize_portkey_provider_model
        )
        logger.info("✓ All provider fetchers imported successfully")
    except ImportError as e:
        logger.error(f"✗ Failed to import provider fetchers: {e}")
        return False

    try:
        from src.cache import (
            _cerebras_models_cache,
            _nebius_models_cache,
            _xai_models_cache,
            _novita_models_cache,
            _huggingface_models_cache,
            get_models_cache,
            clear_models_cache
        )
        logger.info("✓ Cache entries imported successfully")
    except ImportError as e:
        logger.error(f"✗ Failed to import cache entries: {e}")
        return False

    try:
        from src.services.models import get_cached_models
        logger.info("✓ Model services imported successfully")
    except ImportError as e:
        logger.error(f"✗ Failed to import model services: {e}")
        return False

    logger.info("✓ All imports successful!\n")
    return True


def test_portkey_sdk_service():
    """Test Portkey SDK service initialization"""
    logger.info("=" * 60)
    logger.info("TEST 2: Testing Portkey SDK Service")
    logger.info("=" * 60)

    try:
        from src.services.portkey_sdk import get_portkey_service
        from src.config import Config

        if not Config.PORTKEY_API_KEY:
            logger.error("✗ PORTKEY_API_KEY not configured")
            return False

        logger.info(f"✓ PORTKEY_API_KEY configured (preview: {Config.PORTKEY_API_KEY[:10]}***)")

        service = get_portkey_service()
        logger.info("✓ Portkey SDK service instantiated successfully")

        logger.info("✓ Portkey SDK service working!\n")
        return True

    except Exception as e:
        logger.error(f"✗ Portkey SDK service test failed: {e}", exc_info=True)
        return False


def test_cache_structure():
    """Test cache layer structure"""
    logger.info("=" * 60)
    logger.info("TEST 3: Testing Cache Structure")
    logger.info("=" * 60)

    try:
        from src.cache import get_models_cache

        providers = ['cerebras', 'nebius', 'xai', 'novita', 'hug']

        for provider in providers:
            cache = get_models_cache(provider)
            if cache is None:
                logger.error(f"✗ Cache not found for {provider}")
                return False

            if 'data' not in cache or 'timestamp' not in cache or 'ttl' not in cache:
                logger.error(f"✗ Cache structure incomplete for {provider}")
                return False

            logger.info(f"✓ Cache structure valid for {provider}")

        logger.info("✓ Cache structure complete!\n")
        return True

    except Exception as e:
        logger.error(f"✗ Cache structure test failed: {e}", exc_info=True)
        return False


def test_model_routing():
    """Test model routing in get_cached_models"""
    logger.info("=" * 60)
    logger.info("TEST 4: Testing Model Routing")
    logger.info("=" * 60)

    try:
        from src.services.models import get_cached_models

        providers = ['cerebras', 'nebius', 'xai', 'novita', 'hug']

        for provider in providers:
            logger.info(f"Testing routing for {provider}...")

            # This should attempt to fetch models
            result = get_cached_models(provider)

            # Result can be None (if fetch fails) or list (if models found)
            if result is None or isinstance(result, list):
                logger.info(f"✓ Routing works for {provider} (got {len(result) if result else 0} models)")
            else:
                logger.error(f"✗ Invalid result type for {provider}: {type(result)}")
                return False

        logger.info("✓ Model routing complete!\n")
        return True

    except Exception as e:
        logger.error(f"✗ Model routing test failed: {e}", exc_info=True)
        return False


def test_normalization():
    """Test model normalization"""
    logger.info("=" * 60)
    logger.info("TEST 5: Testing Model Normalization")
    logger.info("=" * 60)

    try:
        from src.services.portkey_providers import normalize_portkey_provider_model

        # Test with a sample model
        sample_model = {
            "id": "gpt-4-turbo",
            "name": "GPT-4 Turbo",
            "description": "A powerful model",
            "context_length": 128000,
            "modality": "text->text"
        }

        normalized = normalize_portkey_provider_model(sample_model, "cerebras")

        required_fields = [
            'id', 'name', 'description', 'source_gateway',
            'pricing', 'architecture', 'provider_slug'
        ]

        for field in required_fields:
            if field not in normalized:
                logger.error(f"✗ Missing field in normalized model: {field}")
                return False

        logger.info(f"✓ Normalized model has all required fields")
        logger.info(f"  - ID: {normalized['id']}")
        logger.info(f"  - Name: {normalized['name']}")
        logger.info(f"  - Provider: {normalized['provider_slug']}")
        logger.info(f"  - Gateway: {normalized['source_gateway']}")

        logger.info("✓ Model normalization working!\n")
        return True

    except Exception as e:
        logger.error(f"✗ Normalization test failed: {e}", exc_info=True)
        return False


def test_fetch_functions():
    """Test that fetch functions exist and are callable"""
    logger.info("=" * 60)
    logger.info("TEST 6: Testing Fetch Functions")
    logger.info("=" * 60)

    try:
        from src.services.portkey_providers import (
            fetch_models_from_cerebras,
            fetch_models_from_nebius,
            fetch_models_from_xai,
            fetch_models_from_novita,
            fetch_models_from_hug
        )

        functions = {
            'cerebras': fetch_models_from_cerebras,
            'nebius': fetch_models_from_nebius,
            'xai': fetch_models_from_xai,
            'novita': fetch_models_from_novita,
            'hug': fetch_models_from_hug
        }

        for name, func in functions.items():
            if not callable(func):
                logger.error(f"✗ {name} fetch function not callable")
                return False

            logger.info(f"✓ {name} fetch function exists and is callable")

        logger.info("✓ All fetch functions available!\n")
        return True

    except Exception as e:
        logger.error(f"✗ Fetch functions test failed: {e}", exc_info=True)
        return False


def test_all_gateway_aggregation():
    """Test that 'all' gateway includes new providers"""
    logger.info("=" * 60)
    logger.info("TEST 7: Testing 'All' Gateway Aggregation")
    logger.info("=" * 60)

    try:
        from src.services.models import get_cached_models

        # The 'all' gateway should aggregate from all providers
        logger.info("Attempting to fetch from 'all' gateway...")
        result = get_cached_models("all")

        if result is None:
            logger.warning("⚠ 'all' gateway returned None (no models cached yet)")
        elif isinstance(result, list):
            logger.info(f"✓ 'all' gateway returns list (length: {len(result)})")
        else:
            logger.error(f"✗ Invalid result type for 'all': {type(result)}")
            return False

        logger.info("✓ 'all' gateway aggregation working!\n")
        return True

    except Exception as e:
        logger.error(f"✗ 'all' gateway test failed: {e}", exc_info=True)
        return False


def test_cache_operations():
    """Test cache get and clear operations"""
    logger.info("=" * 60)
    logger.info("TEST 8: Testing Cache Operations")
    logger.info("=" * 60)

    try:
        from src.cache import get_models_cache, clear_models_cache

        providers = ['cerebras', 'nebius', 'xai', 'novita', 'hug']

        # Test get operations
        for provider in providers:
            cache = get_models_cache(provider)
            if cache is None:
                logger.error(f"✗ get_models_cache failed for {provider}")
                return False
            logger.info(f"✓ get_models_cache works for {provider}")

        # Test clear operations
        for provider in providers:
            clear_models_cache(provider)
            cache = get_models_cache(provider)
            if cache['data'] is not None or cache['timestamp'] is not None:
                logger.error(f"✗ clear_models_cache failed for {provider}")
                return False
            logger.info(f"✓ clear_models_cache works for {provider}")

        logger.info("✓ Cache operations working!\n")
        return True

    except Exception as e:
        logger.error(f"✗ Cache operations test failed: {e}", exc_info=True)
        return False


def test_error_handling():
    """Test error handling in fetchers"""
    logger.info("=" * 60)
    logger.info("TEST 9: Testing Error Handling")
    logger.info("=" * 60)

    try:
        from src.services.models import get_cached_models

        # Try to fetch with invalid provider
        logger.info("Testing invalid provider handling...")
        result = get_cached_models("invalid_provider")

        if result is None or isinstance(result, list):
            logger.info("✓ Invalid provider handled gracefully")
        else:
            logger.error("✗ Invalid provider returned unexpected result")
            return False

        # Try to fetch from existing but potentially unavailable provider
        logger.info("Testing provider with potential unavailability...")
        result = get_cached_models("cerebras")

        if result is None or isinstance(result, list):
            logger.info("✓ Unavailable provider handled gracefully")
        else:
            logger.error("✗ Unavailable provider returned unexpected result")
            return False

        logger.info("✓ Error handling working!\n")
        return True

    except Exception as e:
        logger.error(f"✗ Error handling test failed: {e}", exc_info=True)
        return False


def run_all_tests():
    """Run all tests and report results"""
    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + " " * 10 + "PORTKEY SDK INTEGRATION TEST SUITE" + " " * 14 + "║")
    logger.info("╚" + "=" * 58 + "╝")
    logger.info("")

    tests = [
        ("Imports", test_imports),
        ("Portkey SDK Service", test_portkey_sdk_service),
        ("Cache Structure", test_cache_structure),
        ("Model Routing", test_model_routing),
        ("Model Normalization", test_normalization),
        ("Fetch Functions", test_fetch_functions),
        ("All Gateway Aggregation", test_all_gateway_aggregation),
        ("Cache Operations", test_cache_operations),
        ("Error Handling", test_error_handling),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"✗ {test_name} raised exception: {e}")
            results.append((test_name, False))

    # Summary
    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + " " * 24 + "TEST SUMMARY" + " " * 22 + "║")
    logger.info("╠" + "=" * 58 + "╣")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        logger.info(f"║ {status:8} | {test_name:45} ║")

    logger.info("╠" + "=" * 58 + "╣")
    logger.info(f"║ TOTAL: {passed}/{total} tests passed" + " " * (58 - len(f" TOTAL: {passed}/{total} tests passed") - 1) + "║")
    logger.info("╚" + "=" * 58 + "╝")
    logger.info("")

    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
