"""Test Arch-Router through our backend API"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)

api_key = os.getenv("GATEWAYZ_API_KEY")

if not api_key:
    print("ERROR: GATEWAYZ_API_KEY not set in .env")
    exit(1)

print("=" * 70)
print("TESTING ARCH-ROUTER VIA GATEWAYZ BACKEND")
print("=" * 70)

# Test via /v1/chat/completions endpoint
print("\nTest 1: /v1/chat/completions endpoint")
print("-" * 70)

try:
    response = httpx.post(
        "https://api.gatewayz.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "model": "katanemo/Arch-Router-1.5B",
            "provider": "huggingface",
            "messages": [
                {"role": "user", "content": "What is the capital of France?"}
            ],
            "max_tokens": 50
        },
        timeout=60.0
    )

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print("[SUCCESS]")
        print(f"Response: {data['choices'][0]['message']['content']}")
        print(f"Model: {data.get('model', 'N/A')}")
    else:
        print(f"[ERROR] Status: {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"[EXCEPTION] {e}")

print("\n" + "=" * 70)
