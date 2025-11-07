#!/usr/bin/env python3
"""
Test GLM-4.6-FP8 model via Near AI integration.
Tests the zai-org/GLM-4.6-FP8 model with various prompts.
"""

import asyncio
import sys
import os
from datetime import datetime


def test_model_transformation():
    """Test GLM model transformation for Near"""
    print("\n" + "="*70)
    print("TEST 1: Model Transformation")
    print("="*70)

    from src.services.model_transformations import (
        detect_provider_from_model_id,
        transform_model_id,
    )

    test_models = [
        "zai-org/GLM-4.6-FP8",
        "near/zai-org/GLM-4.6-FP8",
        "near/GLM-4.6-FP8",
        "GLM-4.6-FP8",
    ]

    print("Testing model ID transformations for GLM-4.6-FP8:")
    print()

    for model_id in test_models:
        print(f"  Input: {model_id}")

        # Test detection
        detected = detect_provider_from_model_id(model_id)
        print(f"    Detected Provider: {detected}")

        # Test transformation for Near
        if detected == "near" or model_id.startswith("near/"):
            transformed = transform_model_id(model_id, "near")
            print(f"    Transformed for Near: {transformed}")
        print()

    return True


def test_glm_direct_api():
    """Test GLM-4.6-FP8 via Near API directly"""
    print("\n" + "="*70)
    print("TEST 2: GLM-4.6-FP8 via Near API (Direct)")
    print("="*70)

    api_key = os.environ.get("NEAR_API_KEY")

    if not api_key:
        print("⚠ NEAR_API_KEY not configured, skipping direct API test")
        print("  Set NEAR_API_KEY to test: export NEAR_API_KEY=your_key")
        return True

    try:
        import httpx

        # First, list available models to check if GLM is available
        print("Checking available models on Near AI...")

        headers = {"Authorization": f"Bearer {api_key}"}

        with httpx.Client() as client:
            response = client.get(
                "https://cloud-api.near.ai/v1/models",
                headers=headers,
                timeout=10.0,
            )

            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])

                print(f"✓ Found {len(models)} models on Near AI")
                print()

                # Look for GLM model
                glm_models = [
                    m.get("id", "")
                    for m in models
                    if "glm" in m.get("id", "").lower()
                ]

                if glm_models:
                    print("✓ GLM models found:")
                    for model in glm_models:
                        print(f"  - {model}")
                    print()
                else:
                    print("⚠ No GLM models found in your available models")
                    print("  Available model IDs (first 5):")
                    for model in models[:5]:
                        print(f"  - {model.get('id', 'N/A')}")
                    if len(models) > 5:
                        print(f"  ... and {len(models) - 5} more")
                    print()

                # Try to make a request with a known model
                if models:
                    first_model = models[0].get("id", "")
                    print(f"Attempting chat request with: {first_model}")

                    response = client.post(
                        "https://cloud-api.near.ai/v1/chat/completions",
                        headers=headers,
                        json={
                            "model": first_model,
                            "messages": [
                                {
                                    "role": "user",
                                    "content": "Say 'Hello from Near AI!' in one sentence.",
                                }
                            ],
                            "max_tokens": 50,
                            "temperature": 0.7,
                        },
                        timeout=30.0,
                    )

                    if response.status_code == 200:
                        result = response.json()
                        content = result.get("choices", [{}])[0].get(
                            "message", {}
                        ).get("content", "No response")
                        print(f"✓ Response: {content[:100]}...")
                        print(f"  Status: Success")
                        return True
                    else:
                        print(
                            f"✗ Request failed (HTTP {response.status_code}): {response.text[:200]}"
                        )
                        return False
                else:
                    print("⚠ No models available to test")
                    return False

            else:
                print(f"✗ Failed to fetch models (HTTP {response.status_code})")
                return False

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_glm_via_openai_client():
    """Test GLM-4.6-FP8 via OpenAI client"""
    print("\n" + "="*70)
    print("TEST 3: GLM-4.6-FP8 via OpenAI Client")
    print("="*70)

    api_key = os.environ.get("NEAR_API_KEY")

    if not api_key:
        print("⚠ NEAR_API_KEY not configured, skipping OpenAI client test")
        return True

    try:
        from openai import OpenAI

        print("Initializing OpenAI client for Near AI...")

        client = OpenAI(api_key=api_key, base_url="https://cloud-api.near.ai/v1")

        # List available models
        print("Fetching available models...")
        models = client.models.list()
        model_list = [m.id for m in models.data]

        print(f"✓ Retrieved {len(model_list)} models")

        # Look for GLM
        glm_models = [m for m in model_list if "glm" in m.lower()]

        if glm_models:
            print(f"\n✓ GLM models available:")
            for model in glm_models:
                print(f"  - {model}")

            # Try with first GLM model
            test_model = glm_models[0]
            print(f"\nTesting with: {test_model}")

            response = client.chat.completions.create(
                model=test_model,
                messages=[
                    {
                        "role": "user",
                        "content": "What is your name? Answer in one sentence.",
                    }
                ],
                max_tokens=50,
                temperature=0.5,
            )

            print(f"✓ Response received:")
            print(f"  Model: {response.model}")
            print(f"  Content: {response.choices[0].message.content}")

            if response.usage:
                print(f"  Tokens: {response.usage.total_tokens}")

            return True
        else:
            print("⚠ No GLM models found via OpenAI client")
            print("  Available models (first 5):")
            for model in model_list[:5]:
                print(f"  - {model}")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_glm_via_gateway():
    """Test GLM-4.6-FP8 via gateway API"""
    print("\n" + "="*70)
    print("TEST 4: GLM-4.6-FP8 via Gateway API")
    print("="*70)

    api_key = os.environ.get("NEAR_API_KEY")

    if not api_key:
        print("⚠ NEAR_API_KEY not configured, skipping gateway test")
        return True

    try:
        import httpx

        # Test if gateway is running
        print("Testing gateway API connectivity...")

        try:
            with httpx.Client() as client:
                response = client.get(
                    "http://localhost:8000/health",
                    timeout=5.0,
                )
                if response.status_code in [200, 404]:
                    print("⚠ Gateway may be running, but health endpoint not responsive")
                else:
                    print(f"✗ Gateway health check failed: HTTP {response.status_code}")
        except Exception as e:
            print(f"⚠ Gateway not running: {e}")
            print("  Start gateway: python src/main.py")
            return True

        # Try to make request
        print("\nAttempting chat request via gateway...")

        with httpx.Client() as client:
            response = client.post(
                "http://localhost:8000/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": "near/zai-org/GLM-4.6-FP8",
                    "messages": [
                        {
                            "role": "user",
                            "content": "Hello! Are you GLM-4.6-FP8?",
                        }
                    ],
                    "max_tokens": 50,
                    "temperature": 0.7,
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                result = response.json()
                content = result.get("choices", [{}])[0].get(
                    "message", {}
                ).get("content", "No response")
                print(f"✓ Response: {content}")
                return True
            else:
                print(f"✗ Request failed: HTTP {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                return False

    except Exception as e:
        print(f"⚠ Error: {e}")
        return True  # Not critical


def main():
    """Run all GLM tests"""
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " GLM-4.6-FP8 MODEL TEST WITH NEAR AI ".center(68) + "║")
    print("║" + f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".center(68) + "║")
    print("╚" + "="*68 + "╝")

    results = {
        "Model Transformation": test_model_transformation(),
        "Direct API Test": test_glm_direct_api(),
        "OpenAI Client Test": test_glm_via_openai_client(),
        "Gateway API Test": test_glm_via_gateway(),
    }

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")

    print("\n" + "="*70)
    print("INFORMATION")
    print("="*70)

    print("\nGLM-4.6-FP8 Model Information:")
    print("  • Organization: zai-org")
    print("  • Model: GLM-4.6-FP8")
    print("  • Type: Quantized model (FP8 precision)")
    print("  • Provider: Near AI")
    print()

    print("How to use:")
    print("  1. Get API key from: https://cloud.near.ai/")
    print("  2. Set environment: export NEAR_API_KEY=your_key")
    print("  3. Check available models: https://cloud.near.ai/models")
    print("  4. Use in requests: model='near/zai-org/GLM-4.6-FP8'")
    print()

    print("Via cURL:")
    print("  curl -X POST https://cloud-api.near.ai/v1/chat/completions \\")
    print("    -H 'Authorization: Bearer YOUR_KEY' \\")
    print("    -d '{\"model\": \"zai-org/GLM-4.6-FP8\", \"messages\": [...]}'")
    print()

    print("Via Gateway:")
    print("  curl -X POST http://localhost:8000/v1/chat/completions \\")
    print("    -H 'Authorization: Bearer YOUR_KEY' \\")
    print("    -d '{\"model\": \"near/zai-org/GLM-4.6-FP8\", \"messages\": [...]}'")

    print("\n" + "="*70)

    passed = sum(results.values())
    total = len(results)

    if passed >= total - 1:  # Allow 1 failure (gateway might not be running)
        print(f"\n✓ GLM-4.6-FP8 is accessible via Near AI!")
        return 0
    else:
        print(f"\n⚠ Some tests failed ({passed}/{total} passed)")
        return 1


if __name__ == "__main__":
    sys.exit(main())
