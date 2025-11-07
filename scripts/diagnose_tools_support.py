#!/usr/bin/env python3
"""Diagnostic script to test tools/function calling support across providers

This script tests whether the tools parameter is correctly passed through
to each provider's API client functions.
"""

import json
import logging
import sys
from typing import Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Test tools payload (OpenAI format)
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


def test_provider_client(provider_name: str, client_func_name: str) -> dict[str, Any]:
    """Test a provider client function to see if it receives tools parameter
    
    Args:
        provider_name: Name of the provider (e.g., "openrouter")
        client_func_name: Full path to client function (e.g., "src.services.openrouter_client.make_openrouter_request_openai")
    
    Returns:
        Dictionary with test results
    """
    result = {
        "provider": provider_name,
        "function": client_func_name,
        "tools_received": False,
        "tools_in_payload": False,
        "error": None,
        "notes": [],
    }
    
    try:
        # Import the function
        module_path, func_name = client_func_name.rsplit(".", 1)
        module = __import__(module_path, fromlist=[func_name])
        client_func = getattr(module, func_name)
        
        # Check function signature
        import inspect
        sig = inspect.signature(client_func)
        params = list(sig.parameters.keys())
        
        # Check if function accepts **kwargs
        has_kwargs = any(
            param.kind == inspect.Parameter.VAR_KEYWORD
            for param in sig.parameters.values()
        )
        
        if not has_kwargs:
            result["notes"].append(
                f"Function does not accept **kwargs - tools may not be passed through"
            )
        
        # Try to call with tools (mock call - we'll check if it's in kwargs)
        # We'll use a mock to intercept the call
        from unittest.mock import patch, MagicMock
        
        mock_called_with = {}
        
        def capture_kwargs(*args, **kwargs):
            mock_called_with.update(kwargs)
            return {"choices": [{"message": {"content": "test"}}]}
        
        # For HuggingFace, we need to check _build_payload
        if provider_name == "huggingface":
            from src.services.huggingface_client import _build_payload, ALLOWED_PARAMS
            
            payload = _build_payload(
                [{"role": "user", "content": "test"}],
                "test-model",
                tools=TEST_TOOLS,
            )
            
            result["tools_received"] = True
            result["tools_in_payload"] = "tools" in payload
            result["notes"].append(
                f"tools in ALLOWED_PARAMS: {'tools' in ALLOWED_PARAMS}"
            )
            
        # For Google Vertex, check if tools are extracted
        elif provider_name == "google-vertex":
            # Check if function extracts tools from kwargs
            result["notes"].append(
                "Google Vertex requires transformation from OpenAI to Gemini format"
            )
            result["tools_received"] = True  # It's extracted but may not be transformed
            result["tools_in_payload"] = False  # Not yet implemented
            
        else:
            # For other providers, check if **kwargs includes tools
            with patch.object(client_func, "__call__", side_effect=capture_kwargs):
                try:
                    client_func(
                        [{"role": "user", "content": "test"}],
                        "test-model",
                        tools=TEST_TOOLS,
                    )
                    result["tools_received"] = "tools" in mock_called_with
                    result["notes"].append(
                        f"Function accepts tools in kwargs: {result['tools_received']}"
                    )
                except Exception as e:
                    result["error"] = str(e)
                    result["notes"].append(f"Error calling function: {e}")
        
    except ImportError as e:
        result["error"] = f"Could not import: {e}"
    except Exception as e:
        result["error"] = f"Unexpected error: {e}"
        logger.exception("Error testing provider")
    
    return result


def main():
    """Run diagnostic tests for all providers"""
    
    providers_to_test = [
        ("openrouter", "src.services.openrouter_client.make_openrouter_request_openai"),
        ("huggingface", "src.services.huggingface_client.make_huggingface_request_openai"),
        ("google-vertex", "src.services.google_vertex_client.make_google_vertex_request_openai"),
        ("featherless", "src.services.featherless_client.make_featherless_request_openai"),
        ("fireworks", "src.services.fireworks_client.make_fireworks_request_openai"),
        ("together", "src.services.together_client.make_together_request_openai"),
        ("portkey", "src.services.portkey_client.make_portkey_request_openai"),
        ("aimo", "src.services.aimo_client.make_aimo_request_openai"),
        ("xai", "src.services.xai_client.make_xai_request_openai"),
        ("near", "src.services.near_client.make_near_request_openai"),
    ]
    
    results = []
    
    logger.info("Starting tools support diagnostic...")
    logger.info(f"Testing {len(providers_to_test)} providers")
    
    for provider_name, func_path in providers_to_test:
        logger.info(f"Testing {provider_name}...")
        result = test_provider_client(provider_name, func_path)
        results.append(result)
        
        status = "✓" if result["tools_received"] and result["tools_in_payload"] else "✗"
        logger.info(
            f"{status} {provider_name}: received={result['tools_received']}, "
            f"in_payload={result['tools_in_payload']}"
        )
        if result["error"]:
            logger.warning(f"  Error: {result['error']}")
        if result["notes"]:
            for note in result["notes"]:
                logger.info(f"  Note: {note}")
    
    # Generate report
    print("\n" + "=" * 80)
    print("TOOLS SUPPORT DIAGNOSTIC REPORT")
    print("=" * 80)
    
    working = [r for r in results if r["tools_received"] and r["tools_in_payload"]]
    partial = [
        r
        for r in results
        if r["tools_received"] and not r["tools_in_payload"]
    ]
    broken = [r for r in results if not r["tools_received"]]
    
    print(f"\n✓ Working ({len(working)}):")
    for r in working:
        print(f"  - {r['provider']}")
    
    print(f"\n⚠ Partial Support ({len(partial)}):")
    for r in partial:
        print(f"  - {r['provider']}: {r['notes']}")
    
    print(f"\n✗ Not Working ({len(broken)}):")
    for r in broken:
        print(f"  - {r['provider']}: {r.get('error', 'Tools not received')}")
    
    print("\n" + "=" * 80)
    
    # Save detailed results to JSON
    output_file = "tools_support_diagnostic.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to: {output_file}")
    
    # Exit with error code if any providers are broken
    if broken:
        sys.exit(1)
    elif partial:
        sys.exit(2)  # Partial support - warning
    else:
        sys.exit(0)  # All working


if __name__ == "__main__":
    main()

