"""
Test end-to-end normalization with actual provider clients
This simulates what happens when a user sends a mixed-case model ID
"""
import sys
sys.path.insert(0, 'src')

import os
from dotenv import load_dotenv
from src.services.model_transformations import transform_model_id
from openai import OpenAI

load_dotenv()

def test_fireworks_with_transform():
    """Test that Fireworks accepts model IDs after transformation"""
    print("Testing Fireworks with mixed-case input + transformation...\n")

    FIREWORKS_API_KEY = os.getenv('FIREWORKS_API_KEY')
    if not FIREWORKS_API_KEY:
        print("[SKIP] No Fireworks API key found")
        return False

    # User sends mixed-case model ID (simulating frontend input)
    user_input = "Meta-Llama/Llama-3.1-8B-Instruct"
    provider = "fireworks"

    print(f"User input (mixed case): {user_input}")

    # Backend transforms it
    transformed_id = transform_model_id(user_input, provider)
    print(f"After transformation: {transformed_id}")
    print(f"Is lowercase: {transformed_id == transformed_id.lower()}")

    # Try to use it with Fireworks
    print(f"\nSending to Fireworks API...")
    try:
        client = OpenAI(
            base_url='https://api.fireworks.ai/inference/v1',
            api_key=FIREWORKS_API_KEY
        )

        response = client.chat.completions.create(
            model=transformed_id,  # Using the transformed (lowercase) ID
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=10,
            timeout=15
        )

        print(f"[OK] Success! Response: {response.choices[0].message.content[:50]}")
        return True

    except Exception as e:
        error_msg = str(e)[:200]
        print(f"[ERROR] Failed: {error_msg}")
        return False


def test_openrouter_with_transform():
    """Test that OpenRouter still works with transformed model IDs"""
    print("\n\nTesting OpenRouter with mixed-case input + transformation...\n")

    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    if not OPENROUTER_API_KEY:
        print("[SKIP] No OpenRouter API key found")
        return False

    # User sends mixed-case model ID
    user_input = "Sao10K/L3-Euryale-70B"
    provider = "openrouter"

    print(f"User input (mixed case): {user_input}")

    # Backend transforms it (should just lowercase it)
    transformed_id = transform_model_id(user_input, provider)
    print(f"After transformation: {transformed_id}")
    print(f"Is lowercase: {transformed_id == transformed_id.lower()}")

    # Try to use it with OpenRouter
    print(f"\nSending to OpenRouter API...")
    try:
        client = OpenAI(
            base_url='https://openrouter.ai/api/v1',
            api_key=OPENROUTER_API_KEY,
            default_headers={
                'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'https://gatewayz.ai'),
                'X-Title': os.getenv('OPENROUTER_SITE_NAME', 'Gatewayz')
            }
        )

        response = client.chat.completions.create(
            model=transformed_id,  # Using the transformed (lowercase) ID
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=10,
            timeout=15
        )

        print(f"[OK] Success! Response: {response.choices[0].message.content[:50]}")
        return True

    except Exception as e:
        error_msg = str(e)[:200]
        print(f"[ERROR] Failed: {error_msg}")
        return False


if __name__ == '__main__':
    print("="*60)
    print("END-TO-END NORMALIZATION TEST")
    print("="*60)
    print("This test simulates a user sending mixed-case model IDs")
    print("and verifies that the backend normalization makes them work.")
    print("="*60)

    results = {}
    results['fireworks'] = test_fireworks_with_transform()
    results['openrouter'] = test_openrouter_with_transform()

    print("\n\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    for provider, success in results.items():
        status = "[OK]" if success else "[FAIL]"
        print(f"{provider:20} : {status}")

    all_passed = all(results.values())
    print("="*60)

    if all_passed:
        print("\n[SUCCESS] All providers accept normalized (lowercase) model IDs!")
        print("Mixed-case input from users will now work correctly.")
    else:
        print("\n[WARNING] Some providers had issues. Check the logs above.")

    sys.exit(0 if all_passed else 1)
