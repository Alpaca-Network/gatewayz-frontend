#!/usr/bin/env python3
"""
Simplified Model Inference Testing Framework v2

Tests models through the actual HTTP API endpoints instead of direct function calls.
This is more realistic as it tests the full request/response pipeline.
"""

import asyncio
import json
import sys
import io
import time
from typing import List, Dict, Any, Tuple
import httpx

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Get API key from environment or use test key
import os
TEST_API_KEY = os.getenv('GATEWAYZ_API_KEY', 'test-key')
API_BASE_URL = os.getenv('GATEWAYZ_API_URL', 'http://localhost:8000')

# Test configuration
TEST_CONFIG = {
    'max_models_per_gateway': 2,
    'timeout_seconds': 30,
    'test_message': 'Say "OK"',
    'max_tokens': 20,
    'temperature': 0.1,
}

GATEWAY_INFO = {
    'openrouter': {'testable': True, 'description': 'OpenRouter Gateway'},
    'portkey': {'testable': True, 'description': 'Portkey Gateway'},
    'featherless': {'testable': True, 'description': 'Featherless AI'},
    'chutes': {'testable': False, 'description': 'Chutes.ai (no inference client)'},
    'groq': {'testable': False, 'description': 'Groq (no inference client)'},
    'fireworks': {'testable': True, 'description': 'Fireworks AI'},
    'together': {'testable': True, 'description': 'Together AI'},
    'google': {'testable': True, 'description': 'Google (via Portkey)'},
    'cerebras': {'testable': True, 'description': 'Cerebras (via Portkey)'},
    'nebius': {'testable': True, 'description': 'Nebius (via Portkey)'},
    'xai': {'testable': True, 'description': 'Xai (via Portkey)'},
    'novita': {'testable': True, 'description': 'Novita (via Portkey)'},
    'hug': {'testable': True, 'description': 'Hugging Face (via Portkey)'},
}


async def test_model_via_api(
    model_id: str,
    gateway: str = 'openrouter',
) -> Tuple[bool, str, float]:
    """
    Test if a model can deliver inference via the API endpoint.

    Returns:
        Tuple of (success: bool, message: str, response_time: float)
    """
    try:
        start_time = time.time()

        async with httpx.AsyncClient(timeout=TEST_CONFIG['timeout_seconds']) as client:
            response = await client.post(
                f"{API_BASE_URL}/v1/chat/completions",
                json={
                    "model": model_id,
                    "messages": [
                        {"role": "system", "content": "Keep responses very short."},
                        {"role": "user", "content": TEST_CONFIG['test_message']},
                    ],
                    "temperature": TEST_CONFIG['temperature'],
                    "max_tokens": TEST_CONFIG['max_tokens'],
                    "stream": False,
                },
                headers={
                    "Authorization": f"Bearer {TEST_API_KEY}",
                    "Content-Type": "application/json",
                },
            )

        response_time = time.time() - start_time

        if response.status_code == 200:
            try:
                data = response.json()
                if 'choices' in data and data['choices'] and 'message' in data['choices'][0]:
                    content = data['choices'][0]['message'].get('content', '')
                    if content and len(content.strip()) > 0:
                        return True, f"Success: {content[:40].strip()}...", response_time
                return False, f"Invalid response structure", response_time
            except json.JSONDecodeError:
                return False, "Failed to parse response JSON", response_time
        elif response.status_code == 401:
            return False, "Unauthorized (check API key)", response_time
        elif response.status_code == 404:
            return False, f"Model not found (404)", response_time
        elif response.status_code == 400:
            try:
                error = response.json().get('error', {})
                msg = error.get('message', str(response.text[:50]))
                return False, f"Bad request: {msg[:40]}", response_time
            except:
                return False, f"Bad request: {str(response.text[:40])}", response_time
        elif response.status_code == 429:
            return False, "Rate limited (429)", response_time
        elif response.status_code == 500:
            return False, "Server error (500)", response_time
        elif response.status_code == 503:
            return False, "Service unavailable (503)", response_time
        else:
            return False, f"HTTP {response.status_code}: {str(response.text[:30])}", response_time

    except asyncio.TimeoutError:
        return False, f"Timeout after {TEST_CONFIG['timeout_seconds']}s", TEST_CONFIG['timeout_seconds']
    except Exception as e:
        error_msg = str(e)[:50]
        return False, f"Error: {error_msg}", 0


async def fetch_models_for_gateway(gateway: str) -> List[Dict[str, Any]]:
    """Fetch models for a gateway via the API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{API_BASE_URL}/models",
                params={"gateway": gateway, "limit": TEST_CONFIG['max_models_per_gateway']},
                headers={"Authorization": f"Bearer {TEST_API_KEY}"},
            )

        if response.status_code == 200:
            data = response.json()
            return data.get('data', [])
        else:
            return []
    except Exception as e:
        print(f"  [ERROR] Failed to fetch models: {e}")
        return []


async def run_gateway_tests(gateway_name: str) -> Dict[str, Any]:
    """Test all models for a given gateway."""

    gateway_config = GATEWAY_INFO.get(gateway_name, {})
    if not gateway_config.get('testable', False):
        print(f"\n[SKIP] {gateway_name.upper():15} - {gateway_config.get('description', 'N/A')}")
        return {
            'gateway': gateway_name,
            'status': 'skipped',
            'reason': 'No inference client available',
            'results': [],
        }

    print(f"\n{'='*90}")
    print(f"Testing Gateway: {gateway_name.upper():15} - {gateway_config.get('description', 'N/A')}")
    print(f"{'='*90}")

    # Fetch models
    print(f"Fetching models from {gateway_name} API...")
    models = await fetch_models_for_gateway(gateway_name)

    if not models:
        print(f"[WARN] No models available for {gateway_name}")
        return {
            'gateway': gateway_name,
            'status': 'no_models',
            'results': [],
        }

    print(f"Testing {len(models)} models\n")

    results = []
    passed = 0
    failed = 0

    for i, model in enumerate(models, 1):
        model_id = model.get('id', 'unknown')
        model_name = model.get('name', model_id)

        print(f"[{i}/{len(models)}] {model_name:50}", end=' ... ', flush=True)

        success, message, response_time = await test_model_via_api(model_id, gateway_name)

        status = "[OK]" if success else "[FAIL]"
        time_str = f"{response_time:.2f}s" if response_time > 0 else "—"

        print(f"{status} ({time_str})")
        if not success:
            print(f"       {message[:70]}")

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
        'total_tested': len(models),
        'passed': passed,
        'failed': failed,
        'results': results,
    }


async def main():
    """Run inference tests across testable gateways."""

    print("\n" + "="*90)
    print("MODEL INFERENCE TESTING FRAMEWORK v2 (Via API Endpoints)")
    print("="*90)
    print(f"\nConfiguration:")
    print(f"  API Base URL:  {API_BASE_URL}")
    print(f"  API Key:       {TEST_API_KEY[:10]}{'*' * 10 if len(TEST_API_KEY) > 10 else ''}")
    print(f"  Timeout:       {TEST_CONFIG['timeout_seconds']}s")
    print(f"  Max tokens:    {TEST_CONFIG['max_tokens']}")
    print(f"  Test message:  '{TEST_CONFIG['test_message']}'")

    # Check if API is reachable
    print(f"\nChecking API connectivity...")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{API_BASE_URL}/health", headers={"Authorization": f"Bearer {TEST_API_KEY}"})
        if response.status_code in [200, 404, 401]:
            print(f"[OK] API is reachable")
        else:
            print(f"[WARN] API responded with status {response.status_code}")
    except Exception as e:
        print(f"[WARN] Could not reach API at {API_BASE_URL}: {e}")
        print(f"       Make sure the backend is running on {API_BASE_URL}")

    # Run tests
    all_results = []
    testable_gateways = [gw for gw, cfg in GATEWAY_INFO.items() if cfg.get('testable', False)]
    skipped_gateways = [gw for gw, cfg in GATEWAY_INFO.items() if not cfg.get('testable', False)]

    print(f"\nTestable gateways: {len(testable_gateways)}")
    print(f"Skipped gateways:  {len(skipped_gateways)}")

    for gateway_name in testable_gateways:
        try:
            result = await run_gateway_tests(gateway_name)
            all_results.append(result)
            await asyncio.sleep(0.5)  # Rate limiting
        except Exception as e:
            print(f"\n[ERR] Exception testing {gateway_name}: {e}")
            all_results.append({
                'gateway': gateway_name,
                'status': 'exception',
                'error': str(e),
            })

    # Summary
    print("\n" + "="*90)
    print("TEST SUMMARY")
    print("="*90 + "\n")

    total_passed = 0
    total_failed = 0
    total_tested = 0

    for result in all_results:
        if result.get('status') in ['skipped', 'no_models', 'exception']:
            continue

        gateway = result['gateway']
        passed = result.get('passed', 0)
        failed = result.get('failed', 0)
        total = passed + failed

        if total == 0:
            continue

        pct = (passed / total * 100) if total > 0 else 0
        status = "[OK]" if failed == 0 else "[WARN]" if passed > 0 else "[FAIL]"

        print(f"{status} {gateway:15} : {passed:2}/{total:2} passed ({pct:5.1f}%)")

        total_passed += passed
        total_failed += failed
        total_tested += total

    print("\n" + "="*90)
    if total_tested > 0:
        print(f"TOTAL: {total_passed}/{total_tested} models passed ({total_passed/total_tested*100:.1f}%)")
    else:
        print(f"NO MODELS TESTED")
    print("="*90 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
