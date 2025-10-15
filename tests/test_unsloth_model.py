#!/usr/bin/env python3
"""Test Unsloth Llama-3-8B model via Featherless"""

import sys
sys.path.insert(0, '/Users/vaughn/Documents/GitHub/gatewayz-backend')

from src.services.featherless_client import make_featherless_request_openai
from src.config import Config

def test_unsloth_model():
    """Test if the Unsloth model works on Featherless"""
    print("Testing Unsloth/Llama-3-8B-Instruct on Featherless...")
    print("-" * 60)

    # Check API key
    if not Config.FEATHERLESS_API_KEY:
        print("❌ FEATHERLESS_API_KEY not set!")
        return False

    print(f"✓ Featherless API key configured")
    print()

    # Test the model
    model_variants = [
        "unsloth/llama-3-8b-Instruct",
        "unsloth/Meta-Llama-3.1-8B-Instruct",
        "unsloth/Llama-3.1-8B-Instruct"
    ]

    for model_id in model_variants:
        print(f"Testing model: {model_id}")
        try:
            messages = [
                {"role": "user", "content": "Say 'Hello, I am working!' in one sentence."}
            ]

            response = make_featherless_request_openai(
                messages=messages,
                model=model_id,
                max_tokens=50,
                temperature=0.7
            )

            if response and hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content
                print(f"  ✓ SUCCESS!")
                print(f"  Response: {content}")
                print()
                return True
            else:
                print(f"  ⚠️  No response content")
                print()

        except Exception as e:
            error_msg = str(e)
            print(f"  ❌ ERROR: {error_msg}")

            # Check if it's a model not found error
            if "not found" in error_msg.lower() or "404" in error_msg:
                print(f"  → Model '{model_id}' not found on Featherless")
            elif "401" in error_msg or "403" in error_msg:
                print(f"  → Authentication error")
            else:
                print(f"  → Unexpected error")
            print()

    print("=" * 60)
    print("All test variants failed")
    return False

if __name__ == "__main__":
    success = test_unsloth_model()
    sys.exit(0 if success else 1)
