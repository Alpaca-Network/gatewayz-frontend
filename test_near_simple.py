#!/usr/bin/env python3
"""
Simple test of Near AI models using only httpx (no OpenAI library dependency).
Tests raw HTTP requests to validate connectivity and timeout behavior.
"""

import json
import os
import sys
import time

# Try to import httpx, if not available use requests
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

# Near AI configuration
NEAR_BASE_URL = "https://cloud-api.near.ai/v1"
NEAR_API_KEY = os.getenv("NEAR_API_KEY")

# Models to test
TEST_MODELS = [
    "deepseek-ai/DeepSeek-V3.1",
    "glm-4.6-fp8",
    "gpt-oss-120b",
    "llama-3-70b",
]

def print_section(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def test_api_key():
    """Check if API key is available"""
    print_section("1. API Key Validation")

    if not NEAR_API_KEY:
        print("❌ NEAR_API_KEY not found in environment")
        print("   Set it with: export NEAR_API_KEY='your-key'")
        return False

    print(f"✅ API Key found: ...{NEAR_API_KEY[-8:]}")
    return True

def test_models_endpoint():
    """Test the /models endpoint"""
    print_section("2. Test Models Endpoint")

    headers = {
        "Authorization": f"Bearer {NEAR_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        if USE_HTTPX:
            print("Using httpx library...")
            response = httpx.get(
                f"{NEAR_BASE_URL}/models",
                headers=headers,
                timeout=10.0
            )
        else:
            print("Using requests library...")
            response = requests.get(
                f"{NEAR_BASE_URL}/models",
                headers=headers,
                timeout=10.0
            )

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            models = data.get("data", [])
            print(f"✅ Endpoint reachable - Found {len(models)} models")

            # Show available models
            if models:
                print("\nAvailable models:")
                for model in models[:15]:
                    model_id = model.get("id", "unknown")
                    print(f"   • {model_id}")
                if len(models) > 15:
                    print(f"   ... and {len(models) - 15} more")

            return True
        else:
            print(f"❌ Error: Status {response.status_code}")
            print(f"   Response: {response.text[:300]}")
            return False

    except Exception as e:
        print(f"❌ Request failed: {type(e).__name__}: {e}")
        return False

def test_chat_completion(model_id, timeout=120):
    """Test a chat completion with a specific model"""

    headers = {
        "Authorization": f"Bearer {NEAR_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model_id,
        "messages": [
            {"role": "user", "content": "Respond with exactly: 'Hello, I am working correctly!'"}
        ],
        "max_tokens": 50,
        "temperature": 0.7
    }

    result = {
        "model": model_id,
        "success": False,
        "error": None,
        "response_time": 0,
        "content": None,
        "status_code": None
    }

    try:
        start_time = time.time()

        if USE_HTTPX:
            response = httpx.post(
                f"{NEAR_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=timeout
            )
        else:
            response = requests.post(
                f"{NEAR_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=timeout
            )

        end_time = time.time()
        result["response_time"] = round(end_time - start_time, 2)
        result["status_code"] = response.status_code

        if response.status_code == 200:
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                result["content"] = data["choices"][0].get("message", {}).get("content", "")
                result["success"] = True
            else:
                result["error"] = "No choices in response"
        else:
            error_data = response.json() if response.text else {}
            result["error"] = error_data.get("error", {}).get("message", response.text[:200])

    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)[:200]}"

    return result

def test_all_models():
    """Test all configured models"""
    print_section("3. Test Chat Completions")

    print("\nTesting with 120 second timeout:")
    print("-" * 80)

    results = []

    for model_id in TEST_MODELS:
        print(f"\n📝 Testing: {model_id}")
        result = test_chat_completion(model_id, timeout=120)
        results.append(result)

        if result["success"]:
            print(f"   ✅ SUCCESS ({result['response_time']}s)")
            print(f"      Status: {result['status_code']}")
            print(f"      Response: {result['content'][:150] if result['content'] else 'N/A'}")
        else:
            print(f"   ❌ FAILED ({result['response_time']}s)")
            print(f"      Status: {result['status_code']}")
            print(f"      Error: {result['error'][:200] if result['error'] else 'Unknown'}")

    return results

def print_summary(results):
    """Print test summary"""
    print_section("4. Summary")

    success_count = sum(1 for r in results if r["success"])
    total_count = len(results)

    print(f"\nResults: {success_count}/{total_count} models working")
    print("-" * 80)

    if success_count > 0:
        avg_time = sum(r["response_time"] for r in results if r["success"]) / success_count
        print(f"✅ Working models (avg response time: {avg_time:.2f}s):")
        for r in results:
            if r["success"]:
                print(f"   • {r['model']} ({r['response_time']}s)")

    failed_count = total_count - success_count
    if failed_count > 0:
        print(f"\n❌ Failed models ({failed_count}):")
        for r in results:
            if not r["success"]:
                print(f"   • {r['model']}")
                print(f"      Error: {r['error'][:150] if r['error'] else 'Unknown'}")

    # Recommendations
    print("\n" + "=" * 80)
    print("Recommendations:")
    print("-" * 80)

    if failed_count > 0:
        timeout_errors = [r for r in results if not r["success"] and "timeout" in str(r.get("error", "")).lower()]
        if timeout_errors:
            print("⚠️  Timeout errors detected!")
            print("   • Consider increasing timeout beyond 120s")
            print("   • Use httpx.Timeout with separate read timeout (e.g., read=180s)")
            print("   • Large models like DeepSeek-V3.1 may need 180-300s")

        connection_errors = [r for r in results if not r["success"] and r.get("status_code") in [None, 502, 503, 504]]
        if connection_errors:
            print("⚠️  Connection/gateway errors detected!")
            print("   • Near AI infrastructure may be experiencing issues")
            print("   • Consider implementing retry logic with exponential backoff")

        auth_errors = [r for r in results if not r["success"] and r.get("status_code") in [401, 403]]
        if auth_errors:
            print("⚠️  Authentication errors detected!")
            print("   • Verify NEAR_API_KEY is valid")
            print("   • Check API key permissions")
    else:
        print("✅ All models working correctly!")
        print("   Current timeout (120s) appears sufficient")

def main():
    print("=" * 80)
    print("  Near AI Model Validation Test (Simple)")
    print("  Using:", "httpx" if USE_HTTPX else "requests")
    print("=" * 80)

    # Test 1: API key
    if not test_api_key():
        return 1

    # Test 2: Models endpoint
    if not test_models_endpoint():
        print("\n⚠️  Warning: Models endpoint failed, but continuing with chat tests...")

    # Test 3: Chat completions
    results = test_all_models()

    # Summary
    print_summary(results)

    print("\n" + "=" * 80)
    print("✅ Test Complete")
    print("=" * 80)

    return 0

if __name__ == "__main__":
    sys.exit(main())
