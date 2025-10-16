#!/usr/bin/env python
"""Test Fireworks API directly to diagnose the issue"""

import os
import sys
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_fireworks_api():
    """Test Fireworks API directly"""

    api_key = os.getenv("FIREWORKS_API_KEY")
    if not api_key:
        print("ERROR: FIREWORKS_API_KEY not found in environment")
        return

    print(f"Using Fireworks API Key: ...{api_key[-8:]}")

    # Create Fireworks client using OpenAI-compatible interface
    client = OpenAI(
        base_url="https://api.fireworks.ai/inference/v1",
        api_key=api_key
    )

    # Test with the exact model ID from the catalog
    model = "accounts/fireworks/models/deepseek-v3p1"

    print(f"\nTesting model: {model}")
    print("-" * 50)

    try:
        # Make a simple test request
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Say hello"}
            ],
            max_tokens=50,
            temperature=0.7
        )

        print("SUCCESS!")
        print(f"Response ID: {response.id}")
        print(f"Model: {response.model}")
        print(f"Content: {response.choices[0].message.content}")
        print(f"Usage: {response.usage}")

    except Exception as e:
        print(f"ERROR: {e}")
        print(f"Error type: {type(e).__name__}")

        # Try to get more details from the error
        if hasattr(e, 'response'):
            print(f"Response status: {getattr(e.response, 'status_code', 'N/A')}")
            print(f"Response text: {getattr(e.response, 'text', 'N/A')}")

        if hasattr(e, 'body'):
            print(f"Error body: {e.body}")

if __name__ == "__main__":
    test_fireworks_api()