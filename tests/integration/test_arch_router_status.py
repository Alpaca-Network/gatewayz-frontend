"""
Test Arch Router model availability
Check both HuggingFace and OpenRouter to see where it's available
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def test_arch_router_huggingface():
    """Test katanemo/arch-router-1.5b on HuggingFace"""
    print("="*60)
    print("Testing katanemo/arch-router-1.5b on HuggingFace")
    print("="*60)

    api_key = os.getenv('HUGGINGFACE_API_KEY')
    if not api_key:
        print("[SKIP] No HuggingFace API key found\n")
        return None

    model_id = "katanemo/arch-router-1.5b"
    print(f"Model ID: {model_id}")

    try:
        client = OpenAI(
            base_url='https://api-inference.huggingface.co/v1',
            api_key=api_key
        )

        print("Sending test request...")
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=10,
            timeout=30
        )

        print(f"[OK] HuggingFace: Model is available!")
        print(f"Response: {response.choices[0].message.content[:100]}\n")
        return True

    except Exception as e:
        print(f"[ERROR] HuggingFace failed: {str(e)[:300]}\n")
        return False


def test_arch_router_openrouter():
    """Test katanemo/arch-router-1.5b on OpenRouter"""
    print("="*60)
    print("Testing katanemo/arch-router-1.5b on OpenRouter")
    print("="*60)

    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        print("[SKIP] No OpenRouter API key found\n")
        return None

    # Try both lowercase and proper case
    test_models = [
        "katanemo/arch-router-1.5b",
        "katanemo/Arch-Router-1.5B"
    ]

    for model_id in test_models:
        print(f"\nModel ID: {model_id}")

        try:
            client = OpenAI(
                base_url='https://openrouter.ai/api/v1',
                api_key=api_key,
                default_headers={
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'https://gatewayz.ai'),
                    'X-Title': os.getenv('OPENROUTER_SITE_NAME', 'Gatewayz')
                }
            )

            print("Sending test request...")
            response = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=10,
                timeout=15
            )

            print(f"[OK] OpenRouter: Model is available with ID '{model_id}'!")
            print(f"Response: {response.choices[0].message.content[:100]}")
            return True

        except Exception as e:
            error_msg = str(e)[:300]
            print(f"[ERROR] Failed with '{model_id}': {error_msg}")

    print()
    return False


def check_alternative_routers():
    """Check what other routing models are available"""
    print("="*60)
    print("Checking Alternative Router Models on OpenRouter")
    print("="*60)

    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        print("[SKIP] No OpenRouter API key found\n")
        return

    # Known router models from our previous search
    router_models = [
        "switchpoint/router-light-preview",
        "switchpoint/router",
        "openrouter/auto",  # OpenRouter's built-in router
    ]

    print("\nTesting alternative routing models:\n")

    for model_id in router_models:
        print(f"Testing: {model_id}")
        try:
            client = OpenAI(
                base_url='https://openrouter.ai/api/v1',
                api_key=api_key,
                default_headers={
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'https://gatewayz.ai'),
                    'X-Title': os.getenv('OPENROUTER_SITE_NAME', 'Gatewayz')
                }
            )

            response = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=10,
                timeout=15
            )

            print(f"  [OK] Available! Response: {response.choices[0].message.content[:50]}\n")

        except Exception as e:
            error_msg = str(e)[:150]
            print(f"  [ERROR] {error_msg}\n")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("ARCH ROUTER STATUS CHECK")
    print("="*60 + "\n")

    results = {
        'huggingface': test_arch_router_huggingface(),
        'openrouter': test_arch_router_openrouter()
    }

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    for provider, status in results.items():
        if status is None:
            print(f"{provider:20} : SKIPPED (no API key)")
        elif status:
            print(f"{provider:20} : [OK] Available")
        else:
            print(f"{provider:20} : [ERROR] Not available")

    print("="*60 + "\n")

    # If Arch Router is down, check alternatives
    if not any(s for s in results.values() if s):
        check_alternative_routers()
