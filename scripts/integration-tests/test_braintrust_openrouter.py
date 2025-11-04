#!/usr/bin/env python3
"""
Test script to verify Braintrust integration with OpenRouter.

This script demonstrates:
1. Braintrust logger initialization
2. Tracing OpenRouter API calls
3. Logging metrics (tokens, cost, latency)
4. Structured input/output logging

Usage:
    python test_braintrust_openrouter.py
"""

import os
import time
import pytest
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import Braintrust
try:
    from braintrust import current_span, init_logger, start_span, traced
    print("✓ Braintrust imported successfully")
except ImportError as e:
    pytest.skip(f"Braintrust not installed: {e}", allow_module_level=True)

# Import OpenAI SDK (OpenRouter is OpenAI-compatible)
try:
    from openai import OpenAI
    print("✓ OpenAI SDK imported successfully")
except ImportError as e:
    pytest.skip(f"OpenAI SDK not installed: {e}", allow_module_level=True)


def verify_environment():
    """Verify required environment variables are set."""
    print("\n=== Verifying Environment ===")

    braintrust_key = os.getenv("BRAINTRUST_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    if not braintrust_key:
        print("✗ BRAINTRUST_API_KEY not found in environment")
        return False
    else:
        print(f"✓ BRAINTRUST_API_KEY: {braintrust_key[:10]}...")

    if not openrouter_key:
        print("⚠ OPENROUTER_API_KEY not found - using placeholder")
        print("  (You can still test Braintrust initialization)")
    else:
        print(f"✓ OPENROUTER_API_KEY: {openrouter_key[:10]}...")

    return True


def test_braintrust_initialization():
    """Test Braintrust logger initialization."""
    print("\n=== Testing Braintrust Initialization ===")

    try:
        # Initialize Braintrust logger
        logger = init_logger(
            project="Gatewayz Backend",
            api_key=os.getenv("BRAINTRUST_API_KEY")
        )
        print("✓ Braintrust logger initialized successfully")
        print(f"  Project: Gatewayz Backend")
        return logger
    except Exception as e:
        print(f"✗ Failed to initialize Braintrust: {e}")
        return None


# Configure OpenRouter client (OpenAI-compatible)
def get_openrouter_client():
    """Get configured OpenRouter client."""
    return OpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY", "dummy-key-for-testing"),
        base_url="https://openrouter.ai/api/v1",
    )


def call_openrouter_llm(client: OpenAI, input_text: str, params: dict) -> dict:
    """
    Call OpenRouter (OpenAI-compatible API).

    Args:
        client: Configured OpenAI client
        input_text: The prompt/input text
        params: Additional parameters (temperature, model, etc.)

    Returns:
        Dictionary with completion and metrics
    """
    try:
        response = client.chat.completions.create(
            model=params.get("model", "google/gemma-2-9b-it:free"),
            messages=[{"role": "user", "content": input_text}],
            temperature=params.get("temperature", 0.7),
        )

        choice = response.choices[0].message.content if response.choices else ""
        usage = response.usage or {}

        return {
            "completion": choice,
            "metrics": {
                "prompt_tokens": getattr(usage, "prompt_tokens", 0),
                "completion_tokens": getattr(usage, "completion_tokens", 0),
                "total_tokens": getattr(usage, "total_tokens", 0),
            },
        }
    except Exception as e:
        print(f"⚠ API call failed (expected if no valid API key): {e}")
        # Return mock data for testing Braintrust logging
        return {
            "completion": "Mock response (API call failed - using placeholder for Braintrust testing)",
            "metrics": {
                "prompt_tokens": len(input_text.split()),
                "completion_tokens": 10,
                "total_tokens": len(input_text.split()) + 10,
            },
        }


# notrace_io=True prevents logging the function arguments automatically,
# so we can log structured input/output ourselves.
@traced(type="llm", name="OpenRouter LLM", notrace_io=True)
def invoke_openrouter_llm(client: OpenAI, llm_input: str, params: dict):
    """
    Invoke OpenRouter LLM with Braintrust tracing.

    Args:
        client: Configured OpenAI client
        llm_input: The input prompt
        params: LLM parameters (model, temperature, etc.)

    Returns:
        The completion content
    """
    start_time = time.time()
    result = call_openrouter_llm(client, llm_input, params)
    latency_ms = (time.time() - start_time) * 1000

    content = result["completion"]

    # Log to Braintrust with structured data
    current_span().log(
        input=[{"role": "user", "content": llm_input}],
        output=content,
        metrics={
            **result["metrics"],
            "latency_ms": latency_ms,
        },
        metadata=params,
    )

    return content


def test_simple_trace():
    """Test a simple traced function call."""
    print("\n=== Testing Simple Trace ===")

    try:
        client = get_openrouter_client()

        with start_span(name="test_openrouter_call") as span:
            input_text = "What is the capital of Japan?"
            params = {
                "model": "google/gemma-2-9b-it:free",
                "temperature": 0.1
            }

            print(f"  Input: {input_text}")
            print(f"  Model: {params['model']}")

            result = invoke_openrouter_llm(client, input_text, params)

            # Log the overall span
            span.log(
                input={"query": input_text},
                output={"response": result}
            )

            print(f"  Output: {result[:100]}...")
            print("✓ Trace logged successfully")

            return result
    except Exception as e:
        print(f"✗ Failed to execute trace: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_route_handler():
    """Test a route handler simulation with tracing."""
    print("\n=== Testing Route Handler Trace ===")

    class DummyRequest:
        def __init__(self, body: str):
            self.body = body

    try:
        client = get_openrouter_client()

        @traced(name="simulated_chat_endpoint")
        def handle_chat_request(req):
            with start_span(name="process_request") as span:
                result = invoke_openrouter_llm(
                    client,
                    req.body,
                    {
                        "model": "google/gemma-2-9b-it:free",
                        "temperature": 0.7
                    }
                )

                span.log(
                    input={"request_body": req.body},
                    output={"response": result}
                )

                return result

        # Simulate a request
        request = DummyRequest("Explain quantum computing in one sentence.")
        print(f"  Request: {request.body}")

        response = handle_chat_request(request)
        print(f"  Response: {response[:100]}...")
        print("✓ Route handler trace logged successfully")

        return response
    except Exception as e:
        print(f"✗ Failed to execute route handler trace: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main test function."""
    print("=" * 60)
    print("Braintrust + OpenRouter Integration Test")
    print("=" * 60)

    # Step 1: Verify environment
    if not verify_environment():
        print("\n✗ Environment verification failed")
        return

    # Step 2: Initialize Braintrust
    logger = test_braintrust_initialization()
    if not logger:
        print("\n✗ Braintrust initialization failed")
        return

    # Step 3: Test simple trace
    test_simple_trace()

    # Step 4: Test route handler trace
    test_route_handler()

    print("\n" + "=" * 60)
    print("Test Complete!")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. Check your Braintrust dashboard at https://www.braintrust.dev")
    print("2. Look for project 'Gatewayz Backend'")
    print("3. View traces for 'test_openrouter_call' and 'simulated_chat_endpoint'")
    print("4. Verify metrics (tokens, latency) are logged correctly")
    print("\nIf you see traces in Braintrust, the integration is working! ✓")


if __name__ == "__main__":
    main()
