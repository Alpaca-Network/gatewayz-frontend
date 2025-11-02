#!/usr/bin/env python3
"""
Test script for AIMO Network integration
"""
import os
import sys

# Manually load .env file if dotenv not available
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# Test 1: Check API key is loaded
print("=" * 60)
print("Test 1: API Key Configuration")
print("=" * 60)
api_key = os.environ.get("AIMO_API_KEY")
if api_key:
    masked_key = f"...{api_key[-20:]}" if len(api_key) >= 20 else "****"
    print(f"✓ AIMO_API_KEY is set: {masked_key}")
else:
    print("✗ AIMO_API_KEY is not set")
    sys.exit(1)

# Test 2: Import AIMO client
print("\n" + "=" * 60)
print("Test 2: AIMO Client Import")
print("=" * 60)
try:
    from src.services.aimo_client import get_aimo_client, make_aimo_request_openai
    print("✓ Successfully imported AIMO client functions")
except ImportError as e:
    print(f"✗ Failed to import AIMO client: {e}")
    sys.exit(1)

# Test 3: Initialize AIMO client
print("\n" + "=" * 60)
print("Test 3: AIMO Client Initialization")
print("=" * 60)
try:
    client = get_aimo_client()
    print(f"✓ Successfully initialized AIMO client")
    print(f"  Base URL: {client.base_url}")
except Exception as e:
    print(f"✗ Failed to initialize AIMO client: {e}")
    sys.exit(1)

# Test 4: Fetch available models
print("\n" + "=" * 60)
print("Test 4: Fetch AIMO Models")
print("=" * 60)
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
    sys.exit(1)

# Test 5: Test model caching
print("\n" + "=" * 60)
print("Test 5: Model Caching")
print("=" * 60)
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
print("\n" + "=" * 60)
print("Test 6: Simple Chat Completion")
print("=" * 60)

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

print("\n" + "=" * 60)
print("AIMO Integration Test Complete")
print("=" * 60)
