"""
Test script to diagnose the sao10k/l3-euryale-70b model issue
"""
import sys
sys.path.insert(0, 'src')

import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test_model():
    # Get API key from database
    print("[1] Getting API key from database...")
    try:
        from src.database import get_supabase_client
        client = get_supabase_client()
        result = client.table('api_keys_new').select('api_key,user_id').eq('is_active', True).limit(1).execute()
        if not result.data:
            print("[ERROR] No API keys found")
            return
        api_key = result.data[0]['api_key']
        user_id = result.data[0]['user_id']
        print(f"[OK] Found key for user {user_id}")
    except Exception as e:
        print(f"[ERROR] Database error: {e}")
        import traceback
        traceback.print_exc()
        return

    # Test the failing model
    print("\n[2] Testing sao10k/l3-euryale-70b...")
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                'http://localhost:8000/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'sao10k/l3-euryale-70b',
                    'messages': [{'role': 'user', 'content': 'hi'}],
                    'stream': False,
                    'max_tokens': 50
                },
                timeout=30
            )

            print(f"Status: {response.status_code}")

            if response.status_code != 200:
                print(f"[ERROR] Error response:")
                print(response.text)
                try:
                    error_data = response.json()
                    print(f"Error detail: {error_data.get('detail', 'No detail')}")
                except:
                    pass
            else:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                print(f"[OK] Success! Response: {content[:100]}")

    except Exception as e:
        print(f"[ERROR] Request error: {e}")
        import traceback
        traceback.print_exc()

    # Test the working model for comparison
    print("\n[3] Testing katanemo/arch-router-1.5b (known working model)...")
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                'http://localhost:8000/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'katanemo/arch-router-1.5b',
                    'messages': [{'role': 'user', 'content': 'hi'}],
                    'stream': False,
                    'max_tokens': 50
                },
                timeout=30
            )

            print(f"Status: {response.status_code}")

            if response.status_code != 200:
                print(f"[ERROR] Error: {response.text}")
            else:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                print(f"[OK] Success! Response: {content[:100]}")

    except Exception as e:
        print(f"[ERROR] Request error: {e}")

asyncio.run(test_model())
