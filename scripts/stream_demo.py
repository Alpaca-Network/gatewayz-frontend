#!/usr/bin/env python3
"""Live streaming demo"""
import requests
import json
import sys

API_KEY = "gw_live_qPKTsUInGXXyX5tI15Ymr1Xdqu5MX4NLUyamf6T2_w0"
BASE_URL = "https://api.gatewayz.ai"

print("=" * 70)
print("🚀 LIVE STREAMING DEMO - Gatewayz API")
print("=" * 70)

url = f"{BASE_URL}/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": "openai/gpt-3.5-turbo",
    "messages": [
        {"role": "user", "content": "Tell me a short joke about programming"}
    ],
    "stream": True,
    "max_tokens": 100
}

print(f"\n🔗 Endpoint: {url}")
print(f"🤖 Model: {payload['model']}")
print(f"💬 Prompt: {payload['messages'][0]['content']}")
print(f"📡 Stream: {payload['stream']}")
print("\n" + "-" * 70)

try:
    response = requests.post(url, headers=headers, json=payload, stream=True, timeout=15)

    if response.status_code != 200:
        print(f"❌ Error: Status {response.status_code}")
        print(response.text)
        sys.exit(1)

    print(f"✅ Connected - Status: {response.status_code}")
    print(f"📨 Content-Type: {response.headers.get('content-type')}")
    print("\n🤖 AI Response (streaming):\n")

    full_content = ""
    chunk_count = 0

    for line in response.iter_lines(decode_unicode=True):
        if not line:
            continue

        if line.startswith("data: "):
            data_str = line[6:]

            if data_str == "[DONE]":
                print("\n\n✨ Stream completed!")
                break

            try:
                chunk_data = json.loads(data_str)

                # Check for errors
                if "error" in chunk_data:
                    print(f"\n❌ Error: {chunk_data['error']}")
                    break

                # Extract content
                choices = chunk_data.get("choices", [])
                if choices:
                    delta = choices[0].get("delta", {})
                    content = delta.get("content", "")

                    if content:
                        full_content += content
                        chunk_count += 1
                        print(content, end="", flush=True)

            except json.JSONDecodeError:
                continue

    print(f"\n\n{'-' * 70}")
    print(f"📊 Stats:")
    print(f"   • Chunks received: {chunk_count}")
    print(f"   • Total characters: {len(full_content)}")
    print(f"   • Content: \"{full_content.strip()}\"")
    print(f"\n{'=' * 70}")
    print("🎉 Streaming is working perfectly!")
    print("=" * 70)

except requests.exceptions.Timeout:
    print("\n⚠️  Request timed out")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
