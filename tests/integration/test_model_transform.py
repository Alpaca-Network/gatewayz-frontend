#!/usr/bin/env python
"""Test the model transformation feature"""

import requests
import json

# Test cases for model transformation
test_cases = [
    {
        "name": "Simplified DeepSeek format",
        "payload": {
            "model": "deepseek-ai/deepseek-v3",
            "provider": "fireworks",
            "messages": [{"role": "user", "content": "Reply with: Test successful"}],
            "max_tokens": 10
        }
    },
    {
        "name": "Original Fireworks format",
        "payload": {
            "model": "accounts/fireworks/models/deepseek-v3p1",
            "provider": "fireworks",
            "messages": [{"role": "user", "content": "Reply with: Test successful"}],
            "max_tokens": 10
        }
    },
    {
        "name": "Auto-detection with simplified format",
        "payload": {
            "model": "deepseek-ai/deepseek-v3",
            # No provider specified - should auto-detect
            "messages": [{"role": "user", "content": "Reply with: Test successful"}],
            "max_tokens": 10
        }
    }
]

API_URL = "http://localhost:8000/v1/chat/completions"
API_KEY = "gw_temp_lw1xmCuEfLkKn6tsaDF3vw"

def test_api():
    """Test the API with different model formats"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    print("Testing Model Transformation Feature")
    print("=" * 50)

    for test in test_cases:
        print(f"\nTest: {test['name']}")
        print(f"Model: {test['payload']['model']}")
        print(f"Provider: {test['payload'].get('provider', 'auto-detect')}")

        try:
            response = requests.post(API_URL, json=test['payload'], headers=headers, timeout=10)

            if response.status_code == 200:
                result = response.json()
                content = result.get('choices', [{}])[0].get('message', {}).get('content', 'No content')
                print(f"[OK] SUCCESS: {content[:100]}")
            else:
                print(f"[FAIL] HTTP {response.status_code} - {response.json().get('detail', response.text)}")

        except Exception as e:
            print(f"[ERROR] {e}")

    print("\n" + "=" * 50)
    print("Testing complete!")

if __name__ == "__main__":
    test_api()