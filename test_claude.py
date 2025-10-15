import httpx
import json

API_KEY = 'gw_live_fHfMHsQkMIXloUULpjxi5xLqHK76fM3hhNHWEz0P14k'
url = 'http://127.0.0.1:8000/v1/messages'
headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}

payload = {
    'model': 'anthropic/claude-sonnet-4.5',
    'max_tokens': 150,
    'messages': [{'role': 'user', 'content': 'Say "Hello from the Messages API!" and explain what this endpoint does in one sentence.'}]
}

print('Making request to /v1/messages...')
print(f'Model: {payload["model"]}')
print('')

try:
    response = httpx.post(url, headers=headers, json=payload, timeout=60.0)
    print(f'Status: {response.status_code}')
    print('')

    if response.status_code == 200:
        result = response.json()
        print('SUCCESS! Response in Anthropic format:')
        print(f'  type: {result.get("type")}')
        print(f'  role: {result.get("role")}')
        print(f'  model: {result.get("model")}')
        print(f'  stop_reason: {result.get("stop_reason")}')
        print('')
        print('Content:')
        for block in result.get('content', []):
            if block.get('type') == 'text':
                print(f'  {block.get("text")}')
        print('')
        usage = result.get("usage", {})
        print(f'Usage: input={usage.get("input_tokens")}, output={usage.get("output_tokens")}')

        if 'gateway_usage' in result:
            gw = result['gateway_usage']
            cost_str = f', cost=${gw.get("cost_usd"):.6f}' if 'cost_usd' in gw else ''
            print(f'Gateway: tokens={gw.get("tokens_charged")}, time={gw.get("request_ms")}ms{cost_str}')
    else:
        print(f'Error response: {response.text[:500]}')
except Exception as e:
    print(f'Exception: {e}')
    import traceback
    traceback.print_exc()
