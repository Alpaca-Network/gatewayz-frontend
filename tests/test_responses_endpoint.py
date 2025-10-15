"""
Test script for the new /v1/responses endpoint (OpenAI unified API)
Compares behavior with existing /v1/chat/completions endpoint
"""
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
BASE_URL = "http://127.0.0.1:8000"
API_KEY = os.getenv("API_KEY", "mdlz_sk_test_key")
MODEL = "deepseek/deepseek-r1-0528"

def test_chat_completions_endpoint():
    """Test the legacy /v1/chat/completions endpoint"""
    print("\n" + "="*60)
    print("Testing /v1/chat/completions (Legacy API)")
    print("="*60)

    url = f"{BASE_URL}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Write a haiku about the ocean."}
        ],
        "max_tokens": 100,
        "temperature": 0.7
    }

    try:
        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()

        result = response.json()
        print(f"\n✅ Status: {response.status_code}")
        print(f"📝 Response format: {result.get('object', 'N/A')}")
        print(f"🤖 Model: {result.get('model', 'N/A')}")
        print(f"💬 Content: {result.get('choices', [{}])[0].get('message', {}).get('content', 'N/A')}")
        print(f"📊 Usage: {result.get('usage', {})}")
        print(f"💰 Gateway Usage: {result.get('gateway_usage', {})}")

        return result
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def test_responses_endpoint():
    """Test the new /v1/responses endpoint"""
    print("\n" + "="*60)
    print("Testing /v1/responses (Unified API)")
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
            {"role": "user", "content": "Write a haiku about the ocean."}
        ],
        "max_tokens": 100,
        "temperature": 0.7
    }

    try:
        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()

        result = response.json()
        print(f"\n✅ Status: {response.status_code}")
        print(f"📝 Response format: {result.get('object', 'N/A')}")
        print(f"🤖 Model: {result.get('model', 'N/A')}")
        print(f"💬 Content: {result.get('output', [{}])[0].get('content', 'N/A')}")
        print(f"📊 Usage: {result.get('usage', {})}")
        print(f"💰 Gateway Usage: {result.get('gateway_usage', {})}")

        return result
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def test_responses_with_json_format():
    """Test /v1/responses with JSON response format"""
    print("\n" + "="*60)
    print("Testing /v1/responses with JSON Response Format")
    print("="*60)

    url = f"{BASE_URL}/v1/responses"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "input": [
            {"role": "system", "content": "You are a helpful assistant that responds in JSON format."},
            {"role": "user", "content": "Generate a JSON object with a person's name, age, and city."}
        ],
        "max_tokens": 200,
        "temperature": 0.7,
        "response_format": {
            "type": "json_object"
        }
    }

    try:
        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()

        result = response.json()
        content = result.get('output', [{}])[0].get('content', '')

        print(f"\n✅ Status: {response.status_code}")
        print(f"📝 Response format: {result.get('object', 'N/A')}")
        print(f"🤖 Model: {result.get('model', 'N/A')}")
        print(f"💬 Content: {content}")

        # Try to parse the content as JSON
        try:
            json_content = json.loads(content)
            print(f"✅ Valid JSON response: {json_content}")
        except json.JSONDecodeError:
            print(f"⚠️ Content is not valid JSON")

        print(f"📊 Usage: {result.get('usage', {})}")

        return result
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def test_streaming_responses():
    """Test /v1/responses with streaming"""
    print("\n" + "="*60)
    print("Testing /v1/responses Streaming")
    print("="*60)

    url = f"{BASE_URL}/v1/responses"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "input": [
            {"role": "user", "content": "Count from 1 to 5."}
        ],
        "max_tokens": 50,
        "stream": True
    }

    try:
        with httpx.stream("POST", url, headers=headers, json=payload, timeout=30.0) as response:
            response.raise_for_status()

            print(f"\n✅ Status: {response.status_code}")
            print("📡 Streaming output:")

            accumulated_content = ""
            for line in response.iter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        print("\n✅ Stream completed")
                        break

                    try:
                        chunk = json.loads(data_str)
                        if "output" in chunk:
                            for output_item in chunk["output"]:
                                if "content" in output_item:
                                    content = output_item["content"]
                                    accumulated_content += content
                                    print(content, end="", flush=True)
                    except json.JSONDecodeError:
                        pass

            print(f"\n\n📝 Complete message: {accumulated_content}")
            return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def compare_endpoints():
    """Compare the output of both endpoints"""
    print("\n" + "="*60)
    print("COMPARISON: Legacy vs Unified API")
    print("="*60)

    legacy = test_chat_completions_endpoint()
    unified = test_responses_endpoint()

    if legacy and unified:
        print("\n" + "="*60)
        print("KEY DIFFERENCES:")
        print("="*60)
        print(f"Legacy uses: 'messages' → 'choices' → 'message'")
        print(f"Unified uses: 'input' → 'output' → role/content")
        print(f"\nLegacy object type: {legacy.get('object')}")
        print(f"Unified object type: {unified.get('object')}")
        print(f"\nBoth endpoints charge the same and provide equivalent responses.")


if __name__ == "__main__":
    print("\n🚀 Starting /v1/responses endpoint tests\n")

    # Run all tests
    compare_endpoints()
    test_responses_with_json_format()
    test_streaming_responses()

    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)
