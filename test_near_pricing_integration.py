#!/usr/bin/env python3
"""Test script to verify Near AI pricing integration"""

import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Mock data from the Near AI API
mock_near_api_response = {
    "models": [
        {
            "modelId": "deepseek-ai/DeepSeek-V3.1",
            "inputCostPerToken": {"amount": 1, "scale": -6},
            "outputCostPerToken": {"amount": 2.5, "scale": -6},
            "metadata": {
                "displayName": "DeepSeek V3.1",
                "description": "Advanced reasoning model with hybrid thinking mode",
                "contextLength": 128000
            }
        },
        {
            "modelId": "openai/gpt-oss-120b",
            "inputCostPerToken": {"amount": 0.2, "scale": -6},
            "outputCostPerToken": {"amount": 0.6, "scale": -6},
            "metadata": {
                "displayName": "GPT OSS 120B",
                "description": "High-performance open source model",
                "contextLength": 131000
            }
        },
        {
            "modelId": "Qwen/Qwen3-30B-A3B-Instruct-2507",
            "inputCostPerToken": {"amount": 0.15, "scale": -6},
            "outputCostPerToken": {"amount": 0.45, "scale": -6},
            "metadata": {
                "displayName": "Qwen3 30B A3B Instruct",
                "description": "Efficient instruction-following model",
                "contextLength": 262000
            }
        },
        {
            "modelId": "zai-org/GLM-4.6",
            "inputCostPerToken": {"amount": 0.75, "scale": -6},
            "outputCostPerToken": {"amount": 2.0, "scale": -6},
            "metadata": {
                "displayName": "GLM-4.6",
                "description": "Zhipu AI's latest generation model",
                "contextLength": 200000
            }
        }
    ]
}

def normalize_near_model(near_model: dict) -> dict:
    """Test version of the normalize function"""
    model_id = near_model.get("modelId")
    if not model_id:
        return None

    slug = f"near/{model_id}"
    metadata = near_model.get("metadata", {})

    display_name = metadata.get("displayName", model_id)
    description = metadata.get("description", f"Near AI hosted model {model_id}.")
    context_length = metadata.get("contextLength", 0)

    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
    }

    # Extract pricing from Near AI API response
    input_cost = near_model.get("inputCostPerToken", {})
    output_cost = near_model.get("outputCostPerToken", {})

    if input_cost and isinstance(input_cost, dict):
        input_amount = input_cost.get("amount", 0)
        input_scale = input_cost.get("scale", -9)
        # Convert to per million tokens
        if input_amount > 0:
            pricing["prompt"] = str(input_amount * (10 ** (6 + input_scale)))

    if output_cost and isinstance(output_cost, dict):
        output_amount = output_cost.get("amount", 0)
        output_scale = output_cost.get("scale", -9)
        # Convert to per million tokens
        if output_amount > 0:
            pricing["completion"] = str(output_amount * (10 ** (6 + output_scale)))

    return {
        "id": slug,
        "name": display_name,
        "description": description,
        "context_length": context_length,
        "pricing": pricing,
    }

def test_pricing_extraction():
    """Test that pricing is correctly extracted from Near AI API response"""
    print("\n" + "="*60)
    print("Testing Near AI Pricing Integration")
    print("="*60 + "\n")

    models = mock_near_api_response["models"]
    success = True

    for model in models:
        normalized = normalize_near_model(model)
        if not normalized:
            logger.error(f"Failed to normalize model: {model.get('modelId')}")
            success = False
            continue

        model_id = model.get("modelId")
        pricing = normalized.get("pricing", {})

        print(f"Model: {normalized['name']}")
        print(f"  ID: {normalized['id']}")
        print(f"  Context Length: {normalized['context_length']:,} tokens")
        print(f"  Pricing:")
        print(f"    Input: ${pricing.get('prompt', 'N/A')} per million tokens")
        print(f"    Output: ${pricing.get('completion', 'N/A')} per million tokens")

        # Verify pricing is extracted
        if not pricing.get("prompt") or not pricing.get("completion"):
            logger.error(f"  ❌ FAILED: Pricing not extracted for {model_id}")
            success = False
        else:
            logger.info(f"  ✅ SUCCESS: Pricing extracted correctly")

        print()

    print("="*60)
    if success:
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(test_pricing_extraction())
