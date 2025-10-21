#!/usr/bin/env python3
"""
Direct call to Arch-Router model via HuggingFace Router Endpoint
Uses the same endpoint as your working curl command
"""

import os
from dotenv import load_dotenv
load_dotenv(override=True)

import httpx
import json
import sys

def call_arch_router_direct(user_message: str, stream: bool = False):
    """Call the Arch-Router model via HF Router Endpoint (https://router.huggingface.co)"""

    # Get API key
    hf_api_key = os.getenv("HUG_API_KEY")
    if not hf_api_key:
        print("ERROR: HUG_API_KEY not set in .env file")
        sys.exit(1)

    # HF Router endpoint (the one you're using in curl)
    api_url = "https://router.huggingface.co/v1/chat/completions"

    # Prepare request - matches your working curl command
    headers = {
        "Authorization": f"Bearer {hf_api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [
            {
                "role": "user",
                "content": user_message
            }
        ],
        "model": "katanemo/Arch-Router-1.5B:hf-inference",
        "stream": stream
    }

    print("=" * 70)
    print("CALLING ARCH-ROUTER VIA HF ROUTER ENDPOINT")
    print("=" * 70)
    print(f"\nEndpoint: {api_url}")
    print(f"Model: katanemo/Arch-Router-1.5B:hf-inference")
    print(f"User Message: {user_message}")
    print(f"Stream: {stream}")
    print(f"\nSending request...")
    print("-" * 70)

    try:
        response = httpx.post(api_url, json=payload, headers=headers, timeout=120.0)

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()

            print("\nMODEL RESPONSE:")
            print("-" * 70)

            # Extract the assistant's message from response
            if "choices" in result and len(result["choices"]) > 0:
                choice = result["choices"][0]
                if "message" in choice:
                    message = choice["message"]
                    if "content" in message:
                        print(message["content"])
                    else:
                        print(json.dumps(result, indent=2))
                else:
                    print(json.dumps(result, indent=2))
            else:
                print(json.dumps(result, indent=2))

            print("\n" + "=" * 70)
            print("SUCCESS: Response received from Arch-Router")
            print("=" * 70)

            return result

        else:
            print(f"\nERROR: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except httpx.TimeoutException:
        print("\nERROR: Request timed out")
        print("Try again - HF models can take time to respond")
        return None

    except Exception as e:
        print(f"\nERROR: {type(e).__name__}: {e}")
        return None


if __name__ == "__main__":
    # Get message from command line or use default
    if len(sys.argv) > 1:
        user_message = " ".join(sys.argv[1:])
    else:
        user_message = "What is the capital of France?"

    result = call_arch_router_direct(user_message, stream=False)

    sys.exit(0 if result else 1)
