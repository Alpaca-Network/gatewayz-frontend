#!/usr/bin/env python3
"""Integration test for Near AI models fetch with actual code"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import logging
from src.services.models import normalize_near_model

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def test_normalize_near_model():
    """Test the actual normalize_near_model function"""
    print("\n" + "="*60)
    print("Testing normalize_near_model function")
    print("="*60 + "\n")

    # Test with new API format (modelId + inputCostPerToken/outputCostPerToken)
    test_cases = [
        {
            "name": "New API format with modelId",
            "input": {
                "modelId": "deepseek-ai/DeepSeek-V3.1",
                "inputCostPerToken": {"amount": 1, "scale": -6},
                "outputCostPerToken": {"amount": 2.5, "scale": -6},
                "metadata": {
                    "displayName": "DeepSeek V3.1",
                    "description": "Advanced reasoning model",
                    "contextLength": 128000
                }
            },
            "expected_prompt": "1.0",
            "expected_completion": "2.5",
        },
        {
            "name": "Legacy API format with id",
            "input": {
                "id": "openai/gpt-oss-120b",
                "pricing": {
                    "prompt": "0.20",
                    "completion": "0.60"
                },
                "metadata": {
                    "context_length": 131000
                }
            },
            "expected_prompt": "0.20",
            "expected_completion": "0.60",
        },
        {
            "name": "Different scale value (-9)",
            "input": {
                "modelId": "test/model",
                "inputCostPerToken": {"amount": 100, "scale": -9},
                "outputCostPerToken": {"amount": 200, "scale": -9},
                "metadata": {"contextLength": 100000}
            },
            "expected_prompt": "0.1",
            "expected_completion": "0.2",
        },
    ]

    all_passed = True

    for test_case in test_cases:
        print(f"Test: {test_case['name']}")
        result = normalize_near_model(test_case['input'])

        if not result:
            logger.error(f"  ❌ FAILED: normalize_near_model returned None")
            all_passed = False
            print()
            continue

        pricing = result.get("pricing", {})
        prompt_price = pricing.get("prompt")
        completion_price = pricing.get("completion")

        print(f"  Expected prompt: ${test_case['expected_prompt']}/M")
        print(f"  Got prompt: ${prompt_price}/M")
        print(f"  Expected completion: ${test_case['expected_completion']}/M")
        print(f"  Got completion: ${completion_price}/M")

        if prompt_price == test_case["expected_prompt"] and completion_price == test_case["expected_completion"]:
            logger.info(f"  ✅ SUCCESS")
        else:
            logger.error(f"  ❌ FAILED: Pricing mismatch")
            all_passed = False

        print()

    print("="*60)
    if all_passed:
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(test_normalize_near_model())
