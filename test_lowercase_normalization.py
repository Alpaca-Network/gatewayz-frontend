"""
Test that the lowercase normalization works correctly
"""
import sys
sys.path.insert(0, 'src')

from src.services.model_transformations import transform_model_id

def test_normalization():
    print("Testing lowercase normalization in transform_model_id...\n")

    test_cases = [
        # (input_model_id, provider, expected_output_contains)
        ("katanemo/Arch-Router-1.5B", "huggingface", "katanemo/arch-router-1.5b"),
        ("Meta-Llama/Llama-3.1-8B-Instruct", "openrouter", "meta-llama/llama-3.1-8b-instruct"),
        ("OpenAI/GPT-4", "openrouter", "openai/gpt-4"),
        ("Sao10K/L3-Euryale-70B", "openrouter", "sao10k/l3-euryale-70b"),
        ("ANTHROPIC/CLAUDE-3-OPUS", "openrouter", "anthropic/claude-3-opus"),
        ("accounts/fireworks/models/Llama-V3P1-8B-Instruct", "fireworks", "accounts/fireworks/models/llama-v3p1-8b-instruct"),
    ]

    passed = 0
    failed = 0

    for input_id, provider, expected_contains in test_cases:
        result = transform_model_id(input_id, provider)

        # Check if result is lowercase
        is_lowercase = result == result.lower()
        # Check if expected substring is in result
        contains_expected = expected_contains.lower() in result.lower()

        status = "[OK]" if (is_lowercase and contains_expected) else "[FAIL]"

        print(f"{status} Input: '{input_id}' ({provider})")
        print(f"      Output: '{result}'")
        print(f"      Expected to contain: '{expected_contains}'")
        print(f"      Is lowercase: {is_lowercase}")
        print()

        if is_lowercase and contains_expected:
            passed += 1
        else:
            failed += 1

    print(f"\n{'='*60}")
    print(f"RESULTS: {passed} passed, {failed} failed")
    print(f"{'='*60}")

    if failed == 0:
        print("\n[SUCCESS] All model IDs are correctly normalized to lowercase!")
        return True
    else:
        print(f"\n[WARNING] {failed} test(s) failed - some model IDs may not be normalized")
        return False

if __name__ == '__main__':
    success = test_normalization()
    sys.exit(0 if success else 1)
