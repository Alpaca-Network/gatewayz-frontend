"""
Simple test for /v1/responses endpoint
"""
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://127.0.0.1:8000"
API_KEY = os.getenv("API_KEY", "mdlz_sk_test_key")
MODEL = "deepseek/deepseek-r1-0528"

print("\n" + "="*60)
print("Testing /v1/responses endpoint")
print("="*60)

url = f"{BASE_URL}/v1/responses"
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": MODEL,
    "input": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hello in 5 words or less."}
    ],
    "max_tokens": 50,
    "temperature": 0.7
}

try:
    response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
    response.raise_for_status()

    result = response.json()
    print(f"\nStatus: {response.status_code}")
    print(f"Object type: {result.get('object')}")
    print(f"Model: {result.get('model')}")
    print(f"Content: {result.get('output', [{}])[0].get('content')}")
    print(f"Usage: {result.get('usage', {})}")
    print(f"Gateway Usage: {result.get('gateway_usage', {})}")
    print("\nTest PASSED!")

except Exception as e:
    print(f"\nError: {e}")
    print("Test FAILED!")
