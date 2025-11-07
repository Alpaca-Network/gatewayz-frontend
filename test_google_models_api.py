#!/usr/bin/env python3
"""
Test Google Models via HTTP API

This test uses the gatewayz HTTP API to test Google models,
avoiding Python version compatibility issues with direct imports.
"""

import os
import sys
import json
import requests
from datetime import datetime

# Load environment variables
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("GATEWAYZ_API_KEY")  # You'll need to set this

# Google models to test
GOOGLE_MODELS = [
    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
    {"id": "gemini-2.5-flash-lite", "name": "Gemini 2.5 Flash Lite"},
    {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro"},
    {"id": "gemini-2.0-flash-exp", "name": "Gemini 2.0 Flash (Experimental)"},
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"},
    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
    {"id": "gemma-2-9b-it", "name": "Gemma 2 9B Instruct"},
    {"id": "gemma-2-27b-it", "name": "Gemma 2 27B Instruct"},
]

print("=" * 80)
print("Google Models API Test")
print("=" * 80)

# Check API key
if not API_KEY:
    print("\n⚠️  WARNING: GATEWAYZ_API_KEY not set in environment")
    print("To get an API key:")
    print("  1. Start the server: uvicorn src.main:app --reload")
    print("  2. Create a user account")
    print("  3. Generate an API key")
    print("  4. Set it: export GATEWAYZ_API_KEY='your-key'")
    print("\nFor now, continuing without auth (if server allows)...")
    API_KEY = None

# Check if server is running
print(f"\n[1] Checking if server is running at {API_BASE_URL}...")
try:
    response = requests.get(f"{API_BASE_URL}/health", timeout=5)
    if response.status_code == 200:
        print("  ✅ Server is running")
    else:
        print(f"  ⚠️  Server responded with status {response.status_code}")
except Exception as e:
    print(f"  ❌ Server not reachable: {e}")
    print("\nPlease start the server:")
    print("  uvicorn src.main:app --reload")
    sys.exit(1)

# Test each model
print(f"\n[2] Testing {len(GOOGLE_MODELS)} Google models...")
print("=" * 80)

results = []

for i, model_info in enumerate(GOOGLE_MODELS, 1):
    model_id = model_info["id"]
    model_name = model_info["name"]

    print(f"\n[{i}/{len(GOOGLE_MODELS)}] Testing: {model_name}")
    print(f"  Model ID: {model_id}")

    result = {
        "model_id": model_id,
        "model_name": model_name,
        "timestamp": datetime.now().isoformat(),
    }

    # Prepare request
    headers = {
        "Content-Type": "application/json",
    }
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"

    payload = {
        "model": model_id,
        "messages": [
            {"role": "user", "content": f"Say 'Hello from {model_name}!' and nothing else."}
        ],
        "max_tokens": 50,
        "temperature": 0.1,
    }

    # Make request
    try:
        response = requests.post(
            f"{API_BASE_URL}/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()

            # Extract response
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                provider_used = data.get("gateway_usage", {}).get("provider", "unknown")

                print(f"  ✅ SUCCESS")
                print(f"     Provider: {provider_used}")
                print(f"     Response: {content[:80]}")

                result["success"] = True
                result["provider"] = provider_used
                result["response"] = content
                result["status_code"] = 200

            else:
                print(f"  ❌ FAILED: No choices in response")
                result["success"] = False
                result["error"] = "No choices in response"
                result["status_code"] = 200

        else:
            error_text = response.text[:200]
            print(f"  ❌ FAILED: HTTP {response.status_code}")
            print(f"     Error: {error_text}")

            result["success"] = False
            result["status_code"] = response.status_code
            result["error"] = error_text

    except Exception as e:
        error_msg = str(e)[:200]
        print(f"  ❌ EXCEPTION: {error_msg}")

        result["success"] = False
        result["error"] = error_msg

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

if len(results) > 0:
    print(f"Success Rate: {(successful/len(results)*100):.1f}%")

# Provider breakdown (only for successful requests)
providers = {}
for r in results:
    if r.get("success") and "provider" in r:
        provider = r["provider"]
        providers[provider] = providers.get(provider, 0) + 1

if providers:
    print(f"\nProvider Breakdown:")
    for provider, count in providers.items():
        print(f"  {provider}: {count} requests")

# Detailed results
print("\n" + "=" * 80)
print("Detailed Results")
print("=" * 80)

for result in results:
    status = "✅ PASS" if result.get("success") else "❌ FAIL"
    print(f"\n{status} - {result['model_name']} ({result['model_id']})")

    if result.get("success"):
        print(f"  Provider: {result.get('provider', 'unknown')}")
        response = result.get("response", "")
        if len(response) > 100:
            response = response[:100] + "..."
        print(f"  Response: {response}")
    else:
        error = result.get("error", "Unknown error")
        if len(error) > 150:
            error = error[:150] + "..."
        print(f"  Error: {error}")

# Export results
print("\n" + "=" * 80)
output_file = "google_models_api_test_results.json"

export_data = {
    "timestamp": datetime.now().isoformat(),
    "api_base_url": API_BASE_URL,
    "total_models": len(results),
    "successful": successful,
    "failed": failed,
    "success_rate": f"{(successful/len(results)*100):.1f}%" if len(results) > 0 else "0%",
    "provider_breakdown": providers,
    "results": results,
}

with open(output_file, "w") as f:
    json.dump(export_data, f, indent=2)

print(f"Results exported to: {output_file}")
print("=" * 80)

# Exit code
sys.exit(0 if failed == 0 else 1)
