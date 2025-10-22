"""Test Arch-Router via HuggingFace Router API (not Inference API)"""
import os
import pytest
from dotenv import load_dotenv
load_dotenv(override=True)

from openai import OpenAI

print("=" * 70)
print("ARCH-ROUTER TEST - HUGGINGFACE ROUTER API")
print("=" * 70)

hf_api_key = os.getenv("HUG_API_KEY")

if not hf_api_key:
    print("[ERROR] HUG_API_KEY not set in .env")
    pytest.skip("HUG_API_KEY not set in environment", allow_module_level=True)

# Test with HuggingFace Router endpoint (OpenAI-compatible)
print("\nTesting Arch-Router via HuggingFace Router...")
print(f"Model: katanemo/Arch-Router-1.5B:hf-inference")
print("-" * 70)

try:
    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=hf_api_key
    )

    response = client.chat.completions.create(
        model="katanemo/Arch-Router-1.5B:hf-inference",
        messages=[
            {"role": "user", "content": "What is the capital of France?"}
        ],
        max_tokens=100
    )

    print("[SUCCESS] Response received!")
    print(f"Content: {response.choices[0].message.content}")
    print(f"Model: {response.model}")

except Exception as e:
    print(f"[ERROR] {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
