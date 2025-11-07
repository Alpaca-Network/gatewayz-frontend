#!/usr/bin/env python3
"""
Simple test script for Near AI API without requiring full environment setup.
This tests the Near AI integration directly.
"""

import os
import json
from datetime import datetime
from typing import Optional

def test_near_api_directly():
    """Test Near API directly using OpenAI client"""
    print("\n" + "="*70)
    print("NEAR AI API DIRECT TEST")
    print("="*70)

    # Get API key from environment
    api_key = os.environ.get("NEAR_API_KEY")

    if not api_key:
        print("\n✗ NEAR_API_KEY is not configured")
        print("\nSteps to get API key:")
        print("1. Visit: https://cloud.near.ai/")
        print("2. Sign up with GitHub or Google account")
        print("3. Go to API Keys section in dashboard")
        print("4. Generate a new API key")
        print("5. Add to environment: export NEAR_API_KEY=your_key_here")
        print("   Or create a .env file with: NEAR_API_KEY=your_key_here")
        return False

    print(f"\n✓ NEAR_API_KEY found: {api_key[:20]}...")

    # Test 1: List available models
    print("\n" + "-"*70)
    print("Test 1: Listing available Near AI models")
    print("-"*70)

    try:
        import httpx

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        response = httpx.get(
            "https://cloud-api.near.ai/v1/models",
            headers=headers,
            timeout=10.0,
        )

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            models = data.get("data", [])
            print(f"✓ Successfully retrieved {len(models)} models\n")

            print("Available models:")
            for model in models[:5]:
                model_id = model.get("id", "N/A")
                context = model.get("metadata", {}).get("context_length", "N/A")
                print(f"  • {model_id} (context: {context})")

            if len(models) > 5:
                print(f"  ... and {len(models) - 5} more models")

            models_ok = True
        else:
            print(f"✗ Failed to retrieve models")
            print(f"Response: {response.text[:200]}")
            models_ok = False

    except Exception as e:
        print(f"✗ Error: {e}")
        models_ok = False

    # Test 2: Chat request with OpenAI client
    print("\n" + "-"*70)
    print("Test 2: Making a chat request to Near AI")
    print("-"*70)

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=api_key,
            base_url="https://cloud-api.near.ai/v1"
        )

        print("Sending request to a Near AI model...")
        print("  (Note: Replace 'deepseek-v3' with a model from https://cloud.near.ai/models)")

        response = client.chat.completions.create(
            model="deepseek-v3",
            messages=[
                {
                    "role": "user",
                    "content": "Say 'Hello from Near AI!' and nothing else."
                }
            ],
            max_tokens=50,
            temperature=0.7,
        )

        print(f"✓ Response received successfully")
        print(f"  Model: {response.model}")
        print(f"  Finish reason: {response.choices[0].finish_reason}")
        print(f"  Content: {response.choices[0].message.content}")

        if response.usage:
            print(f"\nToken usage:")
            print(f"  Prompt tokens: {response.usage.prompt_tokens}")
            print(f"  Completion tokens: {response.usage.completion_tokens}")
            print(f"  Total tokens: {response.usage.total_tokens}")

        chat_ok = True

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        chat_ok = False

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    print(f"Model listing: {'✓ PASS' if models_ok else '✗ FAIL'}")
    print(f"Chat request:  {'✓ PASS' if chat_ok else '✗ FAIL'}")

    if models_ok and chat_ok:
        print("\n✓ All tests passed! Near AI is working correctly.")
        print("\nYou can now use Near models via the gateway API:")
        print("  curl -X POST http://localhost:8000/v1/chat/completions \\")
        print("    -H 'Content-Type: application/json' \\")
        print("    -H 'Authorization: Bearer YOUR_API_KEY' \\")
        print("    -d '{")
        print("      \"model\": \"near/your-model-name\",")
        print("      \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]")
        print("    }'")
        print("\n  Check available models at: https://cloud.near.ai/models")
        return True
    else:
        print("\n✗ Some tests failed.")
        return False


def test_model_list_response_format():
    """Test that the response format is correct"""
    print("\n" + "="*70)
    print("RESPONSE FORMAT VALIDATION")
    print("="*70)

    api_key = os.environ.get("NEAR_API_KEY")
    if not api_key:
        print("⚠ Skipping (NEAR_API_KEY not configured)")
        return True

    try:
        import httpx

        headers = {"Authorization": f"Bearer {api_key}"}

        response = httpx.get(
            "https://cloud-api.near.ai/v1/models",
            headers=headers,
            timeout=10.0,
        )

        if response.status_code != 200:
            print(f"⚠ Skipping (HTTP {response.status_code})")
            return True

        data = response.json()

        # Validate response structure
        print("Validating response structure:")

        if "data" not in data:
            print("✗ Missing 'data' field in response")
            return False

        print("✓ 'data' field present")

        models = data["data"]
        if not models:
            print("⚠ No models in response")
            return True

        # Check first model structure
        first_model = models[0]
        required_fields = ["id", "object", "created", "owned_by"]
        optional_fields = ["display_name", "description", "metadata", "pricing"]

        print(f"\nFirst model structure ({first_model.get('id')}):")
        for field in required_fields + optional_fields:
            if field in first_model:
                value = first_model[field]
                if isinstance(value, dict):
                    print(f"  ✓ {field}: {json.dumps(value, default=str)[:50]}...")
                else:
                    print(f"  ✓ {field}: {str(value)[:50]}")
            elif field in required_fields:
                print(f"  ✗ Missing required field: {field}")
                return False
            else:
                print(f"  ⚠ Missing optional field: {field}")

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    """Run all tests"""
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " NEAR AI INTEGRATION TEST ".center(68) + "║")
    print("║" + f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".center(68) + "║")
    print("╚" + "="*68 + "╝")

    results = {
        "API Test": test_near_api_directly(),
        "Format Validation": test_model_list_response_format(),
    }

    print("\n" + "="*70)
    print("FINAL RESULTS")
    print("="*70)

    all_passed = all(results.values())

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name}: {status}")

    if all_passed:
        print("\n✓ All validation tests passed!")
        return 0
    else:
        print("\n✗ Some tests failed.")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
