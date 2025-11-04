#!/usr/bin/env python3
"""
Test script to verify Cerebras model fetching is working correctly
"""
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import after path is set
from src.cache import _cerebras_models_cache
from utils import print_section

def test_cerebras_models():
    """Test that Cerebras models are properly formatted"""
    print_section("Testing Cerebras Models", 60)

    # Clear cache to force fresh fetch
    _cerebras_models_cache["data"] = None
    _cerebras_models_cache["timestamp"] = None
    print("✓ Cleared Cerebras cache")

    # Import after cache is cleared
    from src.services.models import get_cached_models

    # Fetch models
    print("\nFetching models from Cerebras...")
    models = get_cached_models("cerebras")

    if not models:
        print("✗ FAILED: No models returned")
        return False

    print(f"✓ Fetched {len(models)} models")

    # Check first model structure
    if len(models) > 0:
        first_model = models[0]
        print(f"\nFirst model:")
        print(f"  ID: {first_model.get('id', 'MISSING')}")
        print(f"  Name: {first_model.get('name', 'MISSING')}")
        print(f"  Slug: {first_model.get('slug', 'MISSING')}")

        # Validate ID format
        model_id = first_model.get('id', '')
        if model_id.startswith('@cerebras/') and 'Data(' not in model_id and '(' not in model_id:
            print(f"✓ Model ID format is correct")
        else:
            print(f"✗ FAILED: Model ID format is incorrect: {model_id}")
            return False

        # Check for malformed data
        if 'Data(' in str(first_model) or "('data'" in str(first_model):
            print(f"✗ FAILED: Model contains malformed data (Python object repr)")
            print(f"Full model: {first_model}")
            return False

        print(f"✓ Model data is properly formatted")

    # Check all models
    print(f"\nAll models:")
    for i, model in enumerate(models[:5]):  # Show first 5
        print(f"  {i+1}. {model.get('id', 'N/A')}")

    if len(models) > 5:
        print(f"  ... and {len(models) - 5} more")

    print(f"\n✓ SUCCESS: All tests passed!")
    return True

if __name__ == "__main__":
    success = test_cerebras_models()
    sys.exit(0 if success else 1)
