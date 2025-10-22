#!/usr/bin/env python
"""Debug Fireworks integration issue"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.fireworks_client import make_fireworks_request_openai, process_fireworks_response
from src.services.models import get_cached_models
from dotenv import load_dotenv

load_dotenv()

def test_fireworks_integration():
    """Test the exact flow used in the backend"""

    model = "accounts/fireworks/models/deepseek-v3p1"
    messages = [{"role": "user", "content": "Hello! What can you help me with?"}]

    print(f"Testing model: {model}")
    print("-" * 50)

    # Test 1: Check if model is in cache
    print("\n1. Checking Fireworks models cache...")
    fireworks_models = get_cached_models("fireworks") or []
    print(f"   Found {len(fireworks_models)} Fireworks models in cache")

    model_found = any(m.get("id") == model for m in fireworks_models)
    print(f"   Model '{model}' found in cache: {model_found}")

    if model_found:
        print("   [OK] Model detection should work")
    else:
        print("   [FAIL] Model detection will fail - will default to OpenRouter")

    # Test 2: Direct Fireworks API call
    print("\n2. Testing direct Fireworks API call...")
    try:
        response = make_fireworks_request_openai(messages, model)
        print("   [OK] API call successful")
        print(f"   Response: {response.choices[0].message.content[:50]}...")

        # Test 3: Response processing
        print("\n3. Testing response processing...")
        processed = process_fireworks_response(response)
        print("   [OK] Response processed successfully")
        print(f"   Processed keys: {list(processed.keys())}")
        print(f"   Usage: {processed.get('usage')}")

    except Exception as e:
        print(f"   [FAIL] API call failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_fireworks_integration()