#!/usr/bin/env python3
"""
Simple standalone test script to verify Cerebras models are working
This script doesn't require the full application dependencies
"""

import os
import sys

def test_cerebras_direct():
    """Test Cerebras API directly without full application imports"""
    print("=" * 80)
    print("🧪 Cerebras Models Verification Test (Standalone)")
    print("=" * 80)

    # Check environment variables
    cerebras_api_key = os.environ.get("CEREBRAS_API_KEY")

    print("\n1. Checking Environment Configuration:")
    print("─" * 80)

    if not cerebras_api_key:
        print("❌ CEREBRAS_API_KEY not configured in environment")
        print("   This is required to fetch models from Cerebras")
    else:
        print(f"✓ CEREBRAS_API_KEY is configured (length: {len(cerebras_api_key)})")

    # Test 1: Fetch models using Cerebras SDK
    print("\n2. Fetching Cerebras Models:")
    print("─" * 80)

    if not cerebras_api_key:
        print("❌ Cannot fetch models - CEREBRAS_API_KEY not set")
        return False

    try:
        # Try importing Cerebras SDK
        try:
            from cerebras.cloud.sdk import Cerebras
            print("✓ Cerebras SDK is installed")
        except ImportError:
            print("❌ Cerebras SDK not installed")
            print("   Install with: pip install cerebras-cloud-sdk")
            return False

        # Create client and fetch models
        client = Cerebras(api_key=cerebras_api_key)
        print("✓ Cerebras client initialized")

        print("\nFetching models from Cerebras API...")
        models_response = client.models.list()

        # Convert to list
        models = []
        if hasattr(models_response, 'data'):
            models = list(models_response.data)
        else:
            models = list(models_response)

        if not models:
            print("❌ No models returned from Cerebras API")
            return False

        print(f"✓ Successfully fetched {len(models)} models from Cerebras")

        # Display available models
        print(f"\n📋 Available Cerebras Models (showing first 10):")
        for i, model in enumerate(models[:10], 1):
            if hasattr(model, 'id'):
                model_id = model.id
            elif isinstance(model, dict):
                model_id = model.get('id', 'unknown')
            else:
                model_id = str(model)

            print(f"  {i}. {model_id}")

        if len(models) > 10:
            print(f"  ... and {len(models) - 10} more models")

        # Test 2: Send inference request
        print("\n3. Testing Inference:")
        print("─" * 80)

        if not models:
            print("❌ No models available for inference test")
            return False

        # Get first model ID
        first_model = models[0]
        if hasattr(first_model, 'id'):
            test_model_id = first_model.id
        elif isinstance(first_model, dict):
            test_model_id = first_model.get('id')
        else:
            print("❌ Cannot determine model ID")
            return False

        print(f"Testing with model: {test_model_id}")

        # Send test request
        print("\nSending test prompt: 'Say Hello from Cerebras!'")

        completion = client.chat.completions.create(
            model=test_model_id,
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Keep responses very brief."},
                {"role": "user", "content": "Say 'Hello from Cerebras!' and nothing else."}
            ],
            max_tokens=50,
            temperature=0.7
        )

        # Extract response
        if hasattr(completion, 'choices') and completion.choices:
            response_content = completion.choices[0].message.content

            print("\n✅ SUCCESS! Cerebras model responded:")
            print("═" * 80)
            print(f"Response: {response_content}")
            print("═" * 80)

            # Show usage stats if available
            if hasattr(completion, 'usage') and completion.usage:
                usage = completion.usage
                print(f"\n📊 Token Usage:")
                if hasattr(usage, 'prompt_tokens'):
                    print(f"  - Prompt tokens: {usage.prompt_tokens}")
                if hasattr(usage, 'completion_tokens'):
                    print(f"  - Completion tokens: {usage.completion_tokens}")
                if hasattr(usage, 'total_tokens'):
                    print(f"  - Total tokens: {usage.total_tokens}")

            print("\n✅ Cerebras models are working correctly!")
            return True
        else:
            print("❌ No response content received")
            return False

    except Exception as e:
        print(f"\n❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print()
    success = test_cerebras_direct()
    print("\n" + "=" * 80)
    if success:
        print("✅ All tests passed - Cerebras integration is working!")
    else:
        print("❌ Tests failed - please check configuration and logs above")
    print("=" * 80 + "\n")

    sys.exit(0 if success else 1)
