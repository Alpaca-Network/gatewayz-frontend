#!/usr/bin/env python3
"""Test HuggingFace :hf-inference suffix handling"""
import os
from dotenv import load_dotenv
load_dotenv(override=True)

import logging
logging.basicConfig(level=logging.INFO)

from src.services.huggingface_client import make_huggingface_request_openai

print("=" * 70)
print("TESTING HUGGINGFACE :hf-inference SUFFIX HANDLING")
print("=" * 70)

# Test with Arch-Router model (without suffix)
model_id = "katanemo/Arch-Router-1.5B"
messages = [{"role": "user", "content": "What is the capital of France?"}]

print(f"\nTesting model: {model_id}")
print(f"Input model ID: {model_id}")
print(f"Expected to be transformed to: {model_id}:hf-inference")
print("\nSending request...")

try:
    response = make_huggingface_request_openai(
        messages=messages,
        model=model_id,
        max_tokens=50
    )

    print("\n" + "=" * 70)
    print("SUCCESS! Response received:")
    print("=" * 70)
    print(f"Model: {response.model}")
    print(f"Response: {response.choices[0].message.content}")
    print("=" * 70)

except Exception as e:
    print("\n" + "=" * 70)
    print(f"ERROR: {e}")
    print("=" * 70)
    import traceback
    traceback.print_exc()
