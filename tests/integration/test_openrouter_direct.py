"""
Test OpenRouter directly to check if sao10k/l3-euryale-70b is available
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_SITE_URL = os.getenv('OPENROUTER_SITE_URL', 'https://gatewayz.ai')
OPENROUTER_SITE_NAME = os.getenv('OPENROUTER_SITE_NAME', 'Gatewayz')

def test_model():
    print("[1] Testing sao10k/l3-euryale-70b directly with OpenRouter...")

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": OPENROUTER_SITE_URL,
                "X-Title": OPENROUTER_SITE_NAME
            }
        )

        response = client.chat.completions.create(
            model="sao10k/l3-euryale-70b",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=50
        )

        print(f"[OK] Success! Response: {response.choices[0].message.content[:100]}")

    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        print(f"Error type: {type(e).__name__}")

        # Try to get more details
        if hasattr(e, 'status_code'):
            print(f"Status code: {e.status_code}")
        if hasattr(e, 'response'):
            print(f"Response: {e.response}")
        if hasattr(e, 'body'):
            print(f"Body: {e.body}")

    # Try the working model
    print("\n[2] Testing katanemo/Arch-Router-1.5B directly with OpenRouter...")

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": OPENROUTER_SITE_URL,
                "X-Title": OPENROUTER_SITE_NAME
            }
        )

        response = client.chat.completions.create(
            model="katanemo/Arch-Router-1.5B",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=50
        )

        print(f"[OK] Success! Response: {response.choices[0].message.content[:100]}")

    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        print(f"Error type: {type(e).__name__}")

test_model()
