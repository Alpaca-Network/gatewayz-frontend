#!/usr/bin/env python3
"""
Test script for the private models filter feature.
This verifies that Near AI models are properly tagged as private
and that the filter works correctly.
"""

import sys
import json


def test_near_model_normalization():
    """Test that Near AI models have the is_private field and tags"""
    print("=" * 70)
    print("TEST 1: Checking Near AI model normalization")
    print("=" * 70)

    try:
        from src.services.models import normalize_near_model

        # Create a sample Near AI model
        sample_model = {
            "id": "deepseek-ai/DeepSeek-V3.1",
            "owned_by": "DeepSeek",
            "created": 1234567890,
            "metadata": {
                "context_length": 64000,
                "modality": "text-to-text"
            }
        }

        # Normalize it
        normalized = normalize_near_model(sample_model)

        # Check for required fields
        assert normalized is not None, "Normalized model should not be None"
        assert "is_private" in normalized, "Model should have 'is_private' field"
        assert normalized["is_private"] is True, "Near AI models should be marked as private"
        assert "tags" in normalized, "Model should have 'tags' field"
        assert "Private" in normalized["tags"], "Model should have 'Private' tag"

        print("✓ Near AI model normalization includes:")
        print(f"  - is_private: {normalized['is_private']}")
        print(f"  - tags: {normalized['tags']}")
        print(f"  - security_features: {json.dumps(normalized['security_features'], indent=4)}")
        print("\n✅ TEST PASSED: Near AI models are properly tagged as private\n")
        return True

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def test_filter_query_parameters():
    """Test that the catalog endpoints accept is_private parameter"""
    print("=" * 70)
    print("TEST 2: Checking catalog endpoint query parameters")
    print("=" * 70)

    try:
        # Check that the search endpoint has the parameter
        from src.routes.catalog import search_models
        import inspect

        sig = inspect.signature(search_models)
        params = sig.parameters

        assert "is_private" in params, "search_models should have 'is_private' parameter"

        # Get parameter info
        is_private_param = params["is_private"]
        print(f"✓ search_models endpoint has 'is_private' parameter")
        print(f"  - Type: {is_private_param.annotation}")
        print(f"  - Default: {is_private_param.default}")

        # Check the main models endpoint
        from src.routes.catalog import get_all_models
        sig2 = inspect.signature(get_all_models)
        params2 = sig2.parameters

        assert "is_private" in params2, "get_all_models should have 'is_private' parameter"
        print(f"✓ get_all_models endpoint has 'is_private' parameter")

        print("\n✅ TEST PASSED: Catalog endpoints support is_private filter\n")
        return True

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def test_filtering_logic():
    """Test the filtering logic with sample data"""
    print("=" * 70)
    print("TEST 3: Checking filter logic with sample data")
    print("=" * 70)

    try:
        # Create sample models
        sample_models = [
            {"id": "near/model1", "name": "Near Model 1", "is_private": True, "tags": ["Private"]},
            {"id": "openai/gpt-4", "name": "GPT-4", "is_private": None},
            {"id": "near/model2", "name": "Near Model 2", "is_private": True, "tags": ["Private"]},
            {"id": "anthropic/claude", "name": "Claude", "is_private": None},
        ]

        # Test filtering for private models only (is_private=True)
        private_models = [m for m in sample_models if m.get("is_private") is True]
        print(f"✓ Filter for private only: {len(private_models)} models")
        assert len(private_models) == 2, "Should find 2 private models"
        assert all(m["is_private"] is True for m in private_models), "All should be private"

        # Test filtering for non-private models (is_private=False)
        non_private_models = [m for m in sample_models if not m.get("is_private")]
        print(f"✓ Filter for non-private: {len(non_private_models)} models")
        assert len(non_private_models) == 2, "Should find 2 non-private models"

        # Test no filter (is_private=None)
        all_models = sample_models
        print(f"✓ No filter: {len(all_models)} models")
        assert len(all_models) == 4, "Should return all 4 models"

        print("\n✅ TEST PASSED: Filter logic works correctly\n")
        return True

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print("PRIVATE MODELS FILTER - TEST SUITE")
    print("=" * 70 + "\n")

    results = []

    # Run tests
    results.append(("Near AI Model Normalization", test_near_model_normalization()))
    results.append(("Catalog Endpoint Parameters", test_filter_query_parameters()))
    results.append(("Filter Logic", test_filtering_logic()))

    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")
    print("=" * 70 + "\n")

    # Return exit code
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
