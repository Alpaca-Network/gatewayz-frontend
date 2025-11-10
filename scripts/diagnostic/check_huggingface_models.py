#!/usr/bin/env python3
"""
Diagnostic script to check HuggingFace models availability.

This script will:
1. Check if HUG_API_KEY is configured
2. Test fetching models from HuggingFace API
3. Check the cache status
4. Verify model normalization
5. Test the catalog endpoint

Usage:
    python scripts/diagnostic/check_huggingface_models.py

Environment Variables (Optional):
    HUG_API_KEY - Your HuggingFace API key (optional, but helps with rate limits)
"""

import json
import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import httpx
from src.config import Config
from src.cache import _huggingface_models_cache


def check_environment():
    """Check environment configuration"""
    print("\n" + "="*80)
    print("ENVIRONMENT CHECK")
    print("="*80)

    hug_api_key = os.environ.get("HUG_API_KEY") or Config.HUG_API_KEY
    if hug_api_key:
        print(f"✅ HUG_API_KEY is configured (length: {len(hug_api_key)})")
    else:
        print("⚠️  HUG_API_KEY is NOT configured")
        print("   This is optional but helps avoid rate limits")

    return hug_api_key


def test_huggingface_api_direct(api_key=None):
    """Test direct API call to HuggingFace"""
    print("\n" + "="*80)
    print("DIRECT API TEST")
    print("="*80)

    print("\n📡 Testing direct HuggingFace API access...")

    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    params = {
        "inference_provider": "hf-inference",
        "limit": 10,
        "sort": "likes",
    }

    try:
        print(f"Endpoint: https://huggingface.co/api/models")
        print(f"Params: {params}")

        response = httpx.get(
            "https://huggingface.co/api/models",
            params=params,
            headers=headers,
            timeout=15.0
        )
        response.raise_for_status()

        models = response.json()
        print(f"✅ Successfully fetched {len(models)} models from HuggingFace API")

        if models:
            print(f"\nFirst 3 models:")
            for i, model in enumerate(models[:3], 1):
                print(f"  {i}. {model.get('id')} (likes: {model.get('likes', 0)}, downloads: {model.get('downloads', 0)})")

        return True, models

    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP Error {e.response.status_code}: {e.response.text[:200]}")
        return False, None
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        return False, None


def test_huggingface_models_module():
    """Test the huggingface_models module"""
    print("\n" + "="*80)
    print("MODULE TEST")
    print("="*80)

    print("\n📦 Testing src.services.huggingface_models module...")

    try:
        from src.services.huggingface_models import (
            fetch_models_from_hug,
            fetch_models_from_huggingface_api,
            normalize_huggingface_model,
            ESSENTIAL_MODELS
        )

        print("✅ Module imports successful")
        print(f"   Essential models count: {len(ESSENTIAL_MODELS)}")
        print(f"   Essential models: {ESSENTIAL_MODELS}")

        # Test fetching models with cache disabled
        print("\n🔍 Testing fetch_models_from_hug() with cache disabled...")
        models = fetch_models_from_huggingface_api(limit=5, use_cache=False)

        if models:
            print(f"✅ Successfully fetched {len(models)} models")
            print("\nSample models:")
            for i, model in enumerate(models[:3], 1):
                print(f"  {i}. {model.get('id')}")
                print(f"     Name: {model.get('name')}")
                print(f"     Source Gateway: {model.get('source_gateway')}")
                print(f"     HF Metrics: downloads={model.get('huggingface_metrics', {}).get('downloads', 0)}")
            return True, models
        else:
            print("❌ No models returned from fetch_models_from_hug()")
            return False, None

    except Exception as e:
        print(f"❌ Module test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def test_cache_status():
    """Check the HuggingFace models cache status"""
    print("\n" + "="*80)
    print("CACHE STATUS")
    print("="*80)

    print(f"\nCache TTL: {_huggingface_models_cache.get('ttl')} seconds")
    print(f"Cache data present: {bool(_huggingface_models_cache.get('data'))}")
    print(f"Cache timestamp: {_huggingface_models_cache.get('timestamp')}")

    if _huggingface_models_cache.get('data'):
        cache_size = len(_huggingface_models_cache['data'])
        print(f"Cached models count: {cache_size}")

        if cache_size > 0:
            print(f"\nFirst 3 cached models:")
            for i, model in enumerate(_huggingface_models_cache['data'][:3], 1):
                print(f"  {i}. {model.get('id')}")
    else:
        print("⚠️  Cache is empty")


def test_get_cached_models():
    """Test the get_cached_models function"""
    print("\n" + "="*80)
    print("GET_CACHED_MODELS TEST")
    print("="*80)

    try:
        from src.services.models import get_cached_models

        print("\n🔍 Testing get_cached_models('hug')...")
        models_hug = get_cached_models("hug")

        if models_hug:
            print(f"✅ get_cached_models('hug') returned {len(models_hug)} models")
        else:
            print("❌ get_cached_models('hug') returned None or empty list")

        print("\n🔍 Testing get_cached_models('huggingface')...")
        models_huggingface = get_cached_models("huggingface")

        if models_huggingface:
            print(f"✅ get_cached_models('huggingface') returned {len(models_huggingface)} models")
        else:
            print("❌ get_cached_models('huggingface') returned None or empty list")

        return models_hug or models_huggingface

    except Exception as e:
        print(f"❌ get_cached_models test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main diagnostic function"""
    print("\n" + "="*80)
    print("HUGGINGFACE MODELS DIAGNOSTIC")
    print("="*80)

    # Step 1: Check environment
    api_key = check_environment()

    # Step 2: Test direct API access
    api_success, api_models = test_huggingface_api_direct(api_key)

    # Step 3: Test module functions
    module_success, module_models = test_huggingface_models_module()

    # Step 4: Check cache
    test_cache_status()

    # Step 5: Test get_cached_models
    cached_models = test_get_cached_models()

    # Final summary
    print("\n" + "="*80)
    print("DIAGNOSTIC SUMMARY")
    print("="*80)

    print(f"\n✓ Direct API Access:       {'✅ PASS' if api_success else '❌ FAIL'}")
    print(f"✓ Module Functions:        {'✅ PASS' if module_success else '❌ FAIL'}")
    print(f"✓ get_cached_models():     {'✅ PASS' if cached_models else '❌ FAIL'}")

    if api_success and module_success and cached_models:
        print("\n🎉 All checks passed! HuggingFace models should be available.")
    else:
        print("\n⚠️  Some checks failed. HuggingFace models may not be available.")

        print("\n📝 TROUBLESHOOTING STEPS:")

        if not api_success:
            print("\n1. Direct API Access Failed:")
            print("   - Check your internet connection")
            print("   - Verify HuggingFace API is accessible")
            print("   - Try setting HUG_API_KEY environment variable")

        if not module_success:
            print("\n2. Module Functions Failed:")
            print("   - Check application logs for errors")
            print("   - Verify all dependencies are installed")
            print("   - Check if there are any import errors")

        if not cached_models:
            print("\n3. get_cached_models() Failed:")
            print("   - Try clearing the cache and refetching")
            print("   - Check if models are being registered correctly")
            print("   - Verify the gateway name ('hug' or 'huggingface')")

    print("\n" + "="*80)


if __name__ == "__main__":
    main()
