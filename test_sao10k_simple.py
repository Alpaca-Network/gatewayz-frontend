"""
Simple test script to diagnose the sao10k/l3-euryale-70b model issue
"""
import asyncio
import httpx

# Use the test API key from previous logs
API_KEY = 'gw_temp_lw1xmCuEfLkKn6tsaDF3vw'

async def test_model():
    # Test the failing model
    print("[1] Testing sao10k/l3-euryale-70b...")
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                'http://localhost:8000/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {API_KEY}',
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

            print(f"Status Code: {response.status_code}")

            if response.status_code != 200:
                print(f"\n[ERROR] Error response:")
                print(response.text)
                try:
                    error_data = response.json()
                    print(f"\nError detail: {error_data.get('detail', 'No detail')}")
                except:
                    pass
            else:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                print(f"\n[OK] Success! Response: {content[:100]}")

    except Exception as e:
        print(f"[ERROR] Request error: {e}")
        import traceback
        traceback.print_exc()

    # Test the working model for comparison
    print("\n\n[2] Testing katanemo/arch-router-1.5b (known working model)...")
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                'http://localhost:8000/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {API_KEY}',
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

            print(f"Status Code: {response.status_code}")

            if response.status_code != 200:
                print(f"\n[ERROR] Error: {response.text}")
            else:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                print(f"\n[OK] Success! Response: {content[:100]}")

    except Exception as e:
        print(f"[ERROR] Request error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test_model())
