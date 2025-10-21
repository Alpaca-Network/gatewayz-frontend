"""
Test HuggingFace case sensitivity with actual working models
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

HUGGINGFACE_API_KEY = os.getenv('HUGGINGFACE_API_KEY')

def test_hf_case():
    print("Testing HuggingFace case sensitivity...")
    print(f"API Key present: {bool(HUGGINGFACE_API_KEY)}\n")

    if not HUGGINGFACE_API_KEY:
        print("[ERROR] No HuggingFace API key found")
        return

    # Test with katanemo model (the one we know works)
    test_cases = [
        ('katanemo/arch-router-1.5b', 'lowercase'),
        ('katanemo/Arch-Router-1.5B', 'mixed case'),
        ('Katanemo/Arch-Router-1.5B', 'capitalized org'),
    ]

    for model_id, description in test_cases:
        print(f"Testing {description}: {model_id}")
        try:
            client = OpenAI(
                base_url='https://api-inference.huggingface.co/v1',
                api_key=HUGGINGFACE_API_KEY
            )

            response = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=10,
                timeout=30
            )
            print(f"  [OK] Success: {response.choices[0].message.content[:50]}\n")

        except Exception as e:
            error_msg = str(e)[:200]
            print(f"  [ERROR] Failed: {error_msg}\n")

if __name__ == '__main__':
    test_hf_case()
