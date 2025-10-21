#!/usr/bin/env python3
"""
Check if backend deployment is live and accepting requests
"""

import requests
import time
import sys

API_KEY = "gw_live_01eQv2HGWkjo0ApxoC4-G3yaOv6ilbzJwL9t6QpjQ5c"
API_URL = "https://api.gatewayz.ai/v1/chat/completions"

def check_backend():
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "anthropic/claude-sonnet-4",
        "messages": [
            {"role": "user", "content": "test"}
        ],
        "max_tokens": 5
    }

    print("[INFO] Testing GatewayZ backend...")
    print(f"[INFO] API URL: {API_URL}")

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=30)

        print(f"[INFO] Status Code: {response.status_code}")

        if response.status_code == 429:
            print("[ERROR] Still getting 429 - Concurrency limit exceeded")
            print(f"[INFO] Response: {response.text[:200]}")
            return False
        elif response.status_code == 200:
            print("[OK] Backend is responding correctly!")
            return True
        else:
            print(f"[WARNING] Unexpected status code: {response.status_code}")
            print(f"[INFO] Response: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        return False

if __name__ == '__main__':
    print("="*60)
    print("GatewayZ Backend Deployment Checker")
    print("="*60)
    print("\nWaiting for Railway deployment...")
    print("This will check every 30 seconds for up to 10 minutes.\n")

    max_attempts = 20  # 10 minutes
    attempt = 0

    while attempt < max_attempts:
        attempt += 1
        print(f"\n[Attempt {attempt}/{max_attempts}]")

        if check_backend():
            print("\n" + "="*60)
            print("SUCCESS! Backend is accepting requests!")
            print("="*60)
            sys.exit(0)

        if attempt < max_attempts:
            print(f"\n[INFO] Waiting 30 seconds before next check...")
            time.sleep(30)

    print("\n" + "="*60)
    print("TIMEOUT: Backend still not accepting requests after 10 minutes")
    print("="*60)
    sys.exit(1)
