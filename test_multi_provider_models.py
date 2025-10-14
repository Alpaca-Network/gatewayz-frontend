#!/usr/bin/env python3
"""
Test script for multi-provider model endpoint enhancement
Tests the /catalog/model/{provider_name}/{model_name} endpoint with different gateways
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL - adjust as needed
BASE_URL = "http://localhost:8000"

# Test cases for different providers
TEST_CASES = [
    {
        "name": "OpenRouter - GPT-4",
        "provider": "openai",
        "model": "gpt-4",
        "gateway": "openrouter",
        "description": "Test OpenRouter with OpenAI GPT-4"
    },
    {
        "name": "OpenRouter - Claude 3",
        "provider": "anthropic",
        "model": "claude-3-opus",
        "gateway": "openrouter",
        "description": "Test OpenRouter with Anthropic Claude"
    },
    {
        "name": "Portkey - GPT-4",
        "provider": "openai",
        "model": "gpt-4",
        "gateway": "portkey",
        "description": "Test Portkey gateway"
    },
    {
        "name": "Featherless - Llama 3",
        "provider": "meta-llama",
        "model": "llama-3.1-8b",
        "gateway": "featherless",
        "description": "Test Featherless gateway"
    },
    {
        "name": "DeepInfra - Llama 3.1",
        "provider": "meta-llama",
        "model": "Meta-Llama-3.1-8B-Instruct",
        "gateway": "deepinfra",
        "description": "Test DeepInfra gateway"
    },
    {
        "name": "Chutes - Stable Diffusion",
        "provider": "stability-ai",
        "model": "sdxl",
        "gateway": "chutes",
        "description": "Test Chutes gateway"
    },
    {
        "name": "Auto-detect - GPT-4",
        "provider": "openai",
        "model": "gpt-4",
        "gateway": None,
        "description": "Test auto-detection (no gateway specified)"
    }
]


def test_model_endpoint(
    provider: str,
    model: str,
    gateway: Optional[str] = None,
    include_huggingface: bool = True
) -> Dict[str, Any]:
    """
    Test the model endpoint with given parameters
    
    Args:
        provider: Provider name (e.g., 'openai', 'anthropic')
        model: Model name (e.g., 'gpt-4', 'claude-3')
        gateway: Optional gateway parameter
        include_huggingface: Include HuggingFace metrics
        
    Returns:
        Response data dictionary
    """
    url = f"{BASE_URL}/catalog/model/{provider}/{model}"
    params = {"include_huggingface": str(include_huggingface).lower()}
    
    if gateway:
        params["gateway"] = gateway
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        return {
            "success": True,
            "status_code": response.status_code,
            "data": response.json()
        }
    except requests.exceptions.HTTPError as e:
        return {
            "success": False,
            "status_code": e.response.status_code if e.response else None,
            "error": str(e),
            "response_text": e.response.text if e.response else None
        }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "status_code": None,
            "error": str(e)
        }


def print_result(test_case: Dict[str, Any], result: Dict[str, Any]):
    """Print test result in a formatted way"""
    print(f"\n{'='*80}")
    print(f"Test: {test_case['name']}")
    print(f"Description: {test_case['description']}")
    print(f"URL: /catalog/model/{test_case['provider']}/{test_case['model']}")
    if test_case['gateway']:
        print(f"Gateway: {test_case['gateway']}")
    else:
        print(f"Gateway: Auto-detect")
    print(f"{'='*80}")
    
    if result['success']:
        print(f"✅ SUCCESS (Status: {result['status_code']})")
        
        data = result['data']
        print(f"\nResponse Summary:")
        print(f"  - Provider: {data.get('provider')}")
        print(f"  - Model: {data.get('model')}")
        print(f"  - Gateway Used: {data.get('gateway')}")
        print(f"  - Timestamp: {data.get('timestamp')}")
        
        model_data = data.get('data', {})
        print(f"\nModel Data:")
        print(f"  - ID: {model_data.get('id')}")
        print(f"  - Name: {model_data.get('name')}")
        print(f"  - Description: {model_data.get('description', 'N/A')[:100]}...")
        print(f"  - Provider Slug: {model_data.get('provider_slug')}")
        print(f"  - Source Gateway: {model_data.get('source_gateway')}")
        print(f"  - Context Length: {model_data.get('context_length', 'N/A')}")
        
        pricing = model_data.get('pricing', {})
        if pricing:
            print(f"\nPricing:")
            print(f"  - Prompt: ${pricing.get('prompt', 'N/A')}/1M tokens")
            print(f"  - Completion: ${pricing.get('completion', 'N/A')}/1M tokens")
        
        if 'huggingface_metrics' in model_data:
            hf_metrics = model_data['huggingface_metrics']
            print(f"\nHuggingFace Metrics:")
            print(f"  - Downloads: {hf_metrics.get('downloads', 'N/A'):,}")
            print(f"  - Likes: {hf_metrics.get('likes', 'N/A'):,}")
            print(f"  - Pipeline Tag: {hf_metrics.get('pipeline_tag', 'N/A')}")
        
        # Show enhanced fields
        if model_data.get('provider_site_url'):
            print(f"\nEnhanced Fields:")
            print(f"  - Provider URL: {model_data.get('provider_site_url')}")
            print(f"  - Logo URL: {model_data.get('model_logo_url')}")
    else:
        print(f"❌ FAILED (Status: {result.get('status_code', 'N/A')})")
        print(f"Error: {result.get('error')}")
        if result.get('response_text'):
            try:
                error_data = json.loads(result['response_text'])
                print(f"Detail: {error_data.get('detail', 'No details available')}")
            except:
                print(f"Response: {result['response_text'][:200]}")


def test_all_providers():
    """Run all test cases"""
    print("="*80)
    print("Multi-Provider Model Endpoint Test Suite")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Total Tests: {len(TEST_CASES)}")
    
    results = []
    successful = 0
    failed = 0
    
    for test_case in TEST_CASES:
        result = test_model_endpoint(
            provider=test_case['provider'],
            model=test_case['model'],
            gateway=test_case['gateway']
        )
        
        print_result(test_case, result)
        results.append({
            "test_case": test_case,
            "result": result
        })
        
        if result['success']:
            successful += 1
        else:
            failed += 1
    
    # Print summary
    print(f"\n{'='*80}")
    print("Test Summary")
    print(f"{'='*80}")
    print(f"Total: {len(TEST_CASES)}")
    print(f"✅ Passed: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(successful/len(TEST_CASES)*100):.1f}%")
    
    if failed > 0:
        print(f"\n⚠️  Some tests failed. Check the output above for details.")
        print(f"Common issues:")
        print(f"  - API keys not configured in .env file")
        print(f"  - Model not available in specified gateway")
        print(f"  - Gateway API temporarily unavailable")
        print(f"  - Network connectivity issues")
    
    return successful == len(TEST_CASES)


def test_single_model(provider: str, model: str, gateway: Optional[str] = None):
    """Test a single model"""
    test_case = {
        "name": f"Custom Test - {provider}/{model}",
        "provider": provider,
        "model": model,
        "gateway": gateway,
        "description": f"Custom test for {provider}/{model}"
    }
    
    result = test_model_endpoint(provider, model, gateway)
    print_result(test_case, result)
    
    return result['success']


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Custom test mode
        if len(sys.argv) < 3:
            print("Usage: python test_multi_provider_models.py <provider> <model> [gateway]")
            print("Example: python test_multi_provider_models.py openai gpt-4 openrouter")
            sys.exit(1)
        
        provider = sys.argv[1]
        model = sys.argv[2]
        gateway = sys.argv[3] if len(sys.argv) > 3 else None
        
        success = test_single_model(provider, model, gateway)
        sys.exit(0 if success else 1)
    else:
        # Run all tests
        success = test_all_providers()
        sys.exit(0 if success else 1)

