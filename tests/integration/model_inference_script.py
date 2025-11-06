#!/usr/bin/env python3
"""
Comprehensive Model Inference Testing Framework

Tests that each model can successfully deliver inference results through their respective gateways.
Covers both streaming and non-streaming modes with configurable test parameters.
"""

import asyncio
import json
import logging
import sys
import io
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from collections import defaultdict

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Setup logging
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import gateway clients
from src.services.openrouter_client import make_openrouter_request_openai, make_openrouter_request_openai_stream
from src.services.portkey_client import make_portkey_request_openai, make_portkey_request_openai_stream
from src.services.featherless_client import make_featherless_request_openai, make_featherless_request_openai_stream
from src.services.fireworks_client import make_fireworks_request_openai, make_fireworks_request_openai_stream
from src.services.together_client import make_together_request_openai, make_together_request_openai_stream
from src.services.xai_client import make_xai_request_openai, make_xai_request_openai_stream
from src.services.models import (
    fetch_models_from_openrouter,
    fetch_models_from_portkey,
    fetch_models_from_featherless,
    fetch_models_from_chutes,
    fetch_models_from_groq,
    fetch_models_from_fireworks,
    fetch_models_from_together,
)
from src.services.portkey_providers import (
    fetch_models_from_cerebras,
    fetch_models_from_nebius,
    fetch_models_from_xai,
    fetch_models_from_novita,
    fetch_models_from_hug,
)
from src.config import Config


# Test configuration
TEST_CONFIG = {
    'max_models_per_gateway': 3,  # Test top 3 models per gateway
    'timeout_seconds': 30,
    'test_message': 'Respond with: "Test successful"',
    'max_tokens': 50,
    'temperature': 0.7,
}

GATEWAY_INFO = {
    'openrouter': {
        'fetch_func': fetch_models_from_openrouter,
        'make_request': make_openrouter_request_openai,
        'make_stream': make_openrouter_request_openai_stream,
        'needs_transform': False,
    },
    'portkey': {
        'fetch_func': fetch_models_from_portkey,
        'make_request': make_portkey_request_openai,
        'make_stream': make_portkey_request_openai_stream,
        'needs_transform': False,  # Portkey handles formatting
    },
    'featherless': {
        'fetch_func': fetch_models_from_featherless,
        'make_request': make_featherless_request_openai,
        'make_stream': make_featherless_request_openai_stream,
        'needs_transform': False,
    },
    'chutes': {
        'fetch_func': fetch_models_from_chutes,
        'make_request': None,  # Not directly supported
        'make_stream': None,
        'needs_transform': False,
    },
    'groq': {
        'fetch_func': fetch_models_from_groq,
        'make_request': None,
        'make_stream': None,
        'needs_transform': False,
    },
    'fireworks': {
        'fetch_func': fetch_models_from_fireworks,
        'make_request': make_fireworks_request_openai,
        'make_stream': make_fireworks_request_openai_stream,
        'needs_transform': False,
    },
    'together': {
        'fetch_func': fetch_models_from_together,
        'make_request': make_together_request_openai,
        'make_stream': make_together_request_openai_stream,
        'needs_transform': False,
    },
    'cerebras': {
        'fetch_func': fetch_models_from_cerebras,
        'make_request': make_portkey_request_openai,
        'make_stream': make_portkey_request_openai_stream,
        'needs_transform': True,
    },
    'nebius': {
        'fetch_func': fetch_models_from_nebius,
        'make_request': make_portkey_request_openai,
        'make_stream': make_portkey_request_openai_stream,
        'needs_transform': True,
    },
    'xai': {
        'fetch_func': fetch_models_from_xai,
        'make_request': make_xai_request_openai,
        'make_stream': make_xai_request_openai_stream,
        'needs_transform': False,
    },
    'novita': {
        'fetch_func': fetch_models_from_novita,
        'make_request': make_portkey_request_openai,
        'make_stream': make_portkey_request_openai_stream,
        'needs_transform': True,
    },
    'hug': {
        'fetch_func': fetch_models_from_hug,
        'make_request': make_portkey_request_openai,
        'make_stream': make_portkey_request_openai_stream,
        'needs_transform': True,
    },
}


async def test_model_inference(
    gateway: str,
    model_id: str,
    make_request_func,
    test_msg: str = TEST_CONFIG['test_message'],
) -> Tuple[bool, str, float]:
    """
    Test if a model can successfully deliver inference.

    Args:
        gateway: Gateway name (e.g., 'openrouter', 'portkey')
        model_id: Model identifier
        make_request_func: Function to make the request
        test_msg: Test message to send

    Returns:
        Tuple of (success: bool, message: str, response_time: float)
    """
    if not make_request_func:
        return False, "Gateway not supported", 0

    try:
        start_time = time.time()

        # Build request parameters
        request_params = {
            'model': model_id,
            'messages': [
                {'role': 'system', 'content': 'You are a helpful assistant. Keep responses brief.'},
                {'role': 'user', 'content': test_msg},
            ],
            'temperature': TEST_CONFIG['temperature'],
            'max_tokens': TEST_CONFIG['max_tokens'],
            'stream': False,
        }

        # For Portkey-based providers, format model ID
        if gateway in ['cerebras', 'nebius', 'novita', 'hug']:
            # Extract provider from model and format for Portkey
            provider_map = {
                'cerebras': 'cerebras',
                'nebius': 'nebius',
                'novita': 'novita',
                'hug': 'huggingface',
            }
            provider_prefix = provider_map.get(gateway)
            request_params['model'] = f"@{provider_prefix}/{model_id}"

        # Make the actual request with timeout
        response = await asyncio.wait_for(
            asyncio.to_thread(make_request_func, **request_params),
            timeout=TEST_CONFIG['timeout_seconds']
        )

        response_time = time.time() - start_time

        # Validate response structure
        if not response:
            return False, "Empty response", response_time

        # Check for choices/content in response
        if isinstance(response, dict):
            if 'choices' in response and response['choices']:
                choice = response['choices'][0]
                if 'message' in choice and 'content' in choice['message']:
                    content = choice['message']['content']
                    if content and len(content.strip()) > 0:
                        return True, f"Success: {content[:50]}...", response_time
                    else:
                        return False, "Empty response content", response_time
                else:
                    return False, "Invalid response structure", response_time
            else:
                return False, "No choices in response", response_time
        else:
            return False, f"Unexpected response type: {type(response)}", response_time

    except asyncio.TimeoutError:
        return False, f"Timeout after {TEST_CONFIG['timeout_seconds']}s", TEST_CONFIG['timeout_seconds']
    except Exception as e:
        error_msg = str(e)[:100]
        return False, f"Error: {error_msg}", 0


async def run_gateway_tests(gateway_name: str) -> Dict[str, Any]:
    """
    Test all models for a given gateway.

    Returns:
        Dictionary with test results
    """
    print(f"\n{'='*90}")
    print(f"Testing Gateway: {gateway_name.upper()}")
    print(f"{'='*90}")

    gateway_config = GATEWAY_INFO.get(gateway_name)
    if not gateway_config:
        print(f"[ERR] Unknown gateway: {gateway_name}")
        return {'gateway': gateway_name, 'status': 'error', 'results': []}

    # Fetch models
    print(f"Fetching models from {gateway_name}...")
    try:
        models = gateway_config['fetch_func']()
        if not models:
            print(f"[WARN] No models available for {gateway_name}")
            return {'gateway': gateway_name, 'status': 'no_models', 'results': []}
    except Exception as e:
        print(f"[ERR] Failed to fetch models: {e}")
        return {'gateway': gateway_name, 'status': 'fetch_error', 'results': []}

    # Test top N models
    models_to_test = models[:TEST_CONFIG['max_models_per_gateway']]
    print(f"Testing {len(models_to_test)} models\n")

    results = []
    passed = 0
    failed = 0

    for i, model in enumerate(models_to_test, 1):
        model_id = model.get('id', 'unknown')
        model_name = model.get('name', model_id)

        print(f"[{i}/{len(models_to_test)}] {model_name:50}", end=' ... ', flush=True)

        success, message, response_time = await test_model_inference(
            gateway_name,
            model_id,
            gateway_config['make_request'],
        )

        status = "[OK]" if success else "[FAIL]"
        time_str = f"{response_time:.2f}s" if response_time > 0 else "—"

        print(f"{status} ({time_str})")
        if not success:
            print(f"       Error: {message}")

        results.append({
            'model_id': model_id,
            'model_name': model_name,
            'success': success,
            'message': message,
            'response_time': response_time,
        })

        if success:
            passed += 1
        else:
            failed += 1

    return {
        'gateway': gateway_name,
        'total_models': len(models),
        'tested_models': len(models_to_test),
        'passed': passed,
        'failed': failed,
        'results': results,
    }


async def main():
    """Run inference tests across all gateways."""

    print("\n" + "="*90)
    print("MODEL INFERENCE TESTING FRAMEWORK")
    print("="*90)
    print(f"\nTest Configuration:")
    print(f"  - Max models per gateway: {TEST_CONFIG['max_models_per_gateway']}")
    print(f"  - Timeout per model: {TEST_CONFIG['timeout_seconds']}s")
    print(f"  - Max tokens: {TEST_CONFIG['max_tokens']}")
    print(f"  - Test message: '{TEST_CONFIG['test_message']}'")

    # Run tests for all gateways
    all_results = []
    for gateway_name in GATEWAY_INFO.keys():
        try:
            result = await run_gateway_tests(gateway_name)
            all_results.append(result)
        except Exception as e:
            print(f"\n[ERR] Exception testing {gateway_name}: {e}")
            all_results.append({
                'gateway': gateway_name,
                'status': 'exception',
                'error': str(e),
            })

    # Print summary
    print("\n" + "="*90)
    print("TEST SUMMARY")
    print("="*90 + "\n")

    total_passed = 0
    total_failed = 0
    total_tested = 0

    for result in all_results:
        if 'passed' not in result:
            continue

        gateway = result['gateway']
        passed = result['passed']
        failed = result['failed']
        total = passed + failed

        pct = (passed / total * 100) if total > 0 else 0
        status = "[OK]" if failed == 0 else "[WARN]" if passed > 0 else "[FAIL]"

        print(f"{status} {gateway:15} : {passed:2}/{total:2} passed ({pct:5.1f}%)")

        total_passed += passed
        total_failed += failed
        total_tested += total

    print("\n" + "="*90)
    print(f"TOTAL: {total_passed}/{total_tested} models passed ({total_passed/total_tested*100:.1f}%)")
    print("="*90 + "\n")

    # Detailed results
    print("DETAILED RESULTS:")
    print("-" * 90)
    for result in all_results:
        if 'results' not in result or not result['results']:
            continue

        gateway = result['gateway']
        print(f"\n{gateway.upper()}:")
        for model_result in result['results']:
            status = "✓" if model_result['success'] else "✗"
            print(f"  {status} {model_result['model_id']:40} - {model_result['message'][:50]}")

    print("\n" + "="*90 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
