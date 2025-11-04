"""
Test Arch Router through HuggingFace directly
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

HF_API_KEY = os.getenv('HUG_API_KEY')

def test_arch_router_hf():
    """Test Arch Router via HuggingFace"""
    print("\n" + "="*70)
    print("Testing katanemo/Arch-Router-1.5B on HuggingFace")
    print("="*70)

    if not HF_API_KEY:
        print("[ERROR] HUG_API_KEY not found in environment")
        return False

    model_id = "katanemo/Arch-Router-1.5B"

    try:
        client = OpenAI(
            base_url='https://router.huggingface.co/v1',
            api_key=HF_API_KEY
        )

        # Test non-streaming first
        print(f"\n[1] Testing non-streaming request...")
        response = client.chat.completions.create(
            model=f"{model_id}:hf-inference",
            messages=[{"role": "user", "content": "Say 'test' and nothing else"}],
            max_tokens=10,
            stream=False,
            timeout=30
        )

        content = response.choices[0].message.content
        print(f"[SUCCESS] Non-streaming response: {content}")

        # Test streaming
        print(f"\n[2] Testing streaming request...")
        stream = client.chat.completions.create(
            model=f"{model_id}:hf-inference",
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=20,
            stream=True,
            timeout=30
        )

        collected = []
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                collected.append(chunk.choices[0].delta.content)

        full_response = ''.join(collected)
        print(f"[SUCCESS] Streaming response: {full_response}")

        return True

    except Exception as e:
        print(f"[ERROR] Request failed: {str(e)[:500]}")
        return False

if __name__ == '__main__':
    success = test_arch_router_hf()
    sys.exit(0 if success else 1)
