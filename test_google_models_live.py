#!/usr/bin/env python3
"""
Test Google Models Live - Multi-Provider Edition

This script tests all Google models (Gemini and Gemma) through the gatewayz
multi-provider system. It will try Vertex AI first, then fallback to OpenRouter.
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Union, Dict, Any

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from src.services.multi_provider_registry import get_registry
from src.services.provider_selector import get_selector
from src.services.google_models_config import initialize_google_models

print("=" * 80)
print("Google Models Live Test - Multi-Provider Edition")
print("=" * 80)

# Initialize the multi-provider system
print("\n[SETUP] Initializing multi-provider system...")
initialize_google_models()
print("  ✅ Multi-provider system initialized")

# Get all registered Google models
registry = get_registry()
all_models = registry.get_all_models()
google_models = [m for m in all_models if m.id.startswith(("gemini-", "gemma-"))]

print(f"\n[INFO] Found {len(google_models)} Google models in registry")

# Test configuration
TEST_PROMPT = "Say 'Hello from {model_name}!' and nothing else."
results = []

print("\n" + "=" * 80)
print("Testing Models")
print("=" * 80)

for i, model in enumerate(google_models, 1):
    model_id = model.id
    print(f"\n[{i}/{len(google_models)}] Testing: {model.name}")
    print(f"  Model ID: {model_id}")
    print(f"  Providers: {[p.name for p in model.providers]}")

    # Get provider info
    primary = model.get_primary_provider()
    print(f"  Primary: {primary.name} (priority {primary.priority})")

    result = {
        "model_id": model_id,
        "model_name": model.name,
        "timestamp": datetime.now().isoformat(),
        "primary_provider": primary.name,
        "providers": [p.name for p in model.providers],
    }

    # Try to make a request using the provider selector
    selector = get_selector()

    def make_request(provider_name: str, provider_model_id: str):
        """Execute request with given provider"""
        print(f"    → Trying {provider_name} with model: {provider_model_id}")

        # Import the appropriate client
        if provider_name == "google-vertex":
            from src.services.google_vertex_client import make_google_vertex_request_openai
            return make_google_vertex_request_openai(
                messages=[{
                    "role": "user",
                    "content": TEST_PROMPT.format(model_name=model.name)
                }],
                model=provider_model_id,
                max_tokens=50,
                temperature=0.1
            )
        elif provider_name == "openrouter":
            from src.services.openrouter_client import make_openrouter_request_openai
            return make_openrouter_request_openai(
                messages=[{
                    "role": "user",
                    "content": TEST_PROMPT.format(model_name=model.name)
                }],
                model=provider_model_id,
                max_tokens=50,
                temperature=0.1
            )
        else:
            raise ValueError(f"Unknown provider: {provider_name}")

    try:
        # Use the selector to execute with failover
        execution_result = selector.execute_with_failover(
            model_id=model_id,
            execute_fn=make_request,
            max_retries=2
        )

        if execution_result["success"]:
            # Extract response text
            response_data = execution_result["response"]

            if hasattr(response_data, 'choices'):
                # OpenAI-style response object
                content = response_data.choices[0].message.content
            elif isinstance(response_data, dict) and "choices" in response_data:
                # Dictionary response
                content = response_data["choices"][0]["message"]["content"]
            else:
                content = str(response_data)[:100]

            print(f"    ✅ SUCCESS via {execution_result['provider']}")
            print(f"       Response: {content[:80]}")

            result["success"] = True
            result["provider_used"] = execution_result["provider"]
            result["response"] = content
            result["attempts"] = len(execution_result["attempts"])
            result["attempt_details"] = execution_result["attempts"]

        else:
            print(f"    ❌ FAILED: {execution_result['error']}")
            print(f"       Attempts: {len(execution_result['attempts'])}")
            for attempt in execution_result["attempts"]:
                print(f"         - {attempt['provider']}: {attempt.get('error', 'unknown')[:50]}")

            result["success"] = False
            result["error"] = execution_result["error"]
            result["attempts"] = len(execution_result["attempts"])
            result["attempt_details"] = execution_result["attempts"]

    except Exception as e:
        error_msg = str(e)[:200]
        print(f"    ❌ EXCEPTION: {error_msg}")
        result["success"] = False
        result["error"] = error_msg
        result["attempts"] = 0

    results.append(result)

# Summary
print("\n" + "=" * 80)
print("Test Summary")
print("=" * 80)

successful = sum(1 for r in results if r.get("success", False))
failed = len(results) - successful

print(f"\nTotal Models Tested: {len(results)}")
print(f"Successful: {successful} ✅")
print(f"Failed: {failed} ❌")
print(f"Success Rate: {(successful/len(results)*100):.1f}%")

# Provider breakdown
vertex_count = sum(1 for r in results if r.get("provider_used") == "google-vertex")
openrouter_count = sum(1 for r in results if r.get("provider_used") == "openrouter")

print(f"\nProvider Breakdown:")
print(f"  Vertex AI: {vertex_count} requests")
print(f"  OpenRouter: {openrouter_count} requests")

# Detailed results
print("\n" + "=" * 80)
print("Detailed Results")
print("=" * 80)

for result in results:
    status = "✅ PASS" if result.get("success") else "❌ FAIL"
    print(f"\n{status} - {result['model_name']} ({result['model_id']})")

    if result.get("success"):
        print(f"  Provider: {result['provider_used']}")
        print(f"  Attempts: {result['attempts']}")
        response = result.get("response", "")
        if len(response) > 100:
            response = response[:100] + "..."
        print(f"  Response: {response}")
    else:
        print(f"  Error: {result.get('error', 'Unknown error')[:100]}")
        if result.get("attempts", 0) > 0:
            print(f"  Tried {result['attempts']} provider(s)")

# Export to JSON
print("\n" + "=" * 80)
output_file = "google_models_live_test_results.json"

export_data = {
    "timestamp": datetime.now().isoformat(),
    "total_models": len(results),
    "successful": successful,
    "failed": failed,
    "success_rate": f"{(successful/len(results)*100):.1f}%",
    "provider_breakdown": {
        "vertex_ai": vertex_count,
        "openrouter": openrouter_count,
    },
    "results": results,
}

with open(output_file, "w") as f:
    json.dump(export_data, f, indent=2)

print(f"Results exported to: {output_file}")
print("=" * 80)

# Exit code
sys.exit(0 if failed == 0 else 1)
