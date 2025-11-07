#!/usr/bin/env python3
"""End-to-end tests for function calling support

This script tests actual function calling flow with real API calls.
Requires valid API keys and may incur costs.
"""

import asyncio
import json
import os
import sys
from typing import Any

import httpx


# Test configuration
API_URL = os.getenv("GATEWAYZ_API_URL", "http://localhost:8000")
API_KEY = os.getenv("GATEWAYZ_API_KEY", "")

# Test tools payload
TEST_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "The unit of temperature",
                    },
                },
                "required": ["location"],
            },
        },
    }
]


async def test_function_calling(
    model: str, provider: str | None = None, endpoint: str = "/v1/chat/completions"
) -> dict[str, Any]:
    """Test function calling with a specific model
    
    Args:
        model: Model identifier
        provider: Provider name (optional)
        endpoint: API endpoint to test
    
    Returns:
        Test result dictionary
    """
    result = {
        "model": model,
        "provider": provider,
        "endpoint": endpoint,
        "success": False,
        "tools_in_request": False,
        "function_call_received": False,
        "error": None,
    }
    
    if not API_KEY:
        result["error"] = "API_KEY not set"
        return result
    
    try:
        # Build request payload
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": "What's the weather like in San Francisco?",
                }
            ],
            "tools": TEST_TOOLS,
            "temperature": 0.7,
            "max_tokens": 500,
        }
        
        if provider:
            payload["provider"] = provider
        
        # Make request
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"Authorization": f"Bearer {API_KEY}"}
            response = await client.post(
                f"{API_URL}{endpoint}",
                headers=headers,
                json=payload,
            )
            
            result["status_code"] = response.status_code
            
            if response.status_code == 200:
                data = response.json()
                result["success"] = True
                
                # Check if tools were in request (would need to check logs or response)
                # For now, we check if we got a function call response
                choices = data.get("choices", [])
                if choices:
                    message = choices[0].get("message", {})
                    tool_calls = message.get("tool_calls")
                    if tool_calls:
                        result["function_call_received"] = True
                        result["tool_calls"] = tool_calls
                    else:
                        result["notes"] = "No tool_calls in response (model may have chosen not to call function)"
            else:
                result["error"] = f"HTTP {response.status_code}: {response.text[:200]}"
    
    except Exception as e:
        result["error"] = str(e)
        result["success"] = False
    
    return result


async def main():
    """Run E2E tests for function calling"""
    
    if not API_KEY:
        print("ERROR: GATEWAYZ_API_KEY environment variable not set")
        print("Set it to run E2E tests:")
        print("  export GATEWAYZ_API_KEY=your-api-key")
        sys.exit(1)
    
    print("=" * 80)
    print("FUNCTION CALLING E2E TESTS")
    print("=" * 80)
    print(f"API URL: {API_URL}")
    print(f"API Key: {API_KEY[:10]}..." if len(API_KEY) > 10 else "API Key: [SET]")
    print()
    
    # Test models (models that support function calling)
    test_cases = [
        {"model": "gpt-4", "provider": "openrouter"},
        {"model": "gpt-3.5-turbo", "provider": "openrouter"},
        # Add more test cases as needed
    ]
    
    results = []
    
    for test_case in test_cases:
        print(f"Testing {test_case['model']} ({test_case['provider']})...")
        result = await test_function_calling(
            test_case["model"], test_case["provider"]
        )
        results.append(result)
        
        status = "✓" if result["success"] else "✗"
        func_call = "✓" if result.get("function_call_received") else "✗"
        print(
            f"  {status} Request: {result['success']}, "
            f"Function Call: {func_call}"
        )
        if result.get("error"):
            print(f"  Error: {result['error']}")
        if result.get("notes"):
            print(f"  Note: {result['notes']}")
        print()
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    successful = [r for r in results if r["success"]]
    with_function_calls = [r for r in results if r.get("function_call_received")]
    
    print(f"Successful requests: {len(successful)}/{len(results)}")
    print(f"Function calls received: {len(with_function_calls)}/{len(results)}")
    
    # Save results
    output_file = "function_calling_e2e_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to: {output_file}")
    
    # Exit code
    if len(successful) == len(results):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

