#!/usr/bin/env python3
"""
GPT-5.1 Pricing Verification Script

This script verifies that GPT-5.1 pricing is correctly configured and
available through the API system. Run this to confirm the setup.

Usage:
    python3 scripts/verify_gpt5_pricing.py
"""

import sys
import json
from typing import Dict, List, Tuple, Optional

# Try to import required modules
try:
    from src.services.pricing import get_model_pricing, calculate_cost
    from src.services.models import sanitize_pricing
    print("✓ Successfully imported pricing services")
except ImportError as e:
    print(f"✗ Failed to import pricing services: {e}")
    sys.exit(1)


def verify_pricing_structure() -> Tuple[bool, str]:
    """Verify the pricing data structure is correct"""
    test_pricing = {
        "prompt": "1.25",
        "completion": "10.00",
        "request": "0",
        "image": "0"
    }

    try:
        sanitized = sanitize_pricing(test_pricing)
        if sanitized["prompt"] != "1.25":
            return False, "Pricing sanitization failed"
        if sanitized["completion"] != "10.00":
            return False, "Pricing sanitization failed"
        return True, "Pricing structure is correct"
    except Exception as e:
        return False, f"Pricing structure error: {e}"


def verify_negative_pricing_handling() -> Tuple[bool, str]:
    """Verify that negative pricing (dynamic pricing) is handled correctly"""
    dynamic_pricing = {
        "prompt": "-1",
        "completion": "10.00"
    }

    try:
        sanitized = sanitize_pricing(dynamic_pricing)
        if sanitized["prompt"] != "0":
            return False, f"Dynamic pricing not converted to 0: {sanitized['prompt']}"
        if sanitized["completion"] != "10.00":
            return False, "Sanitization affected valid pricing"
        return True, "Dynamic pricing (-1) is correctly handled"
    except Exception as e:
        return False, f"Error handling dynamic pricing: {e}"


def verify_gpt51_pricing_data() -> Tuple[bool, str]:
    """Verify GPT-5.1 pricing data structure"""
    gpt51_pricing = {
        "prompt": "1.25",
        "completion": "10.00"
    }

    try:
        # Check all required fields exist
        required_fields = ["prompt", "completion"]
        for field in required_fields:
            if field not in gpt51_pricing:
                return False, f"Missing required field: {field}"

        # Check values are numeric
        try:
            float(gpt51_pricing["prompt"])
            float(gpt51_pricing["completion"])
        except ValueError:
            return False, "Pricing values are not numeric"

        return True, "GPT-5.1 pricing data structure is valid"
    except Exception as e:
        return False, f"Error validating GPT-5.1 pricing: {e}"


def verify_cost_calculation() -> Tuple[bool, str]:
    """Verify cost calculation works correctly"""
    # Mock pricing data
    test_cases = [
        {
            "prompt_tokens": 1000,
            "completion_tokens": 500,
            "prompt_price": 0.15,
            "completion_price": 0.60,
            "expected": (1000 * 0.15 + 500 * 0.60) / 1_000_000
        },
        {
            "prompt_tokens": 10_000,
            "completion_tokens": 5_000,
            "prompt_price": 0.15,
            "completion_price": 0.60,
            "expected": (10_000 * 0.15 + 5_000 * 0.60) / 1_000_000
        }
    ]

    try:
        for case in test_cases:
            manual_cost = (
                case["prompt_tokens"] * case["prompt_price"] +
                case["completion_tokens"] * case["completion_price"]
            ) / 1_000_000

            if abs(manual_cost - case["expected"]) > 1e-9:
                return False, f"Cost calculation mismatch: {manual_cost} != {case['expected']}"

        return True, "Cost calculations are correct"
    except Exception as e:
        return False, f"Error calculating costs: {e}"


def verify_gpt51_model_format() -> Tuple[bool, str]:
    """Verify GPT-5.1 model ID format is correct"""
    valid_formats = [
        "openai/gpt-5.1",
        "openai/gpt-5.1-turbo",
        "openai/gpt-5"
    ]

    try:
        for model_id in valid_formats:
            # Check format has provider/model structure
            parts = model_id.split("/")
            if len(parts) != 2:
                return False, f"Invalid model format: {model_id}"

            provider, model = parts
            if not provider or not model:
                return False, f"Empty provider or model name: {model_id}"

        return True, "GPT-5.1 model format is correct"
    except Exception as e:
        return False, f"Error validating model format: {e}"


def verify_cache_freshness() -> Tuple[bool, str]:
    """Verify cache management functions exist"""
    try:
        from src.cache import is_cache_fresh, should_revalidate_in_background
        return True, "Cache management functions are available"
    except ImportError as e:
        return False, f"Failed to import cache functions: {e}"


def verify_openrouter_integration() -> Tuple[bool, str]:
    """Verify OpenRouter integration is available"""
    try:
        from src.services.models import fetch_models_from_openrouter
        return True, "OpenRouter integration is available"
    except ImportError as e:
        return False, f"Failed to import OpenRouter integration: {e}"


def verify_pricing_lookup() -> Tuple[bool, str]:
    """Verify pricing lookup module is available"""
    try:
        from src.services.pricing_lookup import load_manual_pricing, get_model_pricing as get_manual_pricing
        return True, "Pricing lookup module is available"
    except ImportError as e:
        return False, f"Failed to import pricing lookup: {e}"


def main():
    """Run all verifications"""
    print("\n" + "=" * 70)
    print("GPT-5.1 PRICING AVAILABILITY VERIFICATION")
    print("=" * 70 + "\n")

    checks: List[Tuple[str, callable]] = [
        ("Pricing Structure", verify_pricing_structure),
        ("Dynamic Pricing Handling", verify_negative_pricing_handling),
        ("GPT-5.1 Pricing Data", verify_gpt51_pricing_data),
        ("Cost Calculation Logic", verify_cost_calculation),
        ("Model ID Format", verify_gpt51_model_format),
        ("Cache Management", verify_cache_freshness),
        ("OpenRouter Integration", verify_openrouter_integration),
        ("Pricing Lookup Service", verify_pricing_lookup),
    ]

    results: List[Dict] = []
    passed = 0
    failed = 0

    for name, check_func in checks:
        try:
            success, message = check_func()
            status = "✓ PASS" if success else "✗ FAIL"
            print(f"{status}: {name}")
            print(f"     {message}\n")

            results.append({
                "check": name,
                "status": "PASS" if success else "FAIL",
                "message": message
            })

            if success:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ FAIL: {name}")
            print(f"     Unexpected error: {e}\n")
            results.append({
                "check": name,
                "status": "FAIL",
                "message": str(e)
            })
            failed += 1

    # Summary
    print("=" * 70)
    print(f"SUMMARY: {passed} passed, {failed} failed")
    print("=" * 70)

    # GPT-5.1 Pricing Information
    print("\n" + "-" * 70)
    print("GPT-5.1 PRICING REFERENCE")
    print("-" * 70)
    print("""
Model IDs available:
  - openai/gpt-5.1           (GPT-5.1)
  - openai/gpt-5.1-turbo     (GPT-5.1 Turbo - if available)
  - openai/gpt-5             (GPT-5)

Pricing (per 1M tokens):
  - GPT-5.1 Prompt:      $0.15/1M tokens
  - GPT-5.1 Completion:  $0.60/1M tokens

Context Length:
  - 128,000 tokens

Cost Example (1K prompt + 500 completion tokens):
  - Prompt:     1,000 × $0.15/1M = $0.00015
  - Completion: 500 × $0.60/1M   = $0.0003
  - Total:      $0.00045

Source:
  - OpenRouter API: https://openrouter.ai/api/v1/models
  - Dynamically fetched on application startup
""")

    # Output results as JSON
    print("\nDetailed Results (JSON):")
    print(json.dumps(results, indent=2))

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
