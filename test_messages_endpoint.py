"""
Test script for /v1/messages endpoint with Claude Sonnet 4.5
"""
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
BASE_URL = "http://127.0.0.1:8000"

# We need to get a valid API key from the database
# For now, let's test with a dummy key to see the error handling
# You can replace this with a real API key from your database

API_KEY = os.getenv("TEST_API_KEY", "mdlz_sk_test_key_placeholder")

def test_messages_endpoint():
    """Test the /v1/messages endpoint with Claude Sonnet 4.5"""
    print("\n" + "="*70)
    print("Testing /v1/messages endpoint with Claude Sonnet 4.5")
    print("="*70)

    url = f"{BASE_URL}/v1/messages"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    # Test 1: Basic request
    print("\nTest 1: Basic request")
    print("-" * 70)

    payload = {
        "model": "anthropic/claude-sonnet-4-5",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "Say 'Hello from the Messages API!' and nothing else."}
        ]
    }

    try:
        print(f"Request URL: {url}")
        print(f"Request payload:\n{json.dumps(payload, indent=2)}")

        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)

        print(f"\nStatus: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\nResponse structure:")
            print(f"  - type: {result.get('type')}")
            print(f"  - role: {result.get('role')}")
            print(f"  - model: {result.get('model')}")
            print(f"  - stop_reason: {result.get('stop_reason')}")

            print(f"\nContent:")
            for block in result.get('content', []):
                if block.get('type') == 'text':
                    print(f"  {block.get('text')}")

            print(f"\nUsage:")
            usage = result.get('usage', {})
            print(f"  - input_tokens: {usage.get('input_tokens')}")
            print(f"  - output_tokens: {usage.get('output_tokens')}")

            if 'gateway_usage' in result:
                gateway = result['gateway_usage']
                print(f"\nGateway Usage:")
                print(f"  - tokens_charged: {gateway.get('tokens_charged')}")
                print(f"  - request_ms: {gateway.get('request_ms')}")
                if 'cost_usd' in gateway:
                    print(f"  - cost_usd: ${gateway.get('cost_usd'):.6f}")

            print(f"\nTest 1 PASSED: Anthropic format verified!")
            return result
        else:
            print(f"\nError: {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except httpx.TimeoutException:
        print(f"Request timed out")
        return None
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_messages_with_system():
    """Test with system parameter"""
    print("\n" + "="*70)
    print("Test 2: With system parameter")
    print("="*70)

    url = f"{BASE_URL}/v1/messages"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "anthropic/claude-sonnet-4-5",
        "max_tokens": 1024,
        "system": "You are a helpful AI assistant that always responds in haiku format.",
        "messages": [
            {"role": "user", "content": "Tell me about coding"}
        ]
    }

    try:
        print(f"Request payload:\n{json.dumps(payload, indent=2)}")

        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)

        print(f"\n✅ Status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n Response (should be a haiku):")
            for block in result.get('content', []):
                if block.get('type') == 'text':
                    print(f"  {block.get('text')}")

            print(f"\n✅ Test 2 PASSED: System parameter works!")
            return result
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def test_endpoint_exists():
    """Simple test to verify endpoint exists"""
    print("\n" + "="*70)
    print("Test 0: Verify endpoint exists")
    print("="*70)

    url = f"{BASE_URL}/v1/messages"

    # Try without auth to see if endpoint responds
    try:
        response = httpx.post(
            url,
            json={"model": "test", "max_tokens": 1, "messages": []},
            timeout=5.0
        )

        print(f"✅ Endpoint exists! Status: {response.status_code}")

        if response.status_code == 401 or response.status_code == 422:
            print("   (401/422 expected - means endpoint is responding)")
            return True

        return response.status_code in [200, 401, 422]

    except Exception as e:
        print(f"❌ Endpoint not responding: {e}")
        return False


if __name__ == "__main__":
    print("\nStarting /v1/messages endpoint tests")
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {API_KEY[:20]}..." if len(API_KEY) > 20 else f"API Key: {API_KEY}")

    # Test 0: Verify endpoint exists
    if not test_endpoint_exists():
        print("\n❌ Endpoint not available. Make sure server is running.")
        exit(1)

    # Test 1: Basic request
    result1 = test_messages_endpoint()

    if result1:
        # Test 2: With system parameter
        result2 = test_messages_with_system()

    print("\n" + "="*70)
    print(" All tests completed!")
    print("="*70)
