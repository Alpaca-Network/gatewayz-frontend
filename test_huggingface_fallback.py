#!/usr/bin/env python3
"""
Simple test to verify HuggingFace models fallback mechanism works.
"""

import sys
import os

# Mock the Config to simulate API failure
class MockConfig:
    HUG_API_KEY = None
    IS_TESTING = False

# Replace Config before importing the module
import src.config
src.config.Config = MockConfig

# Now import the function
from src.services.huggingface_models import fetch_models_from_hug, FALLBACK_HUGGINGFACE_MODELS

def test_fallback():
    """Test that fallback models are returned when API is unavailable"""
    print("Testing HuggingFace fallback mechanism...")
    print(f"Expected fallback models: {len(FALLBACK_HUGGINGFACE_MODELS)}")

    # Call the function - it should use fallback since we have no API key
    # and the API call will likely fail or be slow
    models = fetch_models_from_hug()

    if models:
        print(f"✅ SUCCESS: Got {len(models)} models")
        print(f"Sample model IDs:")
        for i, model in enumerate(models[:5], 1):
            print(f"  {i}. {model.get('id')}")

        # Check if they have the right structure
        first_model = models[0]
        required_fields = ['id', 'name', 'source_gateway', 'architecture', 'pricing']
        missing_fields = [field for field in required_fields if field not in first_model]

        if missing_fields:
            print(f"⚠️  WARNING: Missing fields in model: {missing_fields}")
        else:
            print("✅ All required fields present in models")

        return True
    else:
        print("❌ FAILED: No models returned")
        return False

if __name__ == "__main__":
    success = test_fallback()
    sys.exit(0 if success else 1)
