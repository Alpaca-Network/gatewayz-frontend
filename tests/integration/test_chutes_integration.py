#!/usr/bin/env python3
"""Test script to verify Chutes.ai integration"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from src.services.models import get_cached_models

def test_chutes_models():
    """Test loading Chutes models from the catalog"""
    print("Testing Chutes.ai model integration...")
    print("-" * 60)

    # Test loading Chutes models
    chutes_models = get_cached_models("chutes")

    if not chutes_models:
        print("❌ ERROR: No Chutes models loaded!")
        return False

    print(f"✓ Successfully loaded {len(chutes_models)} Chutes models")
    print()

    # Show first 5 models
    print("First 5 Chutes models:")
    for i, model in enumerate(chutes_models[:5], 1):
        model_id = model.get('id', 'Unknown')
        model_type = model.get('model_type', 'Unknown')
        provider = model.get('provider_slug', 'Unknown')
        pricing = model.get('pricing', {}).get('hourly_rate', 'N/A')

        print(f"{i}. {model_id}")
        print(f"   Provider: {provider}")
        print(f"   Type: {model_type}")
        print(f"   Pricing: ${pricing}/hr")
        print()

    # Test statistics
    model_types = {}
    for model in chutes_models:
        model_type = model.get('model_type', 'Unknown')
        model_types[model_type] = model_types.get(model_type, 0) + 1

    print("\nModel types breakdown:")
    for model_type, count in sorted(model_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {model_type}: {count}")

    print("\n" + "=" * 60)
    print("✓ Chutes.ai integration test PASSED!")
    return True

if __name__ == "__main__":
    success = test_chutes_models()
    sys.exit(0 if success else 1)
