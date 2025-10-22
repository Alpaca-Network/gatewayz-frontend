"""
End-to-end test: Verify case normalization works through the entire request flow
Tests the backend API with mixed-case model IDs to ensure they're normalized correctly
"""
import asyncio
import httpx
import sys

# Use a known test API key (or get from environment)
API_KEY = 'gw_temp_lw1xmCuEfLkKn6tsaDF3vw'
BASE_URL = 'http://localhost:8000'

async def test_model_with_case(model_id: str, provider: str = None, description: str = ""):
    """Test a model ID through the backend API"""
    print(f"\n{'='*70}")
    print(f"Testing: {description}")
    print(f"Model ID: {model_id}")
    if provider:
        print(f"Provider: {provider}")
    print(f"{'='*70}")

    try:
        async with httpx.AsyncClient() as client:
            payload = {
                'model': model_id,
                'messages': [{'role': 'user', 'content': 'Say "test" and nothing else'}],
                'stream': False,
                'max_tokens': 10
            }

            if provider:
                payload['provider'] = provider

            response = await client.post(
                f'{BASE_URL}/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {API_KEY}',
                    'Content-Type': 'application/json'
                },
                json=payload,
                timeout=60
            )

            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                print(f"[SUCCESS] Status: {response.status_code}")
                print(f"Response: {content[:100]}")

                # Check which provider was actually used (from gateway_usage)
                gateway_usage = data.get('gateway_usage', {})
                print(f"Gateway usage: {gateway_usage}")

                return {'status': 'success', 'response': content, 'code': 200}

            elif response.status_code == 429:
                print(f"[SKIP] Plan limit exceeded (429)")
                try:
                    error_data = response.json()
                    print(f"Detail: {error_data.get('detail', 'No detail')}")
                except:
                    pass
                return {'status': 'skipped', 'reason': 'Plan limit exceeded', 'code': 429}

            else:
                print(f"[ERROR] Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error detail: {error_data.get('detail', 'No detail')}")

                    # Check if it's a case-related error
                    detail = str(error_data.get('detail', '')).lower()
                    if 'not found' in detail or 'invalid' in detail or 'not a valid' in detail:
                        print("WARNING: This appears to be a model ID validation error (possibly case-related)")

                    return {'status': 'failed', 'error': error_data.get('detail'), 'code': response.status_code}
                except:
                    print(f"Raw response: {response.text[:200]}")
                    return {'status': 'failed', 'error': response.text[:200], 'code': response.status_code}

    except Exception as e:
        print(f"[EXCEPTION] {type(e).__name__}: {str(e)[:200]}")
        return {'status': 'exception', 'error': str(e)[:200]}

async def main():
    print("\n" + "="*70)
    print("END-TO-END CASE SENSITIVITY TEST")
    print("Testing mixed-case model IDs through backend API")
    print("="*70)

    # Test cases: (model_id_lowercase, model_id_mixedcase, provider, description)
    test_cases = [
        # OpenRouter models (case insensitive according to our tests)
        (
            'meta-llama/llama-3.1-8b-instruct',
            'Meta-Llama/Llama-3.1-8B-Instruct',
            'openrouter',
            'OpenRouter: Llama 3.1 8B (mixed case)'
        ),
        (
            'sao10k/l3-euryale-70b',
            'Sao10K/L3-Euryale-70B',
            'openrouter',
            'OpenRouter: Sao10k Euryale (mixed case)'
        ),

        # HuggingFace models
        (
            'katanemo/arch-router-1.5b',
            'Katanemo/Arch-Router-1.5B',
            'huggingface',
            'HuggingFace: Arch Router (mixed case)'
        ),

        # Fireworks models (REQUIRES lowercase)
        (
            'accounts/fireworks/models/llama-v3p1-8b-instruct',
            'accounts/fireworks/models/Llama-V3P1-8B-Instruct',
            'fireworks',
            'Fireworks: Llama 3.1 8B (mixed case) - SHOULD WORK with normalization'
        ),

        # Together models (case insensitive according to our tests)
        (
            'meta-llama/meta-llama-3.1-8b-instruct-turbo',
            'Meta-Llama/Meta-Llama-3.1-8B-Instruct-Turbo',
            'together',
            'Together: Llama 3.1 Turbo (mixed case)'
        ),
    ]

    results = []

    for lowercase, mixedcase, provider, description in test_cases:
        # Test lowercase version
        print("\n" + "-"*70)
        print(f"Test 1: LOWERCASE version")
        result_lower = await test_model_with_case(lowercase, provider, f"{description} [lowercase]")

        # Test mixed case version
        print("\n" + "-"*70)
        print(f"Test 2: MIXED CASE version")
        result_mixed = await test_model_with_case(mixedcase, provider, f"{description} [mixed case]")

        results.append({
            'description': description,
            'provider': provider,
            'lowercase_result': result_lower,
            'mixedcase_result': result_mixed,
            'lowercase_model': lowercase,
            'mixedcase_model': mixedcase
        })

        # Small delay to avoid rate limiting
        await asyncio.sleep(1)

    # Print summary
    print("\n\n" + "="*70)
    print("SUMMARY OF RESULTS")
    print("="*70)

    for result in results:
        print(f"\n{result['description']}")
        print(f"Provider: {result['provider']}")
        print(f"  Lowercase ({result['lowercase_model']}): {result['lowercase_result']['status']} (HTTP {result['lowercase_result'].get('code', 'N/A')})")
        print(f"  Mixed case ({result['mixedcase_model']}): {result['mixedcase_result']['status']} (HTTP {result['mixedcase_result'].get('code', 'N/A')})")

        # Analyze if case normalization is working
        lower_success = result['lowercase_result']['status'] == 'success'
        mixed_success = result['mixedcase_result']['status'] == 'success'
        both_skipped = result['lowercase_result']['status'] == 'skipped' and result['mixedcase_result']['status'] == 'skipped'

        if both_skipped:
            print(f"  [INFO] Both skipped (plan limit) - Cannot test case sensitivity")
        elif lower_success and mixed_success:
            print(f"  [PASS] Both lowercase and mixed case work (normalization working!)")
        elif lower_success and not mixed_success:
            print(f"  [WARNING] Lowercase works but mixed case fails (normalization may not be working)")
        elif not lower_success and mixed_success:
            print(f"  [UNEXPECTED] Mixed case works but lowercase fails")
        else:
            print(f"  [FAIL] Both failed - may be other issue (not case-related)")

    print("\n" + "="*70)
    print("TEST COMPLETE")
    print("="*70)

if __name__ == '__main__':
    asyncio.run(main())
