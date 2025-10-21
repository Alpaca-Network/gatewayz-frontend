"""
Verify Fireworks provider works correctly with lowercase normalization
Tests both direct API calls and through our backend transformation layer
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv
from src.services.model_transformations import transform_model_id

load_dotenv()

FIREWORKS_API_KEY = os.getenv('FIREWORKS_API_KEY')

def test_fireworks_direct():
    """Test Fireworks API directly"""
    print("\n" + "="*70)
    print("TEST 1: Direct Fireworks API Call")
    print("="*70)

    if not FIREWORKS_API_KEY:
        print("[ERROR] FIREWORKS_API_KEY not found in environment")
        return False

    # Test lowercase (should work)
    print("\n[1.1] Testing lowercase model ID...")
    print("Model: accounts/fireworks/models/llama-v3p1-8b-instruct")
    try:
        client = OpenAI(
            base_url='https://api.fireworks.ai/inference/v1',
            api_key=FIREWORKS_API_KEY
        )

        response = client.chat.completions.create(
            model='accounts/fireworks/models/llama-v3p1-8b-instruct',
            messages=[{"role": "user", "content": "Say 'test' and nothing else"}],
            max_tokens=10,
            timeout=30
        )

        content = response.choices[0].message.content
        print(f"[SUCCESS] Response: {content}")
        lowercase_works = True

    except Exception as e:
        print(f"[FAILED] Error: {str(e)[:200]}")
        lowercase_works = False

    # Test mixed case (should fail without normalization)
    print("\n[1.2] Testing mixed-case model ID (WITHOUT normalization)...")
    print("Model: accounts/fireworks/models/Llama-V3P1-8B-Instruct")
    try:
        client = OpenAI(
            base_url='https://api.fireworks.ai/inference/v1',
            api_key=FIREWORKS_API_KEY
        )

        response = client.chat.completions.create(
            model='accounts/fireworks/models/Llama-V3P1-8B-Instruct',
            messages=[{"role": "user", "content": "Say 'test' and nothing else"}],
            max_tokens=10,
            timeout=30
        )

        content = response.choices[0].message.content
        print(f"[UNEXPECTED] Mixed case worked: {content}")
        print("This suggests Fireworks may have changed their API!")
        mixedcase_works = True

    except Exception as e:
        error_str = str(e)
        print(f"[EXPECTED] Mixed case failed: {error_str[:200]}")
        if '404' in error_str or 'not found' in error_str.lower():
            print("[CONFIRMED] Fireworks requires lowercase (404 error as expected)")
        mixedcase_works = False

    return lowercase_works and not mixedcase_works

def test_transformation_layer():
    """Test our model transformation layer"""
    print("\n" + "="*70)
    print("TEST 2: Model Transformation Layer")
    print("="*70)

    test_cases = [
        ("accounts/fireworks/models/llama-v3p1-8b-instruct", "Already lowercase"),
        ("accounts/fireworks/models/Llama-V3P1-8B-Instruct", "Mixed case"),
        ("ACCOUNTS/FIREWORKS/MODELS/LLAMA-V3P1-8B-INSTRUCT", "All uppercase"),
    ]

    all_correct = True

    for model_id, description in test_cases:
        print(f"\n[2.{test_cases.index((model_id, description)) + 1}] {description}")
        print(f"Input:  {model_id}")

        transformed = transform_model_id(model_id, "fireworks")
        print(f"Output: {transformed}")

        # Check if output is lowercase
        is_lowercase = transformed == transformed.lower()
        print(f"Is lowercase: {is_lowercase}")

        if is_lowercase:
            print("[PASS] Transformation correct")
        else:
            print("[FAIL] Transformation should convert to lowercase!")
            all_correct = False

    return all_correct

def test_backend_integration():
    """Test through backend API (if available)"""
    print("\n" + "="*70)
    print("TEST 3: Backend API Integration")
    print("="*70)

    try:
        import httpx
        import asyncio

        async def test_backend():
            # Check if backend is running
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get('http://localhost:8000/health', timeout=5)
                    if response.status_code != 200:
                        print("[SKIP] Backend not healthy")
                        return None
            except:
                print("[SKIP] Backend not running at localhost:8000")
                return None

            print("\n[3.1] Testing mixed-case model through backend...")
            print("Model: accounts/fireworks/models/Llama-V3P1-8B-Instruct")
            print("Provider: fireworks")

            # This should work because our transformation layer normalizes to lowercase
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        'http://localhost:8000/v1/chat/completions',
                        headers={
                            'Authorization': 'Bearer gw_temp_lw1xmCuEfLkKn6tsaDF3vw',
                            'Content-Type': 'application/json'
                        },
                        json={
                            'model': 'accounts/fireworks/models/Llama-V3P1-8B-Instruct',
                            'provider': 'fireworks',
                            'messages': [{'role': 'user', 'content': 'Say test'}],
                            'max_tokens': 10,
                            'stream': False
                        },
                        timeout=30
                    )

                    if response.status_code == 200:
                        data = response.json()
                        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                        print(f"[SUCCESS] Mixed case model worked through backend!")
                        print(f"Response: {content}")
                        print("[CONFIRMED] Normalization is working in production flow!")
                        return True
                    elif response.status_code == 429:
                        print("[SKIP] Plan limit exceeded")
                        return None
                    else:
                        error_data = response.json()
                        print(f"[FAILED] Status {response.status_code}: {error_data.get('detail', 'Unknown error')}")
                        return False

            except Exception as e:
                print(f"[ERROR] {type(e).__name__}: {str(e)[:200]}")
                return False

        result = asyncio.run(test_backend())
        return result

    except ImportError:
        print("[SKIP] httpx or asyncio not available")
        return None

def main():
    print("\n" + "="*70)
    print("FIREWORKS PROVIDER VERIFICATION TEST")
    print("="*70)

    results = {}

    # Test 1: Direct API
    results['direct_api'] = test_fireworks_direct()

    # Test 2: Transformation layer
    results['transformation'] = test_transformation_layer()

    # Test 3: Backend integration
    results['backend'] = test_backend_integration()

    # Summary
    print("\n\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)

    print("\n[Test Results]")
    for test_name, result in results.items():
        if result is True:
            status = "[PASS]"
        elif result is False:
            status = "[FAIL]"
        else:
            status = "[SKIP]"

        print(f"{status} {test_name.replace('_', ' ').title()}")

    # Overall verdict
    print("\n" + "="*70)

    critical_tests = [results['direct_api'], results['transformation']]
    critical_passed = all(r is True for r in critical_tests if r is not None)

    if critical_passed:
        print("✅ VERDICT: Fireworks is working correctly!")
        print("   - Lowercase model IDs work")
        print("   - Mixed case fails (as expected)")
        print("   - Transformation layer normalizes to lowercase")
        if results['backend'] is True:
            print("   - Backend integration confirmed working")
        return 0
    else:
        print("❌ VERDICT: Issues detected with Fireworks!")
        print("   Check the test output above for details")
        return 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
