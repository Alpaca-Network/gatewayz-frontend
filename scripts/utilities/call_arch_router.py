#!/usr/bin/env python3
"""
Direct call to Arch-Router model via HuggingFace Inference API
Bypasses the backend - calls the model directly
"""

import os
from dotenv import load_dotenv
load_dotenv(override=True)

import httpx
import json
import sys

def call_arch_router(user_message: str, max_tokens: int = 100):
    """Call the Arch-Router model directly via HF Inference API"""

    # Get API key
    hf_api_key = os.getenv("HUG_API_KEY")
    if not hf_api_key:
        print("ERROR: HUG_API_KEY not set in .env file")
        sys.exit(1)

    # Model details
    model_id = "katanemo/Arch-Router-1.5B"
    api_url = f"https://api-inference.huggingface.co/models/{model_id}"

    # Prepare request
    headers = {
        "Authorization": f"Bearer {hf_api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "inputs": user_message,
        "parameters": {
            "max_new_tokens": max_tokens,
        }
    }

    print("=" * 70)
    print(f"CALLING ARCH-ROUTER MODEL")
    print("=" * 70)
    print(f"\nModel: {model_id}")
    print(f"User Message: {user_message}")
    print(f"Max Tokens: {max_tokens}")
    print(f"\nSending request to HuggingFace Inference API...")
    print("-" * 70)

    try:
        response = httpx.post(api_url, json=payload, headers=headers, timeout=120.0)

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()

            print("\nMODEL RESPONSE:")
            print("-" * 70)

            if isinstance(result, list) and len(result) > 0:
                output = result[0]
                if "generated_text" in output:
                    print(output["generated_text"])
                else:
                    print(json.dumps(result, indent=2))
            else:
                print(json.dumps(result, indent=2))

            print("\n" + "=" * 70)
            print("SUCCESS: Response received from Arch-Router")
            print("=" * 70)

            return result

        elif response.status_code == 503:
            print("\nINFO: Model is loading (cold start)")
            print("The model may take a minute to load. Try again in a moment.")
            print(f"\nServer Response: {response.text}")
            return None

        else:
            print(f"\nERROR: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except httpx.TimeoutException:
        print("\nERROR: Request timed out (model may be loading)")
        print("Try again in a moment - HF models can take time to start up")
        return None

    except Exception as e:
        print(f"\nERROR: {type(e).__name__}: {e}")
        return None

if __name__ == "__main__":
    # Example usage

    # Get message from command line or use default
    if len(sys.argv) > 1:
        user_message = " ".join(sys.argv[1:])
    else:
        user_message = "What is the capital of France?"

    result = call_arch_router(user_message)

    sys.exit(0 if result else 1)
