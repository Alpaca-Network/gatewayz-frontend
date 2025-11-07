"""
Test Multi-Provider Integration

This test verifies that the multi-provider support is working correctly in gatewayz.
"""

import os
import sys

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.multi_provider_registry import get_registry
from src.services.provider_selector import get_selector
from src.services.model_transformations import detect_provider_from_model_id, transform_model_id
from src.services.google_models_config import initialize_google_models

print("=" * 80)
print("Multi-Provider Integration Test")
print("=" * 80)

# Initialize Google models first
print("\n[SETUP] Initializing Google models...")
initialize_google_models()
print("  ✓ Google models initialized")

# Test 1: Check if Google models are in the registry
print("\n[TEST 1] Checking if Google models are registered...")
registry = get_registry()

test_models = [
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemma-2-9b-it",
]

for model_id in test_models:
    model = registry.get_model(model_id)
    if model:
        providers = [p.name for p in model.providers]
        print(f"  ✅ {model_id}: {len(model.providers)} providers - {providers}")
    else:
        print(f"  ❌ {model_id}: NOT FOUND in registry")

# Test 2: Check provider detection
print("\n[TEST 2] Testing provider detection...")
for model_id in test_models:
    detected_provider = detect_provider_from_model_id(model_id)
    print(f"  {model_id} -> {detected_provider}")

# Test 3: Check model ID transformation
print("\n[TEST 3] Testing model ID transformation...")
for model_id in test_models:
    # Get the model from registry
    model = registry.get_model(model_id)
    if model:
        for provider_config in model.providers:
            transformed = transform_model_id(model_id, provider_config.name)
            print(f"  {model_id} + {provider_config.name} -> {transformed}")
            print(f"    Expected: {provider_config.model_id.lower()}")
            if transformed == provider_config.model_id.lower():
                print(f"    ✅ Match!")
            else:
                print(f"    ⚠️  Mismatch")

# Test 4: Check provider priorities
print("\n[TEST 4] Checking provider priorities...")
for model_id in test_models:
    model = registry.get_model(model_id)
    if model:
        print(f"\n  {model_id}:")
        primary = model.get_primary_provider()
        if primary:
            print(f"    Primary: {primary.name} (priority {primary.priority})")

        print(f"    All providers (in priority order):")
        for provider in model.providers:
            status = "✓" if provider.enabled else "✗"
            print(f"      [{status}] {provider.name} - priority {provider.priority}")
            print(f"          Model ID: {provider.model_id}")
            print(f"          Cost: ${provider.cost_per_1k_input}/1k input, ${provider.cost_per_1k_output}/1k output")
            print(f"          Features: {', '.join(provider.features)}")

# Test 5: Test provider selector
print("\n[TEST 5] Testing ProviderSelector...")
selector = get_selector()

for model_id in test_models[:2]:  # Test first 2 models
    print(f"\n  Testing {model_id}:")

    # Get available providers
    providers = selector.get_model_providers(model_id)
    if providers:
        print(f"    Available providers: {providers}")
    else:
        print(f"    ⚠️  No providers available")
        continue

    # Check health of each provider
    for provider_name in providers:
        health = selector.check_provider_health(model_id, provider_name)
        status = "✅" if health["available"] else "❌"
        print(f"      {status} {provider_name}: {health['reason']}")

# Test 6: Test fallback provider selection
print("\n[TEST 6] Testing fallback provider selection...")
for model_id in test_models[:2]:
    model = registry.get_model(model_id)
    if model:
        primary = model.get_primary_provider()
        if primary:
            print(f"\n  {model_id}:")
            print(f"    Primary: {primary.name}")

            # Get fallbacks excluding primary
            fallbacks = registry.get_fallback_providers(model_id, exclude_provider=primary.name)
            if fallbacks:
                print(f"    Fallbacks (in order):")
                for i, fallback in enumerate(fallbacks, 1):
                    print(f"      {i}. {fallback.name} (priority {fallback.priority})")
            else:
                print(f"    No fallback providers")

print("\n" + "=" * 80)
print("Test completed!")
print("=" * 80)
