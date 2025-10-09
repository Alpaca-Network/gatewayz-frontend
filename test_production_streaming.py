#!/usr/bin/env python3
"""Test streaming on production"""
import requests
import json

API_KEY = "gw_live_qPKTsUInGXXyX5tI15Ymr1Xdqu5MX4NLUyamf6T2_w0"
BASE_URL = "https://api.gatewayz.ai"

print("=" * 70)
print("Testing Streaming on Production (api.gatewayz.ai)")
print("=" * 70)

# Test streaming
url = f"{BASE_URL}/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": "openai/gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Count from 1 to 3"}],
    "stream": True,
    "max_tokens": 50
}

print(f"\n🔍 Testing: POST {url}")
print(f"   Model: {payload['model']}")
print(f"   Stream: {payload['stream']}")

try:
    response = requests.post(url, headers=headers, json=payload, stream=True)
    print(f"\n📡 Status Code: {response.status_code}")
    print(f"   Content-Type: {response.headers.get('content-type')}")

    if response.status_code != 200:
        print(f"\n❌ Error: {response.text}")
        exit(1)

    if "text/event-stream" in response.headers.get("content-type", ""):
        print(f"\n✅ Streaming is WORKING on production!")
        print("-" * 70)
        print("Stream output:")
        print("-" * 70)

        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith("data: "):
                    data = line_str[6:]
                    if data == "[DONE]":
                        print("\n[DONE]")
                        break
                    try:
                        chunk = json.loads(data)
                        if "choices" in chunk and chunk["choices"]:
                            delta = chunk["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                print(content, end="", flush=True)
                    except:
                        pass

        print("\n" + "-" * 70)
        print("\n🎉 STREAMING WORKS ON PRODUCTION!")

    else:
        print(f"\n⚠️  Streaming NOT enabled on production yet")
        print(f"   Response: {response.text[:200]}")
        print(f"\n   You need to deploy the new code to Railway")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
