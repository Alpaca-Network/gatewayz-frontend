#!/usr/bin/env python3
"""
Test script to verify Claude Sonnet 4.5 integration
Tests both the /v1/messages endpoint (Anthropic API) and /v1/chat/completions (OpenAI API)
"""
import os
import pytest
import json

import sys
sys.path.insert(0, 'src')

try:
    from openai import OpenAI
except ImportError:
    pytest.skip("openai package not installed", allow_module_level=True)

try:
    import httpx
except ImportError:
    pytest.skip("httpx package not installed", allow_module_level=True)

# Configuration
GATEWAY_API_KEY = os.getenv('GATEWAY_API_KEY')
GATEWAY_BASE_URL = os.getenv('GATEWAY_BASE_URL', 'http://localhost:8000')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')

# Claude Sonnet 4.5 model ID
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

# Test message
TEST_MESSAGE = "Say 'Hello from Claude Sonnet 4.5!' and nothing else."


def print_header(title: str):
    """Print a formatted header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_section(title: str):
    """Print a formatted section"""
    print("\n" + "-" * 80)
    print(f"  {title}")
    print("-" * 80)


def test_claude_via_openrouter_direct():
    """Test Claude Sonnet 4.5 directly via OpenRouter"""
    print_section("Test 1: Claude Sonnet 4.5 - OpenRouter Direct")

    if not OPENROUTER_API_KEY:
        print("  ✗ OPENROUTER_API_KEY not set in environment")
        return False

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": "https://terragon.ai",
                "X-Title": "Claude Sonnet 4.5 Test"
            }
        )

        print(f"  → Model: {CLAUDE_MODEL}")
        print(f"  → Message: {TEST_MESSAGE}")

        response = client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=100
        )

        content = response.choices[0].message.content
        model_used = response.model

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content}")
        print(f"  → Tokens - Prompt: {response.usage.prompt_tokens}, Completion: {response.usage.completion_tokens}")

        return True

    except Exception as e:
        print(f"  ✗ Failed: {type(e).__name__}: {str(e)}")
        return False


def test_claude_via_gateway_chat():
    """Test Claude Sonnet 4.5 via Gateway /v1/chat/completions endpoint"""
    print_section("Test 2: Claude Sonnet 4.5 - Gateway Chat Completions API")

    if not GATEWAY_API_KEY:
        print("  ⚠ GATEWAY_API_KEY not set (skipping gateway test)")
        return None

    try:
        client = OpenAI(
            base_url=f"{GATEWAY_BASE_URL}/v1",
            api_key=GATEWAY_API_KEY
        )

        print(f"  → Gateway URL: {GATEWAY_BASE_URL}/v1/chat/completions")
        print(f"  → Model: {CLAUDE_MODEL}")
        print(f"  → Message: {TEST_MESSAGE}")

        response = client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=100
        )

        content = response.choices[0].message.content
        model_used = response.model

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content}")
        print(f"  → Tokens - Prompt: {response.usage.prompt_tokens}, Completion: {response.usage.completion_tokens}")

        return True

    except Exception as e:
        print(f"  ✗ Failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_claude_via_gateway_messages():
    """Test Claude Sonnet 4.5 via Gateway /v1/messages endpoint (Anthropic API)"""
    print_section("Test 3: Claude Sonnet 4.5 - Gateway Messages API (Anthropic)")

    if not GATEWAY_API_KEY:
        print("  ⚠ GATEWAY_API_KEY not set (skipping gateway test)")
        return None

    try:
        import httpx

        url = f"{GATEWAY_BASE_URL}/v1/messages"
        headers = {
            "Authorization": f"Bearer {GATEWAY_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": CLAUDE_MODEL,
            "max_tokens": 100,
            "messages": [
                {"role": "user", "content": TEST_MESSAGE}
            ]
        }

        print(f"  → URL: {url}")
        print(f"  → Model: {CLAUDE_MODEL}")
        print(f"  → Message: {TEST_MESSAGE}")

        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        # Extract response from Anthropic format
        content = data['content'][0]['text']
        model_used = data.get('model', CLAUDE_MODEL)
        usage = data.get('usage', {})

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content}")
        print(f"  → Response format: Anthropic Messages API")
        print(f"  → Tokens - Input: {usage.get('input_tokens', 'N/A')}, Output: {usage.get('output_tokens', 'N/A')}")
        print(f"  → Stop reason: {data.get('stop_reason', 'N/A')}")

        return True

    except Exception as e:
        print(f"  ✗ Failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_claude_streaming():
    """Test Claude Sonnet 4.5 with streaming via Gateway"""
    print_section("Test 4: Claude Sonnet 4.5 - Streaming via Gateway")

    if not GATEWAY_API_KEY:
        print("  ⚠ GATEWAY_API_KEY not set (skipping streaming test)")
        return None

    try:
        client = OpenAI(
            base_url=f"{GATEWAY_BASE_URL}/v1",
            api_key=GATEWAY_API_KEY
        )

        print(f"  → Model: {CLAUDE_MODEL}")
        print(f"  → Message: {TEST_MESSAGE}")
        print(f"  → Streaming response: ", end="", flush=True)

        stream = client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=100,
            stream=True
        )

        chunks = []
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                chunks.append(content)
                print(content, end="", flush=True)

        print()  # New line after streaming
        full_response = "".join(chunks)

        if full_response:
            print(f"  ✓ Success!")
            print(f"  → Received {len(chunks)} chunks")
            return True
        else:
            print(f"  ✗ No content received in stream")
            return False

    except Exception as e:
        print(f"  ✗ Failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print_header("CLAUDE SONNET 4.5 VERIFICATION TEST")
    print(f"Model: {CLAUDE_MODEL}")
    print(f"Gateway URL: {GATEWAY_BASE_URL}")

    results = []

    # Test 1: Direct OpenRouter access
    result = test_claude_via_openrouter_direct()
    if result is not None:
        results.append(("OpenRouter Direct", result))

    # Test 2: Gateway Chat Completions API
    result = test_claude_via_gateway_chat()
    if result is not None:
        results.append(("Gateway Chat API", result))

    # Test 3: Gateway Messages API (Anthropic)
    result = test_claude_via_gateway_messages()
    if result is not None:
        results.append(("Gateway Messages API", result))

    # Test 4: Streaming
    result = test_claude_streaming()
    if result is not None:
        results.append(("Streaming", result))

    # Print summary
    print_header("TEST SUMMARY")

    if not results:
        print("⚠ No tests were run (check API keys configuration)")
        print("\nRequired environment variables:")
        print("  - GATEWAY_API_KEY: For gateway tests")
        print("  - OPENROUTER_API_KEY: For direct OpenRouter tests")
        print("  - GATEWAY_BASE_URL: Gateway URL (default: http://localhost:8000)")
        return 1

    passed = sum(1 for _, success in results if success)
    failed = sum(1 for _, success in results if not success)
    total = len(results)

    for name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"[{status}] {name}")

    print("\n" + "-" * 80)
    print(f"Results: {passed}/{total} passed, {failed}/{total} failed")
    print("=" * 80)

    if passed == total:
        print("\n🎉 All tests passed! Claude Sonnet 4.5 is working correctly.")
        return 0
    elif passed > 0:
        print(f"\n⚠ Partial success: {passed} out of {total} tests passed.")
        return 1
    else:
        print("\n❌ All tests failed. Please check your configuration.")
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n[!] Test interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n[!] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
