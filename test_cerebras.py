#!/usr/bin/env python3
"""
Simple test script to verify Cerebras models are working
"""

import asyncio
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.services.providers import fetch_models_from_cerebras
from src.services.cerebras_client import make_cerebras_request_openai
from src.config import Config

def test_fetch_cerebras_models():
    """Test fetching Cerebras models"""
    print("=" * 80)
    print("TEST 1: Fetching Cerebras Models")
    print("=" * 80)

    # Check if API key is configured
    if not Config.CEREBRAS_API_KEY:
        print("❌ CEREBRAS_API_KEY not configured in environment")
        return None

    print(f"✓ CEREBRAS_API_KEY is configured")

    # Fetch models
    try:
        models = fetch_models_from_cerebras()

        if not models:
            print("❌ No models returned from Cerebras")
            return None

        print(f"✓ Successfully fetched {len(models)} models from Cerebras")
        print("\nAvailable Cerebras models:")
        for i, model in enumerate(models[:10], 1):  # Show first 10 models
            model_id = model.get('id', 'unknown')
            model_name = model.get('name', model_id)
            print(f"  {i}. {model_id}")

        if len(models) > 10:
            print(f"  ... and {len(models) - 10} more models")

        return models

    except Exception as e:
        print(f"❌ Error fetching Cerebras models: {e}")
        import traceback
        traceback.print_exc()
        return None

async def test_cerebras_inference(model_id: str):
    """Test inference with a Cerebras model"""
    print("\n" + "=" * 80)
    print(f"TEST 2: Testing Inference with model: {model_id}")
    print("=" * 80)

    # Check if Cerebras API key is configured
    if not Config.CEREBRAS_API_KEY:
        print("❌ CEREBRAS_API_KEY not configured (needed to access Cerebras)")
        return None

    print(f"✓ CEREBRAS_API_KEY is configured")

    # Prepare request
    request_params = {
        'model': model_id,  # Direct model ID for Cerebras
        'messages': [
            {'role': 'system', 'content': 'You are a helpful assistant. Keep responses very brief.'},
            {'role': 'user', 'content': 'Say "Hello from Cerebras!" and nothing else.'},
        ],
        'temperature': 0.7,
        'max_tokens': 50,
        'stream': False,
    }

    print(f"\nSending test prompt to Cerebras model: {model_id}")
    print(f"Request: {request_params['messages'][1]['content']}")

    try:
        # Make the request
        response = await asyncio.to_thread(make_cerebras_request_openai, **request_params)

        # Validate response
        if not response:
            print("❌ Empty response from Cerebras")
            return None

        if isinstance(response, dict) and 'choices' in response:
            choices = response['choices']
            if choices and len(choices) > 0:
                message = choices[0].get('message', {})
                content = message.get('content', '')

                if content:
                    print("\n✓ SUCCESS! Cerebras model responded:")
                    print(f"\n{'─' * 80}")
                    print(f"Response: {content}")
                    print(f"{'─' * 80}")

                    # Show additional response metadata
                    if 'usage' in response:
                        usage = response['usage']
                        print(f"\nToken usage:")
                        print(f"  - Prompt tokens: {usage.get('prompt_tokens', 'N/A')}")
                        print(f"  - Completion tokens: {usage.get('completion_tokens', 'N/A')}")
                        print(f"  - Total tokens: {usage.get('total_tokens', 'N/A')}")

                    return response
                else:
                    print("❌ Response content is empty")
                    return None
            else:
                print("❌ No choices in response")
                return None
        else:
            print(f"❌ Invalid response structure: {type(response)}")
            return None

    except Exception as e:
        print(f"❌ Error during inference: {e}")
        import traceback
        traceback.print_exc()
        return None

async def main():
    """Main test function"""
    print("\n🧪 Cerebras Models Verification Test")
    print("=" * 80)

    # Test 1: Fetch models
    models = test_fetch_cerebras_models()

    if not models:
        print("\n❌ Cannot proceed with inference test - no models available")
        return

    # Test 2: Test inference with the first available model
    first_model_id = models[0].get('id')
    if first_model_id:
        await test_cerebras_inference(first_model_id)
    else:
        print("\n❌ First model has no ID, cannot test inference")

    print("\n" + "=" * 80)
    print("✅ Cerebras verification test completed")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
