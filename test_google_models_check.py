#!/usr/bin/env python3
"""
Quick Check: Google Models Configuration

This script verifies that all Google models are properly configured
in the multi-provider system WITHOUT making live API calls.
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from src.services.multi_provider_registry import get_registry
from src.services.google_models_config import initialize_google_models

print("=" * 80)
print("Google Models Configuration Check")
print("=" * 80)

# Initialize
print("\n[1] Initializing multi-provider system...")
initialize_google_models()
print("  ✅ Done")

# Get all models
print("\n[2] Checking registered Google models...")
registry = get_registry()
all_models = registry.get_all_models()
google_models = [m for m in all_models if m.id.startswith(("gemini-", "gemma-"))]

print(f"  ✅ Found {len(google_models)} Google models")

# Check each model
print("\n[3] Verifying model configurations...")
print("-" * 80)

all_good = True

for i, model in enumerate(google_models, 1):
    print(f"\n{i}. {model.name} ({model.id})")

    # Check providers
    providers = model.get_enabled_providers()
    if len(providers) == 0:
        print(f"   ❌ ERROR: No providers enabled!")
        all_good = False
        continue

    print(f"   ✅ {len(providers)} provider(s) configured:")

    for provider in providers:
        print(f"      • {provider.name} (priority {provider.priority})")
        print(f"        Model ID: {provider.model_id}")
        print(f"        Cost: ${provider.cost_per_1k_input}/1k in, ${provider.cost_per_1k_output}/1k out")
        print(f"        Features: {', '.join(provider.features)}")

    # Check primary provider
    primary = model.get_primary_provider()
    if primary:
        if primary.name == "google-vertex":
            print(f"   ✅ Primary provider: google-vertex (correct!)")
        else:
            print(f"   ⚠️  Primary provider: {primary.name} (expected google-vertex)")
    else:
        print(f"   ❌ ERROR: No primary provider!")
        all_good = False

    # Check fallback
    fallbacks = [p for p in providers if p != primary]
    if fallbacks:
        print(f"   ✅ Fallback(s): {', '.join(f.name for f in fallbacks)}")
    else:
        print(f"   ⚠️  No fallback providers (single provider only)")

# Summary
print("\n" + "=" * 80)
print("Summary")
print("=" * 80)

print(f"\nTotal Google Models: {len(google_models)}")
print(f"Status: {'✅ ALL CONFIGURED CORRECTLY' if all_good else '❌ SOME ISSUES FOUND'}")

print("\n" + "=" * 80)
print("Next Steps")
print("=" * 80)

print("\nTo test if models actually work with live API calls, run:")
print("  python3 test_google_models_live.py")

print("\nNote: That test will try Vertex AI first, then fallback to OpenRouter")
print("=" * 80)
