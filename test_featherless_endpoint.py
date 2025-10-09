#!/usr/bin/env python3
"""Test Featherless endpoint to debug the issue"""

import sys
sys.path.insert(0, '/Users/vaughn/Documents/GitHub/gatewayz-backend')

from src.services.models import get_cached_models
from src.config import Config

def test_featherless():
    """Test Featherless models loading"""
    print("Testing Featherless integration...")
    print("-" * 60)

    # Check API key
    print(f"FEATHERLESS_API_KEY: {'SET' if Config.FEATHERLESS_API_KEY else 'NOT SET'}")
    if Config.FEATHERLESS_API_KEY:
        print(f"  Key prefix: {Config.FEATHERLESS_API_KEY[:10]}...")
    print()

    # Try to load models
    print("Attempting to load Featherless models...")
    featherless_models = get_cached_models("featherless")

    if not featherless_models:
        print("❌ ERROR: No Featherless models loaded!")
        print("\nPossible issues:")
        print("1. FEATHERLESS_API_KEY not set in environment")
        print("2. API request failed")
        print("3. API returned empty response")
        return False

    print(f"✓ Successfully loaded {len(featherless_models)} Featherless models")
    print()

    # Show first 3 models
    print("First 3 Featherless models:")
    for i, model in enumerate(featherless_models[:3], 1):
        model_id = model.get('id', 'Unknown')
        provider = model.get('provider_slug', 'Unknown')
        source = model.get('source_gateway', 'Unknown')

        print(f"{i}. {model_id}")
        print(f"   Provider: {provider}")
        print(f"   Source: {source}")
        print()

    print("=" * 60)
    print(f"✓ Featherless test PASSED - {len(featherless_models)} models available")
    return True

if __name__ == "__main__":
    success = test_featherless()
    sys.exit(0 if success else 1)
