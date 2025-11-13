#!/usr/bin/env python3
"""
Test Cerebras direct integration (without Portkey)
"""

import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_cerebras_direct_import():
    """Test that Cerebras client can be imported"""
    print("=" * 80)
    print("TEST 1: Import Cerebras Client")
    print("=" * 80)

    try:
        from src.services.cerebras_client import (
            get_cerebras_client,
            make_cerebras_request_openai,
            make_cerebras_request_openai_stream,
            process_cerebras_response
        )
        print("✅ Successfully imported Cerebras client functions")
        return True
    except ImportError as e:
        print(f"❌ Failed to import Cerebras client: {e}")
        return False

def test_cerebras_model_normalization():
    """Test that Cerebras models are normalized without @cerebras/ prefix"""
    print("\n" + "=" * 80)
    print("TEST 2: Model Normalization")
    print("=" * 80)

    try:
        from src.services.portkey_providers import fetch_models_from_cerebras

        # Check if API key is set
        api_key = os.getenv("CEREBRAS_API_KEY")
        if not api_key:
            print("⚠️  CEREBRAS_API_KEY not set, skipping model fetch test")
            return True

        print("Fetching Cerebras models...")
        models = fetch_models_from_cerebras()

        if not models:
            print("❌ No models returned")
            return False

        print(f"✅ Fetched {len(models)} models")

        # Check model ID format (should NOT have @cerebras/ prefix)
        first_model = models[0]
        model_id = first_model.get('id', '')

        print(f"\nFirst model ID: {model_id}")

        if model_id.startswith('@cerebras/'):
            print("❌ Model still has @cerebras/ prefix (should be direct)")
            return False

        print("✅ Model ID is in direct format (no @cerebras/ prefix)")
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_cerebras_client_initialization():
    """Test Cerebras client can be initialized"""
    print("\n" + "=" * 80)
    print("TEST 3: Client Initialization")
    print("=" * 80)

    api_key = os.getenv("CEREBRAS_API_KEY")
    if not api_key:
        print("⚠️  CEREBRAS_API_KEY not set, skipping")
        return True

    try:
        from src.services.cerebras_client import get_cerebras_client

        client = get_cerebras_client()
        print("✅ Cerebras client initialized successfully")
        print(f"Client type: {type(client).__name__}")
        return True

    except Exception as e:
        print(f"❌ Failed to initialize client: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_cerebras_inference():
    """Test actual inference with Cerebras"""
    print("\n" + "=" * 80)
    print("TEST 4: Direct Inference (Optional)")
    print("=" * 80)

    api_key = os.getenv("CEREBRAS_API_KEY")
    if not api_key:
        print("⚠️  CEREBRAS_API_KEY not set, skipping")
        return True

    try:
        from src.services.cerebras_client import (
            make_cerebras_request_openai,
            process_cerebras_response
        )

        print("Sending test request to llama3.1-8b...")

        response = make_cerebras_request_openai(
            messages=[
                {"role": "user", "content": "Say 'Direct Cerebras works!'"}
            ],
            model="llama3.1-8b",
            max_tokens=20,
            temperature=0.7
        )

        # Process response
        processed = process_cerebras_response(response)

        if processed and 'choices' in processed:
            content = processed['choices'][0]['message']['content']
            print(f"\n✅ SUCCESS! Response: {content}")
            return True
        else:
            print("❌ Invalid response structure")
            return False

    except Exception as e:
        print(f"❌ Inference failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n🧪 Cerebras Direct Integration Tests")
    print("=" * 80)

    results = []

    # Test 1: Imports
    results.append(("Import Test", test_cerebras_direct_import()))

    # Test 2: Model normalization
    results.append(("Model Normalization", test_cerebras_model_normalization()))

    # Test 3: Client initialization
    results.append(("Client Initialization", test_cerebras_client_initialization()))

    # Test 4: Inference
    results.append(("Direct Inference", test_cerebras_inference()))

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")

    print("\n" + "=" * 80)
    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All tests passed - Cerebras direct integration working!")
    else:
        print("⚠️  Some tests failed - check logs above")

    print("=" * 80 + "\n")

    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
