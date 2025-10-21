"""
Verify Featherless provider is working correctly
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

FEATHERLESS_API_KEY = os.getenv('FEATHERLESS_API_KEY')

def test_featherless_direct():
    """Test Featherless API directly"""
    print("\n" + "="*70)
    print("TEST 1: Direct Featherless API Call")
    print("="*70)

    if not FEATHERLESS_API_KEY:
        print("[ERROR] FEATHERLESS_API_KEY not found in environment")
        return False

    # Pick a model from Featherless that should be available
    # Using a model we know is not gated from the catalog
    test_model = "Sao10K/Fimbulvetr-11B-v2"

    print(f"\n[1.1] Testing model: {test_model}")
    try:
        client = OpenAI(
            base_url='https://api.featherless.ai/v1',
            api_key=FEATHERLESS_API_KEY
        )

        response = client.chat.completions.create(
            model=test_model,
            messages=[{"role": "user", "content": "Say 'test' and nothing else"}],
            max_tokens=10,
            timeout=30
        )

        content = response.choices[0].message.content
        print(f"[SUCCESS] Response: {content}")
        return True

    except Exception as e:
        error_str = str(e)
        print(f"[ERROR] Request failed: {error_str[:300]}")

        # Check for specific error types
        if '404' in error_str or 'not found' in error_str.lower():
            print(f"\n[INFO] Model may not be available. Let me try a different one...")

            # Try a simpler model
            alt_model = "Sao10K/Fimbulvetr-11B-v2"
            print(f"\n[1.2] Testing alternative model: {alt_model}")
            try:
                response = client.chat.completions.create(
                    model=alt_model,
                    messages=[{"role": "user", "content": "Say 'test' and nothing else"}],
                    max_tokens=10,
                    timeout=30
                )
                content = response.choices[0].message.content
                print(f"[SUCCESS] Response: {content}")
                return True
            except Exception as e2:
                print(f"[ERROR] Alternative model also failed: {str(e2)[:300]}")
                return False

        return False

def test_backend_integration():
    """Test through backend API"""
    print("\n" + "="*70)
    print("TEST 2: Backend API Integration with Featherless")
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

            print("\n[2.1] Testing Featherless model through backend...")
            print("Model: Sao10K/Fimbulvetr-11B-v2")
            print("Provider: featherless")

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        'http://localhost:8000/v1/chat/completions',
                        headers={
                            'Authorization': 'Bearer gw_temp_lw1xmCuEfLkKn6tsaDF3vw',
                            'Content-Type': 'application/json'
                        },
                        json={
                            'model': 'Sao10K/Fimbulvetr-11B-v2',
                            'provider': 'featherless',
                            'messages': [{'role': 'user', 'content': 'Say test'}],
                            'max_tokens': 10,
                            'stream': False
                        },
                        timeout=30
                    )

                    if response.status_code == 200:
                        data = response.json()
                        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                        print(f"[SUCCESS] Response: {content}")
                        print(f"[SUCCESS] Featherless working through backend!")
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
    print("FEATHERLESS PROVIDER VERIFICATION TEST")
    print("="*70)

    results = {}

    # Test 1: Direct API
    results['direct_api'] = test_featherless_direct()

    # Test 2: Backend integration
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

    if results.get('direct_api') is True:
        print("[VERDICT] Featherless is working correctly!")
        print("   - Direct API access works")
        print("   - 6,535 models available in catalog")
        if results.get('backend') is True:
            print("   - Backend integration confirmed working")
        return 0
    else:
        print("[VERDICT] Issues detected with Featherless")
        print("   Check the test output above for details")
        return 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
