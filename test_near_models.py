#!/usr/bin/env python3
"""
Test Near AI models to validate connectivity and response handling.
This script tests different Near AI models with various timeout configurations.
"""

import os
import sys
import time
from typing import Optional

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from openai import OpenAI
    import httpx
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Installing dependencies...")
    os.system("pip install openai httpx python-dotenv")
    from openai import OpenAI
    import httpx

from dotenv import load_dotenv

# Load environment
load_dotenv()

# Test configuration
NEAR_API_KEY = os.getenv("NEAR_API_KEY")
NEAR_BASE_URL = "https://cloud-api.near.ai/v1"

# Models to test
TEST_MODELS = [
    "deepseek-ai/DeepSeek-V3.1",
    "glm-4.6-fp8",
    "gpt-oss-120b",
    "llama-3-70b",
    "qwen-2-72b",
]

def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def test_near_api_key():
    """Test if Near API key is configured"""
    print_section("STEP 1: Validate API Key Configuration")

    if not NEAR_API_KEY:
        print("❌ NEAR_API_KEY not found in environment")
        print("   Please set it in .env file or environment variables")
        return False

    print(f"✅ NEAR_API_KEY found: ...{NEAR_API_KEY[-8:]}")
    return True

def test_near_endpoint():
    """Test if Near AI endpoint is reachable"""
    print_section("STEP 2: Test Near AI Endpoint Connectivity")

    try:
        response = httpx.get(
            f"{NEAR_BASE_URL}/models",
            headers={"Authorization": f"Bearer {NEAR_API_KEY}"},
            timeout=10.0
        )

        if response.status_code == 200:
            data = response.json()
            models = data.get("data", [])
            print(f"✅ Near AI endpoint reachable")
            print(f"   Found {len(models)} available models")

            # List available models
            if models:
                print("\n   Available models:")
                for model in models[:10]:  # Show first 10
                    model_id = model.get("id", "unknown")
                    print(f"      • {model_id}")
                if len(models) > 10:
                    print(f"      ... and {len(models) - 10} more")

            return True
        else:
            print(f"❌ Endpoint returned status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"❌ Failed to connect to Near AI endpoint")
        print(f"   Error: {type(e).__name__}: {e}")
        return False

def test_model_chat(model_id: str, timeout_config) -> dict:
    """Test a specific model with chat completion"""
    result = {
        "model": model_id,
        "success": False,
        "error": None,
        "response_time": 0,
        "content": None,
        "usage": None
    }

    try:
        # Create client with timeout configuration
        client = OpenAI(
            base_url=NEAR_BASE_URL,
            api_key=NEAR_API_KEY,
            timeout=timeout_config
        )

        # Simple test message
        messages = [
            {"role": "user", "content": "Say 'Hello, I am working!' and nothing else."}
        ]

        # Make request and measure time
        start_time = time.time()
        response = client.chat.completions.create(
            model=model_id,
            messages=messages,
            max_tokens=50,
            temperature=0.7
        )
        end_time = time.time()

        result["success"] = True
        result["response_time"] = round(end_time - start_time, 2)
        result["content"] = response.choices[0].message.content if response.choices else None
        result["usage"] = {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            "total_tokens": response.usage.total_tokens if response.usage else 0,
        }

    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)[:150]}"

    return result

def test_all_models():
    """Test all Near AI models"""
    print_section("STEP 3: Test Model Chat Completions")

    # Test with simple timeout first
    print("\nTesting with simple timeout (120 seconds):")
    print("-" * 80)

    results_simple = []
    for model_id in TEST_MODELS:
        print(f"\nTesting: {model_id}")
        result = test_model_chat(model_id, timeout_config=120.0)
        results_simple.append(result)

        if result["success"]:
            print(f"   ✅ SUCCESS ({result['response_time']}s)")
            print(f"      Response: {result['content'][:100] if result['content'] else 'N/A'}")
            if result["usage"]:
                print(f"      Tokens: {result['usage']['total_tokens']} total")
        else:
            print(f"   ❌ FAILED")
            print(f"      Error: {result['error']}")

    # Test with granular timeout
    print("\n" + "=" * 80)
    print("\nTesting with granular httpx.Timeout (connect=10s, read=180s):")
    print("-" * 80)

    granular_timeout = httpx.Timeout(
        connect=10.0,   # Connection timeout
        read=180.0,     # Read timeout (time to get response)
        write=10.0,     # Write timeout
        pool=5.0        # Pool timeout
    )

    results_granular = []
    for model_id in TEST_MODELS:
        print(f"\nTesting: {model_id}")
        result = test_model_chat(model_id, timeout_config=granular_timeout)
        results_granular.append(result)

        if result["success"]:
            print(f"   ✅ SUCCESS ({result['response_time']}s)")
            print(f"      Response: {result['content'][:100] if result['content'] else 'N/A'}")
            if result["usage"]:
                print(f"      Tokens: {result['usage']['total_tokens']} total")
        else:
            print(f"   ❌ FAILED")
            print(f"      Error: {result['error']}")

    return results_simple, results_granular

def print_summary(results_simple, results_granular):
    """Print test summary"""
    print_section("SUMMARY")

    print("\nSimple Timeout (120s) Results:")
    print("-" * 80)
    success_count = sum(1 for r in results_simple if r["success"])
    print(f"   Success: {success_count}/{len(results_simple)}")

    if success_count > 0:
        avg_time = sum(r["response_time"] for r in results_simple if r["success"]) / success_count
        print(f"   Average response time: {avg_time:.2f}s")

    failed_models = [r["model"] for r in results_simple if not r["success"]]
    if failed_models:
        print(f"\n   Failed models:")
        for model in failed_models:
            print(f"      • {model}")

    print("\nGranular Timeout (read=180s) Results:")
    print("-" * 80)
    success_count_granular = sum(1 for r in results_granular if r["success"])
    print(f"   Success: {success_count_granular}/{len(results_granular)}")

    if success_count_granular > 0:
        avg_time = sum(r["response_time"] for r in results_granular if r["success"]) / success_count_granular
        print(f"   Average response time: {avg_time:.2f}s")

    # Compare results
    print("\nComparison:")
    print("-" * 80)

    improved = []
    for i, model_id in enumerate(TEST_MODELS):
        simple_success = results_simple[i]["success"]
        granular_success = results_granular[i]["success"]

        if not simple_success and granular_success:
            improved.append(model_id)

    if improved:
        print(f"   Models that improved with granular timeout:")
        for model in improved:
            print(f"      • {model}")
    else:
        print(f"   No difference between timeout configurations")

def main():
    """Main test execution"""
    print("\n" + "=" * 80)
    print("  Near AI Model Validation Test")
    print("  Testing connectivity, model availability, and timeout configurations")
    print("=" * 80)

    # Step 1: Check API key
    if not test_near_api_key():
        print("\n❌ Cannot proceed without API key")
        return 1

    # Step 2: Check endpoint
    if not test_near_endpoint():
        print("\n❌ Cannot proceed without endpoint connectivity")
        return 1

    # Step 3: Test models
    results_simple, results_granular = test_all_models()

    # Print summary
    print_summary(results_simple, results_granular)

    print("\n" + "=" * 80)
    print("✅ Test Complete!")
    print("=" * 80)

    return 0

if __name__ == "__main__":
    sys.exit(main())
