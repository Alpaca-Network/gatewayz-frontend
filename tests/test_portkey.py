"""
Test script to verify Portkey integration
"""
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.config import Config
from src.services.portkey_client import make_portkey_request_openai, process_portkey_response


def test_portkey_chat_completion():
    """Test a simple chat completion request via Portkey"""
    print("=" * 60)
    print("Testing Portkey Chat Completion")
    print("=" * 60)

    # Check configuration
    print(f"\nPortkey API Key configured: {bool(Config.PORTKEY_API_KEY)}")

    # Test messages
    messages = [
        {"role": "user", "content": "Say 'Hello from Portkey!' in exactly those words."}
    ]

    model = "gpt-3.5-turbo"
    provider = "openai"

    print(f"\nModel: {model}")
    print(f"Provider: {provider}")
    print(f"Messages: {messages}")

    try:
        print("\nSending request to Portkey...")
        response = make_portkey_request_openai(
            messages=messages,
            model=model,
            provider=provider,
            max_tokens=50
        )

        print("SUCCESS: Received response from Portkey")

        # Process response
        processed = process_portkey_response(response)

        print(f"\nProcessed Response:")
        print(f"  ID: {processed['id']}")
        print(f"  Model: {processed['model']}")
        print(f"  Usage: {processed['usage']}")
        print(f"  Content: {processed['choices'][0]['message']['content']}")

        return True

    except Exception as e:
        print(f"\nERROR: Failed to make Portkey request: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_provider_comparison():
    """Test different providers through Portkey"""
    print("\n" + "=" * 60)
    print("Testing Multiple Providers via Portkey")
    print("=" * 60)

    providers_to_test = [
        ("openai", "gpt-3.5-turbo"),
        # Add more providers as needed
    ]

    for provider, model in providers_to_test:
        print(f"\nTesting {provider} with model {model}...")

        messages = [
            {"role": "user", "content": f"Say 'Hello from {provider}!'"}
        ]

        try:
            response = make_portkey_request_openai(
                messages=messages,
                model=model,
                provider=provider,
                max_tokens=30
            )

            processed = process_portkey_response(response)
            print(f"  SUCCESS: {processed['choices'][0]['message']['content'][:50]}...")

        except Exception as e:
            print(f"  ERROR: {e}")


if __name__ == "__main__":
    print("Portkey Integration Test Suite")
    print("=" * 60)

    # Test 1: Basic chat completion
    success = test_portkey_chat_completion()

    # Test 2: Multiple providers (if first test passed)
    if success:
        test_provider_comparison()

    print("\n" + "=" * 60)
    print("Tests completed!")
    print("=" * 60)
