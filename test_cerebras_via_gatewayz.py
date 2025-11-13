#!/usr/bin/env python3
"""
Test Cerebras models via Gatewayz API
"""

import os
import sys

def test_cerebras_via_gatewayz():
    """Test Cerebras models through Gatewayz API gateway"""

    # Check for API key
    api_key = os.getenv("GATEWAYZ_API_KEY")
    if not api_key:
        print("Error: GATEWAYZ_API_KEY environment variable not set")
        print("Usage: export GATEWAYZ_API_KEY='your-key' && python3 test_cerebras_via_gatewayz.py")
        return False

    print("=" * 80)
    print("🧪 CEREBRAS MODELS TEST VIA GATEWAYZ API")
    print("=" * 80)
    print(f"\nAPI Key: {api_key[:10]}...{api_key[-10:]}")
    print("Base URL: https://api.gatewayz.ai")

    # Try importing requests
    try:
        import requests
    except ImportError:
        print("\n❌ Error: 'requests' library not installed")
        print("Install with: pip install requests")
        return False

    # Test 1: Check catalog for Cerebras models
    print("\n" + "─" * 80)
    print("TEST 1: Checking catalog for Cerebras models")
    print("─" * 80)

    try:
        response = requests.get(
            "https://api.gatewayz.ai/catalog/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30
        )

        if response.status_code == 401:
            print("❌ Authentication failed - invalid API key")
            return False
        elif response.status_code != 200:
            print(f"❌ Failed to fetch catalog: HTTP {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False

        models = response.json()

        # Find Cerebras models
        cerebras_models = []
        if isinstance(models, list):
            cerebras_models = [
                m for m in models
                if 'cerebras' in m.get('id', '').lower() or
                   m.get('provider', '').lower() == 'cerebras'
            ]
        elif isinstance(models, dict):
            all_models = models.get('models', models.get('data', []))
            cerebras_models = [
                m for m in all_models
                if 'cerebras' in m.get('id', '').lower() or
                   m.get('provider', '').lower() == 'cerebras'
            ]

        if not cerebras_models:
            print("⚠️  No Cerebras models found in catalog")
            print(f"Total models: {len(models) if isinstance(models, list) else 'unknown'}")
            return False

        print(f"✅ Found {len(cerebras_models)} Cerebras models")
        print("\nAvailable Cerebras models:")
        for i, model in enumerate(cerebras_models[:10], 1):
            model_id = model.get('id', 'unknown')
            print(f"  {i}. {model_id}")

        if len(cerebras_models) > 10:
            print(f"  ... and {len(cerebras_models) - 10} more")

        # Test 2: Send inference request
        print("\n" + "─" * 80)
        print("TEST 2: Testing inference with Cerebras model")
        print("─" * 80)

        test_model = cerebras_models[0].get('id')
        print(f"Model: {test_model}")

        payload = {
            "model": test_model,
            "messages": [
                {"role": "user", "content": "Write a haiku about the speed of Cerebras AI hardware"}
            ],
            "max_tokens": 100,
            "temperature": 0.7
        }

        print(f"Prompt: {payload['messages'][0]['content']}")
        print("\nSending request...")

        response = requests.post(
            "https://api.gatewayz.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 401:
            print("❌ Authentication failed")
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

        result = response.json()

        if 'choices' not in result or not result['choices']:
            print("❌ No choices in response")
            return False

        content = result['choices'][0].get('message', {}).get('content', '')

        if not content:
            print("❌ Empty response content")
            return False

        print("\n✅ SUCCESS! Cerebras responded via Gatewayz:")
        print("═" * 80)
        print(content)
        print("═" * 80)

        # Show usage if available
        if 'usage' in result:
            usage = result['usage']
            print(f"\n📊 Token Usage:")
            print(f"  • Prompt tokens: {usage.get('prompt_tokens', 'N/A')}")
            print(f"  • Completion tokens: {usage.get('completion_tokens', 'N/A')}")
            print(f"  • Total tokens: {usage.get('total_tokens', 'N/A')}")

        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print()
    success = test_cerebras_via_gatewayz()

    print("\n" + "=" * 80)
    if success:
        print("✅ All tests passed - Cerebras working via Gatewayz API!")
    else:
        print("❌ Tests failed - check logs above")
    print("=" * 80 + "\n")

    sys.exit(0 if success else 1)
