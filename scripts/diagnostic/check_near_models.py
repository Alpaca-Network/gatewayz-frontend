#!/usr/bin/env python3
"""
Diagnostic script to check Near AI API models and validate model IDs.

This script will:
1. Fetch the list of available models from Near AI API
2. Test specific model IDs to see if they work
3. Compare with our configured model transformations
4. Provide recommendations for fixing any mismatches

Usage:
    python scripts/diagnostic/check_near_models.py

Environment Variables Required:
    NEAR_API_KEY - Your Near AI API key
"""

import json
import os
import sys
from typing import Dict, List, Optional

import httpx


def get_near_api_key() -> Optional[str]:
    """Get Near API key from environment"""
    api_key = os.environ.get("NEAR_API_KEY")
    if not api_key:
        print("❌ ERROR: NEAR_API_KEY environment variable not set")
        print("Please set it with: export NEAR_API_KEY='your-api-key'")
        return None
    return api_key


def fetch_available_models(api_key: str) -> Optional[List[Dict]]:
    """Fetch list of available models from Near AI API"""
    print("\n📡 Fetching models from Near AI API...")
    print("Endpoint: https://cloud-api.near.ai/v1/models")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = httpx.get(
            "https://cloud-api.near.ai/v1/models",
            headers=headers,
            timeout=20.0,
        )
        response.raise_for_status()

        data = response.json()
        models = data.get("data", [])

        print(f"✅ Successfully fetched {len(models)} models")
        return models

    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP Error {e.response.status_code}: {e.response.text}")
        return None
    except httpx.RequestError as e:
        print(f"❌ Request Error: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return None


def test_model_chat(api_key: str, model_id: str) -> bool:
    """Test if a specific model ID works with the chat endpoint"""
    print(f"\n🧪 Testing model: {model_id}")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_id,
        "messages": [
            {"role": "user", "content": "Hello"}
        ],
        "max_tokens": 10,
    }

    try:
        response = httpx.post(
            "https://cloud-api.near.ai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30.0,
        )

        if response.status_code == 200:
            print(f"   ✅ Model '{model_id}' is working")
            return True
        else:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("error", {}).get("message", response.text)
            print(f"   ❌ Model '{model_id}' failed: {error_msg}")
            return False

    except httpx.HTTPStatusError as e:
        error_data = e.response.json() if e.response.text else {}
        error_msg = error_data.get("error", {}).get("message", str(e))
        print(f"   ❌ HTTP Error: {error_msg}")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def get_configured_near_models() -> Dict[str, str]:
    """Get the Near model transformations from our codebase"""
    # This mirrors the mappings in src/services/model_transformations.py
    # Reference: https://cloud.near.ai/models for current available models
    return {
        # DeepSeek models - only DeepSeek-V3.1 is currently available
        "deepseek-ai/deepseek-v3": "deepseek-ai/DeepSeek-V3.1",  # Map v3 to v3.1
        "deepseek-ai/deepseek-v3.1": "deepseek-ai/DeepSeek-V3.1",
        "deepseek-v3": "deepseek-ai/DeepSeek-V3.1",
        "deepseek-v3.1": "deepseek-ai/DeepSeek-V3.1",

        # Meta Llama models
        "meta-llama/llama-3-70b": "llama-3-70b",
        "meta-llama/llama-3.1-70b": "llama-3.1-70b",
        "llama-3-70b": "llama-3-70b",
        "llama-3.1-70b": "llama-3.1-70b",

        # Qwen models
        "qwen/qwen-2-72b": "qwen-2-72b",
        "qwen-2-72b": "qwen-2-72b",

        # GPT-OSS models
        "gpt-oss/gpt-oss-120b": "gpt-oss-120b",
        "gpt-oss-120b": "gpt-oss-120b",

        # GLM models from Zhipu AI
        "zai-org/glm-4.6-fp8": "glm-4.6-fp8",
        "zai-org/glm-4.6": "glm-4.6",
        "glm-4.6-fp8": "glm-4.6-fp8",
        "glm-4.6": "glm-4.6",
    }


def compare_and_recommend(available_models: List[Dict], configured_models: Dict[str, str], api_key: str):
    """Compare available models with configured ones and provide recommendations"""
    print("\n" + "="*80)
    print("📊 ANALYSIS: Comparing configured models with Near AI API")
    print("="*80)

    # Extract just the model IDs from available models
    available_ids = {model.get("id") for model in available_models if model.get("id")}

    print(f"\n📋 Available Near AI Models ({len(available_ids)}):")
    for model_id in sorted(available_ids):
        print(f"   • {model_id}")

    # Get unique target model IDs from our configuration
    configured_targets = set(configured_models.values())

    print(f"\n⚙️  Configured Model IDs in Gatewayz ({len(configured_targets)}):")
    for model_id in sorted(configured_targets):
        print(f"   • {model_id}")

    # Find mismatches
    missing_models = configured_targets - available_ids
    extra_models = available_ids - configured_targets

    if missing_models:
        print(f"\n⚠️  MISSING MODELS (configured but not available in Near AI):")
        for model_id in sorted(missing_models):
            print(f"   ❌ {model_id}")
            # Try to find similar models
            similar = [m for m in available_ids if any(part in m for part in model_id.split("-")[:2])]
            if similar:
                print(f"      💡 Similar available models: {', '.join(similar)}")
    else:
        print(f"\n✅ All configured models are available in Near AI")

    if extra_models:
        print(f"\n💡 ADDITIONAL MODELS (available but not configured):")
        for model_id in sorted(extra_models):
            print(f"   • {model_id}")

    # Test a few key models
    print("\n" + "="*80)
    print("🧪 TESTING KEY MODELS")
    print("="*80)

    test_models = [
        "deepseek-ai/DeepSeek-V3.1",  # Only available DeepSeek model on Near AI
        "glm-4.6-fp8",
        "gpt-oss-120b",
    ]

    working_models = []
    broken_models = []

    for model_id in test_models:
        if test_model_chat(api_key, model_id):
            working_models.append(model_id)
        else:
            broken_models.append(model_id)

    # Provide recommendations
    print("\n" + "="*80)
    print("💡 RECOMMENDATIONS")
    print("="*80)

    if broken_models:
        print("\n🔧 Models that need fixing:")
        for model_id in broken_models:
            print(f"\n   ❌ {model_id}")

            # Find alternatives
            similar = [m for m in available_ids if any(part in m for part in model_id.split("-")[:2])]
            if similar:
                print(f"      Suggested replacement(s): {', '.join(sorted(similar))}")
                print(f"      ")
                print(f"      Update in: src/services/model_transformations.py")
                print(f"      Change: '{model_id}' -> '{similar[0]}'")
            else:
                print(f"      No similar models found - consider removing this model")
                print(f"      Or route to a different provider (fireworks, openrouter, etc)")

    if working_models:
        print(f"\n✅ Working models ({len(working_models)}):")
        for model_id in working_models:
            print(f"   • {model_id}")

    # Generate code snippet for fixes
    if broken_models and any(
        m for broken in broken_models
        for m in available_ids
        if any(part in m for part in broken.split("-")[:2])
    ):
        print("\n" + "="*80)
        print("📝 SUGGESTED CODE CHANGES")
        print("="*80)
        print("\nUpdate src/services/model_transformations.py:")
        print("```python")
        print('"near": {')

        for input_id, target_id in sorted(configured_models.items()):
            if target_id in broken_models:
                # Find alternative
                similar = [m for m in available_ids if any(part in m for part in target_id.split("-")[:2])]
                if similar:
                    new_target = similar[0]
                    print(f'    "{input_id}": "{new_target}",  # Changed from {target_id}')
                else:
                    print(f'    # "{input_id}": "{target_id}",  # DISABLED - model not available')
            else:
                print(f'    "{input_id}": "{target_id}",')

        print('}')
        print("```")


def main():
    """Main execution function"""
    print("="*80)
    print("🔍 Near AI Model Diagnostic Tool")
    print("="*80)

    # Get API key
    api_key = get_near_api_key()
    if not api_key:
        sys.exit(1)

    # Fetch available models
    available_models = fetch_available_models(api_key)
    if not available_models:
        print("\n❌ Could not fetch models from Near AI API")
        sys.exit(1)

    # Get configured models
    configured_models = get_configured_near_models()

    # Compare and provide recommendations
    compare_and_recommend(available_models, configured_models, api_key)

    # Save raw data for reference
    output_file = "near_models_diagnostic.json"
    with open(output_file, "w") as f:
        json.dump({
            "available_models": available_models,
            "configured_models": configured_models,
            "timestamp": __import__("datetime").datetime.now().isoformat(),
        }, f, indent=2)

    print(f"\n📄 Raw data saved to: {output_file}")
    print("\n✅ Diagnostic complete!")


if __name__ == "__main__":
    main()
