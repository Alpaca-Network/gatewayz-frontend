#!/usr/bin/env python3
"""
Test script for streaming chat completions endpoint
"""
import os
import requests
import json
import sys

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("TEST_API_KEY", "your_api_key_here")

def test_non_streaming():
    """Test regular (non-streaming) chat completion"""
    print("\n=== Testing Non-Streaming Response ===")

    url = f"{BASE_URL}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "openai/gpt-3.5-turbo",
        "messages": [
            {"role": "user", "content": "Say 'Hello from non-streaming!' and nothing else"}
        ],
        "stream": False,
        "max_tokens": 50
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"Response: {content}")
            print(f"Usage: {data.get('usage', {})}")
            print("✅ Non-streaming test PASSED")
        else:
            print(f"❌ Non-streaming test FAILED: {response.text}")

    except Exception as e:
        print(f"❌ Non-streaming test ERROR: {e}")


def test_streaming():
    """Test streaming chat completion"""
    print("\n=== Testing Streaming Response ===")

    url = f"{BASE_URL}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "openai/gpt-3.5-turbo",
        "messages": [
            {"role": "user", "content": "Count from 1 to 5 slowly"}
        ],
        "stream": True,
        "max_tokens": 50
    }

    try:
        response = requests.post(url, headers=headers, json=payload, stream=True)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")

        if response.status_code != 200:
            print(f"❌ Streaming test FAILED: {response.text}")
            return

        if "text/event-stream" not in response.headers.get("content-type", ""):
            print(f"❌ Wrong content type: expected 'text/event-stream'")
            return

        print("\nStreaming chunks:")
        print("-" * 60)

        full_content = ""
        chunk_count = 0

        for line in response.iter_lines():
            if not line:
                continue

            line = line.decode('utf-8')

            # Skip empty lines and parse SSE format
            if line.startswith("data: "):
                data_str = line[6:]  # Remove "data: " prefix

                if data_str == "[DONE]":
                    print("\n" + "-" * 60)
                    print("Stream completed with [DONE]")
                    break

                try:
                    chunk_data = json.loads(data_str)

                    # Check for errors
                    if "error" in chunk_data:
                        print(f"❌ Error in stream: {chunk_data['error']}")
                        return

                    # Extract content from delta
                    choices = chunk_data.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        content = delta.get("content", "")

                        if content:
                            full_content += content
                            print(content, end="", flush=True)
                            chunk_count += 1

                except json.JSONDecodeError as e:
                    print(f"\n⚠️  Failed to parse chunk: {data_str}")
                    continue

        print(f"\n\n✅ Streaming test PASSED")
        print(f"   - Received {chunk_count} chunks")
        print(f"   - Total content length: {len(full_content)} characters")
        print(f"   - Full response: {full_content}")

    except Exception as e:
        print(f"❌ Streaming test ERROR: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Run all tests"""
    print("=" * 60)
    print("Streaming Chat Completions Test Suite")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {API_KEY[:10]}..." if len(API_KEY) > 10 else "API Key: [NOT SET]")

    if API_KEY == "your_api_key_here":
        print("\n⚠️  Warning: Please set a valid API key")
        print("   Set TEST_API_KEY environment variable or update this script")
        sys.exit(1)

    # Run tests
    test_non_streaming()
    test_streaming()

    print("\n" + "=" * 60)
    print("Test suite completed")
    print("=" * 60)


if __name__ == "__main__":
    main()
