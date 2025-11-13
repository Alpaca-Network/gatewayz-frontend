#!/usr/bin/env python3
"""
Demo script showing Cerebras models working with a simple test
"""

import os
from cerebras.cloud.sdk import Cerebras

# Initialize Cerebras client
api_key = os.getenv("CEREBRAS_API_KEY")
if not api_key:
    print("Error: CEREBRAS_API_KEY environment variable not set")
    exit(1)
client = Cerebras(api_key=api_key)

print("=" * 80)
print("🧪 CEREBRAS MODELS VERIFICATION - LIVE TEST")
print("=" * 80)

# List available models
print("\n1️⃣  Fetching available models...")
models_response = client.models.list()

# Handle the response - it might be a SyncPage or similar object
if hasattr(models_response, 'data'):
    models = list(models_response.data)
else:
    models = list(models_response)

print(f"✅ Found {len(models)} Cerebras models\n")

print("Available models:")
for i, model in enumerate(models, 1):
    # Handle different model object structures
    if hasattr(model, 'id'):
        model_id = model.id
    elif isinstance(model, dict):
        model_id = model.get('id', 'unknown')
    else:
        model_id = str(model)
    print(f"  {i}. {model_id}")

# Test with a simple prompt using the fastest model (llama3.1-8b)
test_model = "llama3.1-8b"
print(f"\n2️⃣  Testing inference with model: {test_model}")
print("-" * 80)

response = client.chat.completions.create(
    model=test_model,
    messages=[
        {"role": "user", "content": "Write a haiku about AI running on specialized hardware"}
    ],
    max_tokens=100,
    temperature=0.7
)

# Display results
print(f"\n✨ Response from Cerebras ({test_model}):\n")
print("─" * 80)
print(response.choices[0].message.content)
print("─" * 80)

# Show token usage
if response.usage:
    print(f"\n📊 Token Usage:")
    print(f"   • Prompt: {response.usage.prompt_tokens} tokens")
    print(f"   • Completion: {response.usage.completion_tokens} tokens")
    print(f"   • Total: {response.usage.total_tokens} tokens")

print("\n" + "=" * 80)
print("✅ VERIFICATION COMPLETE - Cerebras models are working!")
print("=" * 80 + "\n")
