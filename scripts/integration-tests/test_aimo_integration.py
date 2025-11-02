#!/usr/bin/env python3
"""
Test script for AIMO Network integration
"""
import os
import sys
import pytest
from utils import load_env_file, get_env_or_exit, print_section

load_env_file()

# Check if AIMO_API_KEY is set - if not, skip the whole module
api_key = os.environ.get("AIMO_API_KEY")
pytestmark = pytest.mark.skipif(
    not api_key,
    reason="AIMO_API_KEY environment variable not set"
)

# Test 1: Check API key is loaded
print_section("Test 1: API Key Configuration", 60)
api_key = get_env_or_exit("AIMO_API_KEY", "API key for AIMO Network")
masked_key = f"...{api_key[-20:]}" if len(api_key) >= 20 else "****"
print(f"✓ AIMO_API_KEY is set: {masked_key}")

# Test 2: Import AIMO client
print_section("Test 2: AIMO Client Import", 60)
try:
    from src.services.aimo_client import get_aimo_client, make_aimo_request_openai
    print("✓ Successfully imported AIMO client functions")
except ImportError as e:
    print(f"✗ Failed to import AIMO client: {e}")

# Test 3: Initialize AIMO client
print_section("Test 3: AIMO Client Initialization", 60)
try:
    client = get_aimo_client()
    print(f"✓ Successfully initialized AIMO client")
    print(f"  Base URL: {client.base_url}")
except Exception as e:
    print(f"✗ Failed to initialize AIMO client: {e}")

# Test 4: Fetch available models
print_section("Test 4: Fetch AIMO Models", 60)
try:
    from src.services.models import fetch_models_from_aimo
    models = fetch_models_from_aimo()
    if models:
        print(f"✓ Successfully fetched {len(models)} models from AIMO")
        print("\nFirst 5 models:")
        for i, model in enumerate(models[:5], 1):
            model_id = model.get('id', 'N/A')
            model_name = model.get('name', 'N/A')
            print(f"  {i}. {model_id}")
            print(f"     Name: {model_name}")
    elif models == []:
        print("⚠ No models returned from AIMO (empty list)")
    else:
        print("✗ Failed to fetch models (None returned)")
except Exception as e:
    print(f"✗ Failed to fetch models: {e}")
    import traceback
    traceback.print_exc()

# Test 5: Test model caching
print_section("Test 5: Model Caching", 60)
try:
    from src.services.models import get_cached_models
    cached_models = get_cached_models("aimo")
    if cached_models:
        print(f"✓ Successfully retrieved {len(cached_models)} cached models")
    else:
        print("⚠ No cached models available")
except Exception as e:
    print(f"✗ Failed to retrieve cached models: {e}")

# Test 6: Simple chat completion test
print_section("Test 6: Simple Chat Completion", 60)

# First, let's get a model ID to use
if models and len(models) > 0:
    test_model = models[0].get('id')
    print(f"Testing with model: {test_model}")

    try:
        messages = [
            {"role": "user", "content": "Say 'Hello from AIMO!' and nothing else."}
        ]

        print("Sending test request...")
        response = make_aimo_request_openai(
            messages=messages,
            model=test_model,
            max_tokens=20,
            temperature=0.7
        )

        if response:
            print("✓ Successfully received response from AIMO")
            content = response.choices[0].message.content
            print(f"  Response: {content}")
        else:
            print("✗ No response received")
    except Exception as e:
        print(f"✗ Chat completion failed: {e}")
        import traceback
        traceback.print_exc()
else:
    print("⚠ Skipping chat test - no models available")

print_section("AIMO Integration Test Complete", 60)
