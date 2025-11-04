"""
Comprehensive test script for Alpaca Router and OpenRouter/auto chat endpoints.
Tests both direct API calls and through the Terragon Gateway.
"""
import os
import sys
import json
from typing import Dict, Any
from dotenv import load_dotenv

sys.path.insert(0, 'src')

from openai import OpenAI

# Load environment variables
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
HF_API_KEY = os.getenv('HUG_API_KEY')
GATEWAY_API_KEY = os.getenv('GATEWAY_API_KEY')  # Your Terragon Gateway API key
GATEWAY_BASE_URL = os.getenv('GATEWAY_BASE_URL', 'http://localhost:8000')

# Test configuration
TEST_MESSAGE = "What is 2+2? Answer briefly."
MAX_TOKENS = 50


class Result:
    """Store test results"""
    def __init__(self, name: str, success: bool, message: str, response: Any = None):
        self.name = name
        self.success = success
        self.message = message
        self.response = response

    def __repr__(self):
        status = "✓ PASS" if self.success else "✗ FAIL"
        return f"[{status}] {self.name}: {self.message}"


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


def test_openrouter_auto_direct() -> Result:
    """Test OpenRouter/auto directly via OpenRouter API"""
    print_section("Test 1: OpenRouter/auto - Direct API")

    if not OPENROUTER_API_KEY:
        return Result(
            "OpenRouter/auto Direct",
            False,
            "OPENROUTER_API_KEY not set in environment"
        )

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": "https://terragon.ai",
                "X-Title": "Terragon Test"
            }
        )

        print(f"  → Requesting with model: openrouter/auto")
        print(f"  → Message: {TEST_MESSAGE}")

        response = client.chat.completions.create(
            model="openrouter/auto",
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=MAX_TOKENS
        )

        content = response.choices[0].message.content
        model_used = getattr(response, 'model', 'unknown')

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content[:100]}...")

        return Result(
            "OpenRouter/auto Direct",
            True,
            f"Successfully called openrouter/auto (routed to {model_used})",
            response
        )

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"  ✗ Failed: {error_msg}")
        return Result(
            "OpenRouter/auto Direct",
            False,
            error_msg
        )


def test_alpaca_router_hf_direct() -> Result:
    """Test Alpaca Router (Arch-Router) directly via HuggingFace"""
    print_section("Test 2: Alpaca Router - HuggingFace Direct")

    if not HF_API_KEY:
        return Result(
            "Alpaca Router HF Direct",
            False,
            "HUG_API_KEY not set in environment"
        )

    try:
        # Try HuggingFace Router endpoint
        client = OpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=HF_API_KEY
        )

        model = "katanemo/Arch-Router-1.5B:hf-inference"
        print(f"  → Requesting with model: {model}")
        print(f"  → Message: {TEST_MESSAGE}")

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=MAX_TOKENS
        )

        content = response.choices[0].message.content
        model_used = getattr(response, 'model', 'unknown')

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content[:100]}...")

        return Result(
            "Alpaca Router HF Direct",
            True,
            f"Successfully called Arch-Router via HuggingFace",
            response
        )

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"  ✗ Failed: {error_msg}")
        return Result(
            "Alpaca Router HF Direct",
            False,
            error_msg
        )


def test_alpaca_router_openrouter() -> Result:
    """Test Alpaca Router via OpenRouter"""
    print_section("Test 3: Alpaca Router - OpenRouter API")

    if not OPENROUTER_API_KEY:
        return Result(
            "Alpaca Router OpenRouter",
            False,
            "OPENROUTER_API_KEY not set in environment"
        )

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": "https://terragon.ai",
                "X-Title": "Terragon Test"
            }
        )

        model = "katanemo/Arch-Router-1.5B"
        print(f"  → Requesting with model: {model}")
        print(f"  → Message: {TEST_MESSAGE}")

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=MAX_TOKENS
        )

        content = response.choices[0].message.content
        model_used = getattr(response, 'model', 'unknown')

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content[:100]}...")

        return Result(
            "Alpaca Router OpenRouter",
            True,
            f"Successfully called Arch-Router via OpenRouter",
            response
        )

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"  ✗ Failed: {error_msg}")
        return Result(
            "Alpaca Router OpenRouter",
            False,
            error_msg
        )


def test_gateway_openrouter_auto() -> Result:
    """Test OpenRouter/auto through Terragon Gateway"""
    print_section("Test 4: OpenRouter/auto - Terragon Gateway")

    if not GATEWAY_API_KEY:
        return Result(
            "Gateway OpenRouter/auto",
            False,
            "GATEWAY_API_KEY not set in environment (skipped)"
        )

    try:
        client = OpenAI(
            base_url=f"{GATEWAY_BASE_URL}/v1",
            api_key=GATEWAY_API_KEY
        )

        print(f"  → Gateway URL: {GATEWAY_BASE_URL}/v1/chat/completions")
        print(f"  → Model: openrouter/auto")
        print(f"  → Message: {TEST_MESSAGE}")

        response = client.chat.completions.create(
            model="openrouter/auto",
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=MAX_TOKENS
        )

        content = response.choices[0].message.content
        model_used = getattr(response, 'model', 'unknown')

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content[:100]}...")

        return Result(
            "Gateway OpenRouter/auto",
            True,
            f"Successfully called via Gateway (routed to {model_used})",
            response
        )

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"  ✗ Failed: {error_msg}")
        return Result(
            "Gateway OpenRouter/auto",
            False,
            error_msg
        )


def test_gateway_alpaca_router() -> Result:
    """Test Alpaca Router through Terragon Gateway"""
    print_section("Test 5: Alpaca Router - Terragon Gateway")

    if not GATEWAY_API_KEY:
        return Result(
            "Gateway Alpaca Router",
            False,
            "GATEWAY_API_KEY not set in environment (skipped)"
        )

    try:
        client = OpenAI(
            base_url=f"{GATEWAY_BASE_URL}/v1",
            api_key=GATEWAY_API_KEY
        )

        # Try with the HuggingFace model ID
        model = "katanemo/arch-router-1.5b"

        print(f"  → Gateway URL: {GATEWAY_BASE_URL}/v1/chat/completions")
        print(f"  → Model: {model}")
        print(f"  → Message: {TEST_MESSAGE}")

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=MAX_TOKENS
        )

        content = response.choices[0].message.content
        model_used = getattr(response, 'model', 'unknown')

        print(f"  ✓ Success!")
        print(f"  → Model used: {model_used}")
        print(f"  → Response: {content[:100]}...")

        return Result(
            "Gateway Alpaca Router",
            True,
            f"Successfully called via Gateway",
            response
        )

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"  ✗ Failed: {error_msg}")
        return Result(
            "Gateway Alpaca Router",
            False,
            error_msg
        )


def test_streaming_openrouter_auto() -> Result:
    """Test OpenRouter/auto with streaming"""
    print_section("Test 6: OpenRouter/auto - Streaming")

    if not OPENROUTER_API_KEY:
        return Result(
            "OpenRouter/auto Streaming",
            False,
            "OPENROUTER_API_KEY not set in environment"
        )

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": "https://terragon.ai",
                "X-Title": "Terragon Test"
            }
        )

        print(f"  → Requesting with model: openrouter/auto (streaming)")
        print(f"  → Message: {TEST_MESSAGE}")

        stream = client.chat.completions.create(
            model="openrouter/auto",
            messages=[{"role": "user", "content": TEST_MESSAGE}],
            max_tokens=MAX_TOKENS,
            stream=True
        )

        print(f"  → Streaming response: ", end="", flush=True)
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
            return Result(
                "OpenRouter/auto Streaming",
                True,
                f"Successfully streamed response ({len(chunks)} chunks)",
                full_response
            )
        else:
            return Result(
                "OpenRouter/auto Streaming",
                False,
                "No content received in stream"
            )

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"  ✗ Failed: {error_msg}")
        return Result(
            "OpenRouter/auto Streaming",
            False,
            error_msg
        )


def main():
    """Run all tests and display results"""
    print_header("CHAT ENDPOINTS TEST SUITE")
    print("Testing Alpaca Router and OpenRouter/auto endpoints")
    print(f"Gateway URL: {GATEWAY_BASE_URL}")

    # Run all tests
    results = []

    # Direct API tests
    results.append(test_openrouter_auto_direct())
    results.append(test_alpaca_router_hf_direct())
    results.append(test_alpaca_router_openrouter())

    # Gateway tests (if configured)
    results.append(test_gateway_openrouter_auto())
    results.append(test_gateway_alpaca_router())

    # Streaming test
    results.append(test_streaming_openrouter_auto())

    # Print summary
    print_header("TEST SUMMARY")

    passed = sum(1 for r in results if r.success)
    failed = sum(1 for r in results if not r.success)
    total = len(results)

    for result in results:
        print(result)

    print("\n" + "-" * 80)
    print(f"Results: {passed}/{total} passed, {failed}/{total} failed")
    print("=" * 80)

    # Return exit code
    return 0 if failed == 0 else 1


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
