#!/usr/bin/env python
"""Test Near AI API with Qwen3-30B-A3B-Instruct-2507 model to verify timeout fix"""

import os
import sys
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_near_qwen_api():
    """Test Near AI API with Qwen3-30B model"""

    api_key = os.getenv("NEAR_API_KEY")
    if not api_key:
        print("ERROR: NEAR_API_KEY not found in environment")
        print("Please set NEAR_API_KEY in your .env file")
        return

    print(f"Using Near AI API Key: ...{api_key[-8:]}")

    # Create Near AI client using OpenAI-compatible interface with 120s timeout
    client = OpenAI(
        base_url="https://cloud-api.near.ai/v1",
        api_key=api_key,
        timeout=120.0  # Extended timeout for large models
    )

    # Test with the Qwen3-30B model
    model = "Qwen/Qwen3-30B-A3B-Instruct-2507"

    print(f"\nTesting model: {model}")
    print(f"Timeout: 120 seconds")
    print("-" * 50)

    try:
        # Make a simple test request
        print("Sending request...")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Say hello and tell me what model you are."}
            ],
            max_tokens=100,
            temperature=0.7
        )

        print("\nSUCCESS!")
        print(f"Response ID: {response.id}")
        print(f"Model: {response.model}")
        print(f"Content: {response.choices[0].message.content}")
        if response.usage:
            print(f"Usage: {response.usage}")
        else:
            print("Usage: Not available")

    except Exception as e:
        print(f"\nERROR: {type(e).__name__}")
        print(f"Message: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_near_qwen_api()
