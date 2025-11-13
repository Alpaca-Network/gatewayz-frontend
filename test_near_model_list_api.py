#!/usr/bin/env python3
"""
Test Near AI model list endpoint to verify pricing data is available.
"""

import json
import os
import sys

try:
    import httpx
    USE_HTTPX = True
except ImportError:
    try:
        import requests
        USE_HTTPX = False
    except ImportError:
        print("ERROR: Neither httpx nor requests library available")
        sys.exit(1)

NEAR_API_KEY = os.getenv("NEAR_API_KEY")
NEAR_MODEL_LIST_URL = "https://cloud-api.near.ai/v1/model/list"

def test_model_list_endpoint():
    """Test the /v1/model/list endpoint and verify pricing data"""
    print("=" * 80)
    print("  Near AI Model List API Test")
    print("=" * 80)

    if not NEAR_API_KEY:
        print("\n❌ NEAR_API_KEY not found in environment")
        print("   Set it with: export NEAR_API_KEY='your-key'")
        return 1

    print(f"\n✅ API Key found: ...{NEAR_API_KEY[-8:]}")
    print(f"   Endpoint: {NEAR_MODEL_LIST_URL}")

    headers = {
        "Authorization": f"Bearer {NEAR_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        print("\n📡 Fetching model list...")

        if USE_HTTPX:
            response = httpx.get(NEAR_MODEL_LIST_URL, headers=headers, timeout=20.0)
        else:
            response = requests.get(NEAR_MODEL_LIST_URL, headers=headers, timeout=20.0)

        print(f"   Status Code: {response.status_code}")

        if response.status_code != 200:
            print(f"\n❌ Failed to fetch models")
            print(f"   Response: {response.text[:500]}")
            return 1

        data = response.json()
        models = data.get("models", [])

        if not models:
            print("\n❌ No models found in response")
            print(f"   Response keys: {list(data.keys())}")
            return 1

        print(f"\n✅ Successfully fetched {len(models)} models")
        print("\n" + "=" * 80)
        print("  Model Pricing Verification")
        print("=" * 80)

        all_have_pricing = True

        for i, model in enumerate(models, 1):
            model_id = model.get("modelId", "unknown")
            input_cost = model.get("inputCostPerToken", {})
            output_cost = model.get("outputCostPerToken", {})
            metadata = model.get("metadata", {})

            print(f"\n{i}. {model_id}")
            print(f"   Display Name: {metadata.get('displayName', 'N/A')}")
            print(f"   Context Length: {metadata.get('contextLength', 'N/A'):,}" if metadata.get('contextLength') else "   Context Length: N/A")

            # Check pricing
            if input_cost and output_cost:
                input_amount = input_cost.get("amount", 0)
                input_scale = input_cost.get("scale", -9)
                output_amount = output_cost.get("amount", 0)
                output_scale = output_cost.get("scale", -9)

                # Convert to per million tokens
                input_per_million = input_amount * (10 ** (6 + input_scale))
                output_per_million = output_amount * (10 ** (6 + output_scale))

                print(f"   Pricing:")
                print(f"     Input:  ${input_per_million:.2f} per million tokens")
                print(f"     Output: ${output_per_million:.2f} per million tokens")
                print(f"   ✅ Pricing available")
            else:
                print(f"   ❌ No pricing data")
                all_have_pricing = False

        print("\n" + "=" * 80)
        print("  Summary")
        print("=" * 80)

        if all_have_pricing:
            print(f"\n✅ SUCCESS: All {len(models)} models have pricing data")
            print("\nRecommendation:")
            print("  • The Near AI API provides complete pricing information")
            print("  • Your integration should successfully extract pricing dynamically")
            print("  • No need for manual pricing fallback for these models")
            return 0
        else:
            print(f"\n⚠️  WARNING: Some models missing pricing data")
            print("\nRecommendation:")
            print("  • Consider keeping manual pricing fallback for incomplete data")
            return 1

    except Exception as e:
        print(f"\n❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(test_model_list_endpoint())
