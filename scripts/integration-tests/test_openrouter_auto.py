"""
Test OpenRouter auto model directly
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_SITE_URL = os.getenv('OPENROUTER_SITE_URL', 'https://terragon.ai')
OPENROUTER_SITE_NAME = os.getenv('OPENROUTER_SITE_NAME', 'Terragon Gateway')

def test_openrouter_auto():
    print("[TEST] Testing openrouter/auto directly with OpenRouter API...")

    if not OPENROUTER_API_KEY:
        print("[ERROR] OPENROUTER_API_KEY not set in environment")
        return False

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": OPENROUTER_SITE_URL,
                "X-Title": OPENROUTER_SITE_NAME
            }
        )

        print(f"[INFO] Making request to openrouter/auto...")
        response = client.chat.completions.create(
            model="openrouter/auto",
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=10
        )

        print(f"[SUCCESS] Response: {response.choices[0].message.content}")
        print(f"[INFO] Model used: {response.model if hasattr(response, 'model') else 'unknown'}")
        return True

    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        print(f"[ERROR] Error type: {type(e).__name__}")

        # Try to get more details
        if hasattr(e, 'status_code'):
            print(f"[ERROR] Status code: {e.status_code}")
        if hasattr(e, 'response'):
            print(f"[ERROR] Response: {e.response}")
        if hasattr(e, 'body'):
            print(f"[ERROR] Body: {e.body}")

        return False

if __name__ == "__main__":
    success = test_openrouter_auto()
    sys.exit(0 if success else 1)
