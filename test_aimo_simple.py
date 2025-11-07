#!/usr/bin/env python3
"""Simple test to check AIMO model fetching and normalization"""
import os
import sys
import httpx
import json

# Set API key
os.environ["AIMO_API_KEY"] = "aimo-sk-dev-2zpjTUg1bwBvnLEGuw14H7YgYirodkpi1VLf8KV2PA1eEAzNfcaRtsadQkVYQkbdEkWrmpcGXY4DFPr1ABuJArLFPAySbUrFBs899G7dGZqhHzLvr48oh2Yfk4ynsz3RtvN1xFE1NXs3SxFmNFDfGPmAzb66n4eJ37FFwvaXb8DwHPjiY"

print("=" * 60)
print("Test: AIMO Model Fetching and Normalization")
print("=" * 60)

# Test 1: Fetch raw models
print("\n1. Fetching models from AIMO API...")
try:
    headers = {
        "Authorization": f"Bearer {os.environ['AIMO_API_KEY']}",
        "Content-Type": "application/json",
    }

    response = httpx.get(
        "https://devnet.aimo.network/api/v1/models",
        headers=headers,
        timeout=20.0,
    )
    response.raise_for_status()

    payload = response.json()
    raw_models = payload.get("data", [])
    print(f"✓ Fetched {len(raw_models)} models from AIMO API")

    # Show first model structure
    if raw_models:
        print(f"\nFirst model structure:")
        print(json.dumps(raw_models[0], indent=2))

except Exception as e:
    print(f"✗ Failed to fetch models: {e}")
    sys.exit(1)

# Test 2: Test normalization logic
print("\n2. Testing model normalization...")
try:
    from src.services.models import normalize_aimo_model

    normalized_models = []
    for model in raw_models[:10]:  # Test first 10
        normalized = normalize_aimo_model(model)
        if normalized:
            normalized_models.append(normalized)

    print(f"✓ Successfully normalized {len(normalized_models)}/{10} models")

    if normalized_models:
        print(f"\nFirst normalized model:")
        print(json.dumps({
            "id": normalized_models[0].get("id"),
            "name": normalized_models[0].get("name"),
            "provider_slug": normalized_models[0].get("provider_slug"),
            "source_gateway": normalized_models[0].get("source_gateway"),
            "pricing": normalized_models[0].get("pricing"),
        }, indent=2))
    else:
        print("⚠ No models were normalized!")

except Exception as e:
    print(f"✗ Normalization failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: Test full fetch_models_from_aimo
print("\n3. Testing fetch_models_from_aimo()...")
try:
    from src.services.models import fetch_models_from_aimo

    models = fetch_models_from_aimo()
    print(f"✓ fetch_models_from_aimo() returned {len(models) if models else 0} models")

    if models:
        print(f"\nSample model IDs:")
        for i, model in enumerate(models[:5], 1):
            print(f"  {i}. {model.get('id')}")
    else:
        print("⚠ No models returned from fetch_models_from_aimo()")

except Exception as e:
    print(f"✗ fetch_models_from_aimo() failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)
