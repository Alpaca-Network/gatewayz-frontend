#!/usr/bin/env python3
"""
Test script for Hugging Face Models API integration.

This script tests the new direct Hugging Face API integration to ensure
models are properly fetched, normalized, and cached.
"""

import sys
import asyncio
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.services.huggingface_models import (
    fetch_models_from_huggingface_api,
    fetch_models_from_hug,
    search_huggingface_models,
    get_huggingface_model_info,
    normalize_huggingface_model
)


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'-'*60}")
    print(f"  {title}")
    print(f"{'-'*60}\n")


def test_fetch_models():
    """Test fetching models from Hugging Face API"""
    print_section("TEST 1: Fetch Models from Hugging Face API")

    print("Fetching up to 10 models for testing...")
    models = fetch_models_from_huggingface_api(limit=10, use_cache=False)

    if not models:
        print("ERROR: No models returned")
        return False

    print(f"[OK] Successfully fetched {len(models)} models\n")

    # Display first 3 models
    for i, model in enumerate(models[:3], 1):
        print(f"Model {i}:")
        print(f"  ID: {model.get('id')}")
        print(f"  Name: {model.get('name')}")
        print(f"  Provider: {model.get('provider_slug')}")
        print(f"  HF URL: {model.get('provider_site_url')}")
        hf_metrics = model.get("huggingface_metrics", {})
        print(f"  Downloads: {hf_metrics.get('downloads')}")
        print(f"  Likes: {hf_metrics.get('likes')}")
        print()

    return True


def test_cache():
    """Test caching mechanism"""
    print_section("TEST 2: Cache Mechanism")

    print("Fetching models (no cache)...")
    import time
    start = time.time()
    models1 = fetch_models_from_huggingface_api(limit=5, use_cache=False)
    time1 = time.time() - start
    print(f"[OK] Fetched {len(models1) if models1 else 0} models in {time1:.2f}s\n")

    print("Fetching models again (should use cache)...")
    start = time.time()
    models2 = fetch_models_from_huggingface_api(limit=5, use_cache=True)
    time2 = time.time() - start
    print(f"[OK] Fetched {len(models2) if models2 else 0} models in {time2:.2f}s")
    print(f"  Cache speedup: {time1/time2:.1f}x faster\n")

    return True


def test_fetch_hug_wrapper():
    """Test the fetch_models_from_hug wrapper function"""
    print_section("TEST 3: fetch_models_from_hug() Wrapper")

    print("Calling fetch_models_from_hug()...")
    models = fetch_models_from_hug()

    if not models:
        print("ERROR: No models returned from fetch_models_from_hug()")
        return False

    print(f"[OK] Successfully fetched {len(models)} models\n")

    # Display statistics
    if models:
        hf_metrics = [m.get("huggingface_metrics", {}) for m in models]
        total_downloads = sum(m.get('downloads', 0) for m in hf_metrics)
        avg_downloads = total_downloads // len(models) if models else 0

        print("Statistics:")
        print(f"  Total models: {len(models)}")
        print(f"  Total downloads (combined): {total_downloads}")
        print(f"  Avg downloads per model: {avg_downloads}")
        print()

    return True


def test_search():
    """Test search functionality"""
    print_section("TEST 4: Search Models")

    search_terms = ["llama", "mistral", "gpt2"]

    for term in search_terms:
        print(f"Searching for '{term}'...")
        results = search_huggingface_models(term, limit=3)
        print(f"[OK] Found {len(results)} models\n")

        if results:
            for i, model in enumerate(results[:2], 1):
                print(f"  {i}. {model.get('id')} ({model.get('huggingface_metrics', {}).get('downloads')} downloads)")
            print()

    return True


def test_model_info():
    """Test fetching specific model info"""
    print_section("TEST 5: Fetch Specific Model Info")

    test_models = [
        "meta-llama/Llama-2-7b",
        "mistralai/Mistral-7B-v0.1",
        "gpt2",
    ]

    for model_id in test_models:
        print(f"Fetching info for '{model_id}'...")
        info = get_huggingface_model_info(model_id)

        if info:
            print(f"[OK] Found model:")
            print(f"  Name: {info.get('name')}")
            print(f"  Provider: {info.get('provider_slug')}")
            hf_metrics = info.get("huggingface_metrics", {})
            print(f"  Downloads: {hf_metrics.get('downloads')}")
            print()
        else:
            print(f"[NOT FOUND] Model not found\n")

    return True


def run_all_tests():
    """Run all tests"""
    print("\n")
    print("="*60)
    print("  Hugging Face Models API Integration Test Suite")
    print("="*60)

    tests = [
        ("Fetch Models", test_fetch_models),
        ("Cache Mechanism", test_cache),
        ("Fetch HUG Wrapper", test_fetch_hug_wrapper),
        ("Search Models", test_search),
        ("Model Info", test_model_info),
    ]

    results = []

    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n✗ TEST FAILED with exception: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))

    # Summary
    print_section("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"[{status}] {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\nAll tests passed!")
        return 0
    else:
        print(f"\n{total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
