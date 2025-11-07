#!/usr/bin/env python3
"""
Diagnostic script to identify why Claude Sonnet 4.5 is returning "No response received"
This script tests the entire flow from model ID to actual API call
"""
import os
import sys

sys.path.insert(0, 'src')

print("=" * 80)
print("CLAUDE SONNET 4.5 DIAGNOSTIC TOOL")
print("=" * 80)

# Test 1: Check environment variables
print("\n[1] Checking Environment Variables...")
print("-" * 80)

openrouter_key = os.getenv('OPENROUTER_API_KEY')
if openrouter_key:
    print(f"✓ OPENROUTER_API_KEY: Set (ends with ...{openrouter_key[-4:]})")
else:
    print("✗ OPENROUTER_API_KEY: NOT SET")
    print("  This is REQUIRED for Claude Sonnet 4.5 to work!")
    print("  Set it with: export OPENROUTER_API_KEY='your-key-here'")

# Test 2: Check model transformation
print("\n[2] Testing Model ID Transformation...")
print("-" * 80)

try:
    from src.services.model_transformations import transform_model_id, detect_provider_from_model_id

    test_models = [
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4.5",
        "anthropic/claude-sonnet-4.5",
        "anthropic/claude-4.5-sonnet",
    ]

    for model_id in test_models:
        # Detect provider
        provider = detect_provider_from_model_id(model_id)

        # Transform model ID
        if provider:
            transformed = transform_model_id(model_id, provider)
            print(f"  Input: {model_id}")
            print(f"    → Provider: {provider}")
            print(f"    → Transformed: {transformed}")

            if transformed == "anthropic/claude-sonnet-4.5":
                print(f"    ✓ Correct transformation!")
            else:
                print(f"    ✗ WRONG! Should be 'anthropic/claude-sonnet-4.5'")
        else:
            print(f"  Input: {model_id}")
            print(f"    ✗ Provider NOT detected - will default to openrouter")
            transformed = transform_model_id(model_id, "openrouter")
            print(f"    → Transformed (with openrouter): {transformed}")
        print()

    print("✓ Model transformation module loaded successfully")

except Exception as e:
    print(f"✗ Model transformation failed: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Check OpenRouter client
print("\n[3] Testing OpenRouter Client Initialization...")
print("-" * 80)

try:
    from src.services.openrouter_client import get_openrouter_client

    if openrouter_key:
        client = get_openrouter_client()
        print("✓ OpenRouter client initialized successfully")
        print(f"  Base URL: {client.base_url}")
    else:
        print("✗ Cannot test client - OPENROUTER_API_KEY not set")

except Exception as e:
    print(f"✗ OpenRouter client initialization failed: {e}")
    import traceback
    traceback.print_exc()

# Test 4: Test actual API call to OpenRouter
print("\n[4] Testing Actual API Call to OpenRouter...")
print("-" * 80)

if openrouter_key:
    try:
        from src.services.openrouter_client import make_openrouter_request_openai, process_openrouter_response

        # Test with the correct model ID
        test_model = "anthropic/claude-sonnet-4.5"
        test_messages = [{"role": "user", "content": "Say 'test successful' and nothing else."}]

        print(f"  Calling OpenRouter API...")
        print(f"    Model: {test_model}")
        print(f"    Message: {test_messages[0]['content']}")

        response = make_openrouter_request_openai(
            messages=test_messages,
            model=test_model,
            max_tokens=50
        )

        print(f"\n  ✓ API call successful!")
        print(f"    Response ID: {response.id}")
        print(f"    Model: {response.model}")

        if response.choices:
            content = response.choices[0].message.content
            print(f"    Content: {content}")
            print(f"\n  🎉 Claude Sonnet 4.5 is working correctly!")
        else:
            print(f"    ✗ No choices in response")

    except Exception as e:
        print(f"\n  ✗ API call failed: {e}")
        print(f"\n  Error details:")
        import traceback
        traceback.print_exc()

        # Check if it's a specific error
        error_str = str(e)
        if "401" in error_str or "authentication" in error_str.lower():
            print("\n  → This looks like an authentication error")
            print("    Check that your OPENROUTER_API_KEY is valid")
        elif "404" in error_str or "not found" in error_str.lower():
            print("\n  → This looks like a model not found error")
            print("    The model might not be available on OpenRouter")
        elif "402" in error_str or "credits" in error_str.lower():
            print("\n  → This looks like a credits/billing error")
            print("    Check your OpenRouter account balance")
        elif "429" in error_str or "rate limit" in error_str.lower():
            print("\n  → This looks like a rate limit error")
            print("    You may have exceeded OpenRouter's rate limits")
else:
    print("✗ Skipping API test - OPENROUTER_API_KEY not set")

# Test 5: Check if model is in OpenRouter catalog
print("\n[5] Checking OpenRouter Model Catalog...")
print("-" * 80)

if openrouter_key:
    try:
        import httpx

        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json"
        }

        print("  Fetching models from OpenRouter...")
        response = httpx.get("https://openrouter.ai/api/v1/models", headers=headers, timeout=10.0)
        response.raise_for_status()

        models_data = response.json()
        models = models_data.get("data", [])

        # Search for Claude Sonnet 4.5
        claude_models = [m for m in models if "claude" in m.get("id", "").lower() and "sonnet" in m.get("id", "").lower()]

        print(f"\n  Found {len(claude_models)} Claude Sonnet models:")
        for model in claude_models[:10]:  # Show first 10
            model_id = model.get("id", "")
            name = model.get("name", "")
            print(f"    - {model_id}")
            if "4.5" in model_id or "4-5" in model_id:
                print(f"      ✓ This is Claude Sonnet 4.5!")
                print(f"      Name: {name}")

                # Check pricing
                pricing = model.get("pricing", {})
                if pricing:
                    prompt_price = pricing.get("prompt", "N/A")
                    completion_price = pricing.get("completion", "N/A")
                    print(f"      Pricing: ${prompt_price}/1M input, ${completion_price}/1M output")

        # Search specifically for the exact model ID
        exact_model = next((m for m in models if m.get("id") == "anthropic/claude-sonnet-4.5"), None)
        if exact_model:
            print(f"\n  ✓ Found exact match: anthropic/claude-sonnet-4.5")
            print(f"    Name: {exact_model.get('name')}")
            print(f"    Context: {exact_model.get('context_length', 'N/A')} tokens")
        else:
            print(f"\n  ✗ Model 'anthropic/claude-sonnet-4.5' not found in catalog")
            print(f"    This might be the issue!")

            # Check alternative IDs
            alternatives = [
                "anthropic/claude-4.5-sonnet",
                "anthropic/claude-4.5-sonnet-20250929",
                "anthropic/claude-sonnet-4-5",
            ]
            print(f"\n  Checking alternative model IDs...")
            for alt_id in alternatives:
                alt_model = next((m for m in models if m.get("id") == alt_id), None)
                if alt_model:
                    print(f"    ✓ Found: {alt_id}")
                    print(f"      Use this ID instead!")
                    break

    except Exception as e:
        print(f"  ✗ Failed to fetch catalog: {e}")
        import traceback
        traceback.print_exc()
else:
    print("✗ Skipping catalog check - OPENROUTER_API_KEY not set")

# Summary
print("\n" + "=" * 80)
print("DIAGNOSTIC SUMMARY")
print("=" * 80)

issues_found = []
fixes = []

if not openrouter_key:
    issues_found.append("OPENROUTER_API_KEY not set")
    fixes.append("Set OPENROUTER_API_KEY environment variable")

print(f"\nIssues Found: {len(issues_found)}")
if issues_found:
    for i, issue in enumerate(issues_found, 1):
        print(f"  {i}. {issue}")

    print(f"\nRecommended Fixes:")
    for i, fix in enumerate(fixes, 1):
        print(f"  {i}. {fix}")
else:
    print("  None - configuration looks good!")

print("\n" + "=" * 80)
print("For more help, check:")
print("  - CLAUDE_SONNET_4_5_FIX.md")
print("  - CLAUDE_SONNET_4_5_VERIFICATION.md")
print("=" * 80)
