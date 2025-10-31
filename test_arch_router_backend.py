"""
Test Arch Router through our backend
"""
import httpx
import asyncio
import json

async def test_arch_router_backend():
    """Test Arch Router via our backend on port 8001"""
    print("\n" + "="*70)
    print("Testing katanemo/arch-router-1.5b through Backend (Port 8000)")
    print("="*70)

    # Test non-streaming
    print(f"\n[1] Testing non-streaming request...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'http://localhost:8000/v1/chat/completions',
                headers={
                    'Authorization': 'Bearer gw_temp_lw1xmCuEfLkKn6tsaDF3vw',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'katanemo/arch-router-1.5b',
                    'messages': [{'role': 'user', 'content': 'Say test'}],
                    'max_tokens': 10,
                    'stream': False
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                print(f"[SUCCESS] Non-streaming response: {content}")
            else:
                print(f"[FAILED] Status {response.status_code}: {response.text[:300]}")
    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {str(e)[:200]}")

    # Test streaming
    print(f"\n[2] Testing streaming request...")
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                'POST',
                'http://localhost:8000/v1/chat/completions',
                headers={
                    'Authorization': 'Bearer gw_temp_lw1xmCuEfLkKn6tsaDF3vw',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'katanemo/arch-router-1.5b',
                    'messages': [{'role': 'user', 'content': 'Say hello'}],
                    'max_tokens': 20,
                    'stream': True
                },
                timeout=30
            ) as response:
                if response.status_code == 200:
                    collected = []
                    async for line in response.aiter_lines():
                        if line.startswith('data: '):
                            data_str = line[6:]  # Remove 'data: ' prefix
                            if data_str == '[DONE]':
                                break
                            try:
                                chunk = json.loads(data_str)
                                if 'error' in chunk:
                                    print(f"[ERROR] Streaming error: {chunk['error']}")
                                    break
                                content = chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                                if content:
                                    collected.append(content)
                            except json.JSONDecodeError:
                                pass

                    full_response = ''.join(collected)
                    if full_response:
                        print(f"[SUCCESS] Streaming response: {full_response}")
                    else:
                        print(f"[FAILED] No content collected from stream")
                else:
                    text = await response.aread()
                    print(f"[FAILED] Status {response.status_code}: {text.decode()[:300]}")
    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {str(e)[:200]}")

if __name__ == '__main__':
    asyncio.run(test_arch_router_backend())
