#!/usr/bin/env python3
"""
Clear rate limit cache on the backend
"""

import requests
import sys

API_URL = "https://api.gatewayz.ai/admin/clear-rate-limit-cache"
# You'll need an admin API key for this endpoint
ADMIN_API_KEY = "gw_live_01eQv2HGWkjo0ApxoC4-G3yaOv6ilbzJwL9t6QpjQ5c"  # Try with your key

def clear_cache():
    headers = {
        "Authorization": f"Bearer {ADMIN_API_KEY}",
        "Content-Type": "application/json"
    }

    print("[INFO] Attempting to clear rate limit cache...")
    print(f"[INFO] API URL: {API_URL}")

    try:
        response = requests.post(API_URL, headers=headers, timeout=30)

        print(f"[INFO] Status Code: {response.status_code}")
        print(f"[INFO] Response: {response.text}")

        if response.status_code == 200:
            print("\n[OK] Cache cleared successfully!")
            return True
        elif response.status_code == 401 or response.status_code == 403:
            print("\n[ERROR] Authentication failed - need admin privileges")
            return False
        else:
            print(f"\n[WARNING] Unexpected status code: {response.status_code}")
            return False

    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        return False

if __name__ == '__main__':
    success = clear_cache()
    sys.exit(0 if success else 1)
