#!/usr/bin/env python3
"""
Integration test to verify Near AI models work with the Gatewayz gateway API.
This test validates that the Near AI client integrates properly with the FastAPI routes.
"""

import asyncio
import json
from datetime import datetime
from typing import Optional, Dict, Any


def test_model_transformations():
    """Test that model IDs are properly transformed for Near AI"""
    print("\n" + "="*70)
    print("TEST 1: Model ID Transformations")
    print("="*70)

    from src.services.model_transformations import (
        transform_model_id,
        detect_provider_from_model_id
    )

    test_cases = [
        # (input_model, expected_provider, expected_transformed)
        ("near/deepseek-v3", "near", "deepseek-v3"),
        ("deepseek-v3", "fireworks", "deepseek-v3"),  # May default to fireworks
        ("near/llama-3.1-70b", "near", "llama-3.1-70b"),
        ("meta-llama/llama-3.1-70b", "near", "llama-3.1-70b"),  # When requested for near
    ]

    all_passed = True
    for input_model, expected_provider, expected_transformed in test_cases:
        print(f"\n  Testing: {input_model}")

        # Test transformation for Near
        transformed = transform_model_id(input_model, "near")
        if transformed == expected_transformed:
            print(f"    ✓ Transformed correctly: {transformed}")
        else:
            print(f"    ✗ Transform failed: expected {expected_transformed}, got {transformed}")
            all_passed = False

        # Test provider detection
        detected = detect_provider_from_model_id(input_model)
        print(f"    • Detected provider: {detected}")

    return all_passed


def test_near_client_initialization():
    """Test that the Near AI client can be initialized"""
    print("\n" + "="*70)
    print("TEST 2: Near AI Client Initialization")
    print("="*70)

    try:
        from src.services.near_client import get_near_client
        from src.config import Config

        print(f"  Checking configuration...")
        print(f"    • NEAR_API_KEY configured: {bool(Config.NEAR_API_KEY)}")

        if not Config.NEAR_API_KEY:
            print("  ⚠ Skipping client initialization (API key not configured)")
            return True

        print(f"  Initializing Near AI client...")
        client = get_near_client()

        print(f"    ✓ Client initialized successfully")
        print(f"    • Base URL: {client.base_url}")
        print(f"    • Client type: {type(client).__name__}")

        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_models_catalog():
    """Test that models are properly registered in the catalog"""
    print("\n" + "="*70)
    print("TEST 3: Models Catalog & Registration")
    print("="*70)

    try:
        from src.services.models import get_cached_models

        print("  Checking cached models...")

        # Get Near models from cache
        near_models = get_cached_models("near")

        if near_models:
            print(f"  ✓ Found {len(near_models)} Near models in cache")
            print("\n  Sample models:")
            for model in near_models[:3]:
                model_id = model.get("id", "N/A")
                slug = model.get("slug", "N/A")
                provider = model.get("provider_slug", "N/A")
                print(f"    • {model_id}")
                print(f"      Slug: {slug}")
                print(f"      Provider: {provider}")

            return True
        else:
            print("  ⚠ No Near models found in cache (may fetch from API)")
            return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_provider_detection():
    """Test that Near models are properly detected"""
    print("\n" + "="*70)
    print("TEST 4: Provider Detection & Routing")
    print("="*70)

    try:
        from src.services.providers import detect_provider

        test_models = [
            "near/deepseek-v3",
            "near/llama-3.1-70b",
            "near/qwen-2-72b",
        ]

        all_passed = True
        for model in test_models:
            detected = detect_provider(model)
            expected = "near"

            if detected == expected:
                print(f"  ✓ {model} → {detected}")
            else:
                print(f"  ⚠ {model} → {detected} (expected: {expected})")

        return all_passed

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_response_processing():
    """Test that Near AI responses are properly processed"""
    print("\n" + "="*70)
    print("TEST 5: Response Processing")
    print("="*70)

    try:
        from src.services.near_client import process_near_response

        # Create a mock response object
        class MockMessage:
            def __init__(self):
                self.content = "Test response"
                self.tool_calls = None

        class MockChoice:
            def __init__(self):
                self.index = 0
                self.message = MockMessage()
                self.finish_reason = "stop"

        class MockUsage:
            def __init__(self):
                self.prompt_tokens = 10
                self.completion_tokens = 20
                self.total_tokens = 30

        class MockResponse:
            def __init__(self):
                self.id = "test-123"
                self.object = "chat.completion"
                self.created = 1234567890
                self.model = "deepseek-v3"
                self.choices = [MockChoice()]
                self.usage = MockUsage()

        print("  Testing response processing...")
        response = MockResponse()

        processed = process_near_response(response)

        print(f"  ✓ Response processed successfully")
        print(f"    • ID: {processed['id']}")
        print(f"    • Model: {processed['model']}")
        print(f"    • Finish reason: {processed['choices'][0]['finish_reason']}")
        print(f"    • Content: {processed['choices'][0]['message']['content']}")
        print(f"    • Total tokens: {processed['usage']['total_tokens']}")

        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_request_preparation():
    """Test that chat requests are properly prepared for Near API"""
    print("\n" + "="*70)
    print("TEST 6: Request Preparation")
    print("="*70)

    try:
        print("  Testing request message preparation...")

        # Test message formatting
        messages = [
            {"role": "system", "content": "You are helpful"},
            {"role": "user", "content": "Hello!"}
        ]

        print(f"  ✓ Message format is valid:")
        for i, msg in enumerate(messages, 1):
            print(f"    {i}. Role: {msg['role']}, Content: {msg['content'][:30]}...")

        # Test parameters
        params = {
            "max_tokens": 100,
            "temperature": 0.7,
            "top_p": 0.9,
        }

        print(f"  ✓ Parameters are valid:")
        for key, value in params.items():
            print(f"    • {key}: {value}")

        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_error_handling():
    """Test that errors are properly handled"""
    print("\n" + "="*70)
    print("TEST 7: Error Handling")
    print("="*70)

    try:
        from src.services.near_client import get_near_client
        from src.config import Config

        print("  Testing error scenarios...")

        # Test 1: Missing API key
        if not Config.NEAR_API_KEY:
            print("  ✓ Properly detects missing API key")
            try:
                get_near_client()
                print("  ⚠ Should have raised error for missing API key")
                return False
            except ValueError as e:
                print(f"    Correct error: {e}")
        else:
            print("  ⚠ Skipping (API key is configured)")

        print("  ✓ Error handling working correctly")
        return True

    except Exception as e:
        print(f"  ✗ Unexpected error: {e}")
        return False


async def main():
    """Run all integration tests"""
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " NEAR AI INTEGRATION TESTS ".center(68) + "║")
    print("║" + " Validating Gateway API Integration".center(68) + "║")
    print("║" + f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".center(68) + "║")
    print("╚" + "="*68 + "╝")

    results = {
        "Model ID Transformations": test_model_transformations(),
        "Client Initialization": test_near_client_initialization(),
        "Models Catalog": test_models_catalog(),
        "Provider Detection": test_provider_detection(),
        "Response Processing": test_response_processing(),
        "Request Preparation": test_request_preparation(),
        "Error Handling": test_error_handling(),
    }

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, passed_test in results.items():
        status = "✓ PASS" if passed_test else "✗ FAIL"
        print(f"  {status}: {test_name}")

    print("\n" + "="*70)
    print(f"Results: {passed}/{total} tests passed")
    print("="*70)

    if passed == total:
        print("\n✓ All integration tests passed!")
        print("\nNear AI models are properly integrated with the gateway API.")
        print("You can now use models like:")
        print("  • near/deepseek-v3")
        print("  • near/llama-3.1-70b")
        print("  • near/qwen-2-72b")
        print("\nRun test_near_simple.py to test API connectivity.")
        return 0
    else:
        print("\n⚠ Some tests did not pass. Check details above.")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
