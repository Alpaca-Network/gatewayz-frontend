"""
Chat Diagnostics Script
Tests the entire chat flow to identify where it's failing
"""
import sys
import os

# Add src to path
sys.path.insert(0, 'src')

import asyncio
import httpx
from dotenv import load_dotenv

# Load environment
load_dotenv()

async def test_chat_endpoint():
    """Test the chat endpoint with a valid request"""
    print("=" * 80)
    print("CHAT ENDPOINT DIAGNOSTICS")
    print("=" * 80)

    # Test 1: Check backend is running
    print("\n[TEST 1] Checking if backend is running...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8000/health", timeout=5)
            print(f"✓ Backend is running (status: {response.status_code})")
            health = response.json()
            print(f"  - Database: {health.get('database', 'unknown')}")
            print(f"  - OpenRouter: {health.get('openrouter', 'unknown')}")
    except Exception as e:
        print(f"✗ Backend not responding: {e}")
        return

    # Test 2: Check database connection
    print("\n[TEST 2] Checking database...")
    try:
        from src.database import get_supabase_client
        client = get_supabase_client()
        result = client.table('users').select('id').limit(1).execute()
        print(f"✓ Database connected ({len(result.data)} users found)")
    except Exception as e:
        print(f"✗ Database error: {e}")

    # Test 3: Get a valid API key
    print("\n[TEST 3] Getting valid API key...")
    try:
        from src.database import get_supabase_client
        client = get_supabase_client()

        # Get first active API key
        result = client.table('api_keys_new').select('api_key,user_id').eq('is_active', True).limit(1).execute()
        if not result.data:
            print("✗ No active API keys found!")
            return

        api_key = result.data[0]['api_key']
        user_id = result.data[0]['user_id']
        print(f"✓ Found API key for user {user_id}: {api_key[:20]}...")

    except Exception as e:
        print(f"✗ Failed to get API key: {e}")
        return

    # Test 4: Test chat completions endpoint
    print("\n[TEST 4] Testing chat completions endpoint...")
    test_cases = [
        {
            "name": "Simple GPT-4O request (OpenRouter)",
            "model": "gpt-4o",
            "message": "Say 'test successful' if you can read this."
        },
        {
            "name": "DeepSeek request (Fireworks)",
            "model": "deepseek-ai/deepseek-r1-distill-llama-70b",
            "message": "Say 'test successful' if you can read this."
        },
        {
            "name": "OpenRouter auto model",
            "model": "openrouter/auto",
            "message": "Say 'test successful' if you can read this."
        }
    ]

    for test in test_cases:
        print(f"\n  Testing: {test['name']}")
        print(f"  Model: {test['model']}")

        try:
            async with httpx.AsyncClient() as http_client:
                response = await http_client.post(
                    "http://localhost:8000/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": test['model'],
                        "messages": [{"role": "user", "content": test['message']}],
                        "stream": False,
                        "max_tokens": 50
                    },
                    timeout=30
                )

                print(f"  Status: {response.status_code}")

                if response.status_code == 200:
                    data = response.json()
                    content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                    print(f"  ✓ SUCCESS")
                    print(f"  Response preview: {content[:100]}...")
                else:
                    print(f"  ✗ FAILED")
                    try:
                        error_data = response.json()
                        print(f"  Error: {error_data}")
                    except:
                        print(f"  Error text: {response.text}")

        except Exception as e:
            print(f"  ✗ EXCEPTION: {e}")
            import traceback
            traceback.print_exc()

    # Test 5: Check model transformation
    print("\n[TEST 5] Testing model transformation...")
    try:
        from src.services.model_transformations import detect_provider_from_model_id, transform_model_id

        test_models = [
            "gpt-4o",
            "deepseek-ai/deepseek-r1-distill-llama-70b",
            "openrouter/auto",
            "anthropic/claude-3-5-sonnet-20241022"
        ]

        for model in test_models:
            provider = detect_provider_from_model_id(model)
            transformed = transform_model_id(model, provider)
            print(f"  {model}")
            print(f"    → Provider: {provider}")
            print(f"    → Transformed: {transformed}")

    except Exception as e:
        print(f"✗ Model transformation error: {e}")
        import traceback
        traceback.print_exc()

    # Test 6: Check environment variables
    print("\n[TEST 6] Checking environment variables...")
    required_vars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'OPENROUTER_API_KEY',
        'FIREWORKS_API_KEY',
        'TOGETHER_API_KEY'
    ]

    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"  ✓ {var}: {value[:20]}...")
        else:
            print(f"  ✗ {var}: NOT SET")

    print("\n" + "=" * 80)
    print("DIAGNOSTICS COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_chat_endpoint())
