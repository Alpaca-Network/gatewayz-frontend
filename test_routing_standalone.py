#!/usr/bin/env python3
"""
Standalone test script for routing refactor

This script tests the new routing logic without requiring full test infrastructure.
Run with: python test_routing_standalone.py
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

def test_provider_selector_import():
    """Test that ProviderSelector can be imported"""
    try:
        from src.services.provider_selector import ProviderSelector, get_selector
        print("✓ ProviderSelector imported successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to import ProviderSelector: {e}")
        return False


def test_multi_provider_registry_import():
    """Test that MultiProviderRegistry can be imported"""
    try:
        from src.services.multi_provider_registry import (
            MultiProviderModel,
            ProviderConfig,
            get_registry,
        )
        print("✓ MultiProviderRegistry imported successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to import MultiProviderRegistry: {e}")
        return False


def test_selector_initialization():
    """Test that selector initializes correctly"""
    try:
        from src.services.provider_selector import get_selector

        selector = get_selector()
        assert selector is not None
        assert hasattr(selector, 'registry')
        assert hasattr(selector, 'health_tracker')

        print("✓ ProviderSelector initialized successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to initialize ProviderSelector: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_registry_has_models():
    """Test that registry has models loaded"""
    try:
        from src.services.multi_provider_registry import get_registry

        registry = get_registry()
        models = registry.get_all_models()

        print(f"✓ Registry has {len(models)} models loaded")

        if models:
            # Show first few models
            sample_models = models[:5] if isinstance(models, list) else list(models.values())[:5]
            print(f"  Sample models: {[m.id for m in sample_models]}")

        return True
    except Exception as e:
        print(f"✗ Failed to get models from registry: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_get_model():
    """Test retrieving a specific model"""
    try:
        from src.services.multi_provider_registry import get_registry

        registry = get_registry()

        # Try common models
        test_models = ["gpt-4", "claude-3-opus", "gemini-2.0-flash"]

        for model_id in test_models:
            model = registry.get_model(model_id)
            if model:
                providers = [p.name for p in model.providers]
                print(f"✓ Model '{model_id}' found with providers: {providers}")
                return True

        print("✗ None of the test models were found in registry")
        return False

    except Exception as e:
        print(f"✗ Failed to get model: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_provider_selection():
    """Test selecting a provider for a model"""
    try:
        from src.services.multi_provider_registry import get_registry

        registry = get_registry()
        models = registry.get_all_models()

        if not models:
            print("✗ No models in registry to test provider selection")
            return False

        # Get first model
        first_model = models[0] if isinstance(models, list) else list(models.values())[0]

        provider = registry.select_provider(first_model.id)

        if provider:
            print(f"✓ Provider selection works: selected '{provider.name}' for '{first_model.id}'")
            print(f"  Provider config: model_id={provider.model_id}, priority={provider.priority}")
            return True
        else:
            print(f"✗ No provider selected for model '{first_model.id}'")
            return False

    except Exception as e:
        print(f"✗ Failed provider selection: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_health_tracker():
    """Test health tracker functionality"""
    try:
        from src.services.provider_selector import get_selector

        selector = get_selector()
        tracker = selector.health_tracker

        # Test recording success
        tracker.record_success("test-model", "test-provider")

        # Test availability check
        is_available = tracker.is_available("test-model", "test-provider")

        assert is_available is True

        print("✓ Health tracker works correctly")
        return True

    except Exception as e:
        print(f"✗ Health tracker failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_execute_with_failover():
    """Test execute_with_failover method"""
    try:
        from src.services.provider_selector import get_selector
        from src.services.multi_provider_registry import get_registry

        selector = get_selector()
        registry = get_registry()

        # Find a model with multiple providers
        models = registry.get_all_models()
        multi_provider_model = None

        model_list = models if isinstance(models, list) else list(models.values())
        for model in model_list:
            if len(model.providers) > 1:
                multi_provider_model = model
                break

        if not multi_provider_model:
            print("⚠ No multi-provider models found, skipping failover test")
            return True

        # Test with a mock execution function
        def mock_execute(provider_name, model_id):
            return {"success": True, "provider": provider_name, "model": model_id}

        result = selector.execute_with_failover(
            model_id=multi_provider_model.id,
            execute_fn=mock_execute,
        )

        if result.get("success"):
            print(f"✓ Execute with failover works for '{multi_provider_model.id}'")
            print(f"  Used provider: {result.get('provider')}")
            return True
        else:
            print(f"✗ Execute with failover failed: {result.get('error')}")
            return False

    except Exception as e:
        print(f"✗ Execute with failover failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_model_transformation():
    """Test model ID transformation"""
    try:
        from src.services.model_transformations import detect_provider_from_model_id

        test_cases = [
            ("google/gemini-2.0-flash-001", "Should detect provider"),
            ("gpt-4", "No specific provider"),
            ("openai/gpt-4", "Should detect provider"),
        ]

        for model_id, description in test_cases:
            provider = detect_provider_from_model_id(model_id)
            print(f"  Model '{model_id}': provider='{provider}' ({description})")

        print("✓ Model transformation works")
        return True

    except Exception as e:
        print(f"✗ Model transformation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("=" * 70)
    print("ROUTING REFACTOR TEST SUITE")
    print("=" * 70)
    print()

    tests = [
        ("Import ProviderSelector", test_provider_selector_import),
        ("Import MultiProviderRegistry", test_multi_provider_registry_import),
        ("Initialize Selector", test_selector_initialization),
        ("Registry Has Models", test_registry_has_models),
        ("Get Model", test_get_model),
        ("Provider Selection", test_provider_selection),
        ("Health Tracker", test_health_tracker),
        ("Execute With Failover", test_execute_with_failover),
        ("Model Transformation", test_model_transformation),
    ]

    results = []

    for name, test_func in tests:
        print(f"\nTest: {name}")
        print("-" * 70)
        result = test_func()
        results.append((name, result))
        print()

    # Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")

    print()
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 70)

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
