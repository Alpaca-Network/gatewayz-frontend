#!/usr/bin/env python3
"""
Test if the backend has been updated with new rate limits
"""

import requests
import sys

API_KEY = "gw_live_01eQv2HGWkjo0ApxoC4-G3yaOv6ilbzJwL9t6QpjQ5c"
API_URL = "https://api.gatewayz.ai/v1/chat/completions"

def test_backend():
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "anthropic/claude-sonnet-4",
        "messages": [
            {"role": "user", "content": "Hello, just testing!"}
        ],
        "max_tokens": 10
    }

    print("[INFO] Testing GatewayZ backend...")
    print(f"[INFO] API URL: {API_URL}")

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=30)

        print(f"[INFO] Status Code: {response.status_code}")
        print(f"[INFO] Response: {response.text[:500]}")

        if response.status_code == 429:
            print("\n[ERROR] Still getting 429 - Rate limit exceeded")
            print("[INFO] Backend may still be deploying or needs restart")
            return False
        elif response.status_code == 200:
            print("\n[OK] Backend is responding correctly!")
            return True
        else:
            print(f"\n[WARNING] Unexpected status code: {response.status_code}")
            return False

    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        return False

if __name__ == '__main__':
    success = test_backend()
    sys.exit(0 if success else 1)
