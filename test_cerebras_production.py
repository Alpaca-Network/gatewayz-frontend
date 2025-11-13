#!/usr/bin/env python3
"""
Test Cerebras models via production API
"""

import requests
import json
import os

# Configuration
BASE_URL = os.getenv("BASE_URL", "https://api.gatewayz.ai")
TEST_API_KEY = os.getenv("TEST_API_KEY")  # Optional: for authenticated tests
TIMEOUT = 30

def test_cerebras_models_in_catalog():
    """Test that Cerebras models appear in the catalog"""
    print("=" * 80)
    print("TEST 1: Checking if Cerebras models are in the catalog")
    print("=" * 80)

    try:
        response = requests.get(f"{BASE_URL}/catalog/models", timeout=TIMEOUT)

        if response.status_code == 401 or response.status_code == 403:
            print("⚠️  Catalog endpoint requires authentication")
            if not TEST_API_KEY:
                print("❌ TEST_API_KEY not set, cannot proceed")
                return None
            else:
                print("ℹ️  Retrying with API key...")
                response = requests.get(
                    f"{BASE_URL}/catalog/models",
                    headers={"Authorization": f"Bearer {TEST_API_KEY}"},
                    timeout=TIMEOUT
                )

        if response.status_code != 200:
            print(f"❌ Failed to fetch catalog: HTTP {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return None

        models = response.json()

        # Filter for Cerebras models
        cerebras_models = []
        if isinstance(models, list):
            # List of models
            cerebras_models = [m for m in models if 'cerebras' in m.get('id', '').lower() or m.get('provider', '').lower() == 'cerebras']
        elif isinstance(models, dict) and 'models' in models:
            # Nested structure
            all_models = models['models']
            cerebras_models = [m for m in all_models if 'cerebras' in m.get('id', '').lower() or m.get('provider', '').lower() == 'cerebras']
        elif isinstance(models, dict) and 'data' in models:
            # Another nested structure
            all_models = models['data']
            cerebras_models = [m for m in all_models if 'cerebras' in m.get('id', '').lower() or m.get('provider', '').lower() == 'cerebras']

        if not cerebras_models:
            print("⚠️  No Cerebras models found in catalog")
            print(f"Total models in catalog: {len(models) if isinstance(models, list) else 'unknown'}")
            return None

        print(f"✅ Found {len(cerebras_models)} Cerebras models in catalog")
        print("\nCerebras models (first 5):")
        for i, model in enumerate(cerebras_models[:5], 1):
            model_id = model.get('id', 'unknown')
            model_name = model.get('name', model_id)
            print(f"  {i}. {model_id}")

        if len(cerebras_models) > 5:
            print(f"  ... and {len(cerebras_models) - 5} more")

        return cerebras_models

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_cerebras_inference(model_id: str, api_key: str):
    """Test inference with a Cerebras model"""
    print("\n" + "=" * 80)
    print(f"TEST 2: Testing inference with Cerebras model")
    print("=" * 80)
    print(f"Model: {model_id}")

    # Prepare request
    request_payload = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant. Keep responses very brief."},
            {"role": "user", "content": "Say 'Hello from Cerebras!' and nothing else."}
        ],
        "max_tokens": 50,
        "temperature": 0.7
    }

    print(f"\nRequest payload:")
    print(f"  Model: {request_payload['model']}")
    print(f"  Message: {request_payload['messages'][1]['content']}")

    try:
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json=request_payload,
            timeout=TIMEOUT
        )

        print(f"\nResponse Status: HTTP {response.status_code}")

        if response.status_code == 401:
            print("❌ Authentication failed - invalid API key")
            return False
        elif response.status_code == 402:
            print("⚠️  Insufficient credits")
            return False
        elif response.status_code == 429:
            print("⚠️  Rate limit exceeded")
            return False
        elif response.status_code != 200:
            print(f"❌ Request failed: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False

        # Parse response
        result = response.json()

        if 'choices' not in result or not result['choices']:
            print("❌ No choices in response")
            print(f"Response: {json.dumps(result, indent=2)[:500]}")
            return False

        content = result['choices'][0].get('message', {}).get('content', '')

        if not content:
            print("❌ Empty response content")
            return False

        print("\n✅ SUCCESS! Cerebras model responded:")
        print("═" * 80)
        print(f"Response: {content}")
        print("═" * 80)

        # Show usage stats if available
        if 'usage' in result:
            usage = result['usage']
            print(f"\n📊 Token Usage:")
            print(f"  - Prompt tokens: {usage.get('prompt_tokens', 'N/A')}")
            print(f"  - Completion tokens: {usage.get('completion_tokens', 'N/A')}")
            print(f"  - Total tokens: {usage.get('total_tokens', 'N/A')}")

        # Show model info if available
        if 'model' in result:
            print(f"\n🤖 Model: {result['model']}")

        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main test function"""
    print("\n🧪 Cerebras Models Verification Test (Production API)")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {'Set' if TEST_API_KEY else 'Not set'}")
    print("=" * 80)

    # Test 1: Check catalog
    cerebras_models = test_cerebras_models_in_catalog()

    if not cerebras_models:
        print("\n❌ Cannot proceed with inference test - no Cerebras models found")
        print("\nℹ️  To run authenticated tests, set TEST_API_KEY environment variable:")
        print("   export TEST_API_KEY='your-api-key-here'")
        return

    # Test 2: Try inference if we have an API key
    if not TEST_API_KEY:
        print("\n⚠️  Skipping inference test - TEST_API_KEY not set")
        print("\nℹ️  To test inference, set TEST_API_KEY environment variable:")
        print("   export TEST_API_KEY='your-api-key-here'")
        return

    # Use first Cerebras model
    test_model = cerebras_models[0].get('id')

    if not test_model:
        print("\n❌ First Cerebras model has no ID")
        return

    success = test_cerebras_inference(test_model, TEST_API_KEY)

    print("\n" + "=" * 80)
    if success:
        print("✅ All tests passed - Cerebras integration is working!")
    else:
        print("⚠️  Inference test failed - check logs above")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
