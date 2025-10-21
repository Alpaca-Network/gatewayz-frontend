"""
Test case sensitivity requirements for all gateway providers
This helps us determine if we need to normalize model IDs to lowercase
"""
import os
import sys
sys.path.insert(0, 'src')

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Test cases: (provider_name, base_url, api_key_env, test_model_lowercase, test_model_uppercase)
PROVIDERS = [
    {
        'name': 'OpenRouter',
        'base_url': 'https://openrouter.ai/api/v1',
        'api_key': os.getenv('OPENROUTER_API_KEY'),
        'headers': {
            'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'https://gatewayz.ai'),
            'X-Title': os.getenv('OPENROUTER_SITE_NAME', 'Gatewayz')
        },
        'test_models': [
            ('meta-llama/llama-3.1-8b-instruct', 'meta-llama/Llama-3.1-8B-Instruct'),
            ('openai/gpt-3.5-turbo', 'OpenAI/GPT-3.5-Turbo'),
        ]
    },
    {
        'name': 'HuggingFace',
        'base_url': 'https://api-inference.huggingface.co/v1',
        'api_key': os.getenv('HUGGINGFACE_API_KEY'),
        'headers': {},
        'test_models': [
            ('meta-llama/llama-3.1-8b-instruct', 'meta-llama/Llama-3.1-8B-Instruct'),
            ('microsoft/phi-3-mini-4k-instruct', 'Microsoft/Phi-3-Mini-4K-Instruct'),
        ]
    },
    {
        'name': 'Featherless',
        'base_url': 'https://api.featherless.ai/v1',
        'api_key': os.getenv('FEATHERLESS_API_KEY'),
        'headers': {},
        'test_models': [
            ('meta-llama/llama-3.1-8b-instruct', 'meta-llama/Llama-3.1-8B-Instruct'),
        ]
    },
    {
        'name': 'Fireworks',
        'base_url': 'https://api.fireworks.ai/inference/v1',
        'api_key': os.getenv('FIREWORKS_API_KEY'),
        'headers': {},
        'test_models': [
            ('accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/Llama-V3P1-8B-Instruct'),
        ]
    },
    {
        'name': 'Together',
        'base_url': 'https://api.together.xyz/v1',
        'api_key': os.getenv('TOGETHER_API_KEY'),
        'headers': {},
        'test_models': [
            ('meta-llama/meta-llama-3.1-8b-instruct-turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'),
        ]
    }
]

def test_provider_case_sensitivity():
    results = {}

    for provider in PROVIDERS:
        print(f"\n{'='*60}")
        print(f"Testing {provider['name']}")
        print(f"{'='*60}")

        if not provider['api_key']:
            print(f"[SKIP] No API key found for {provider['name']}")
            results[provider['name']] = {'status': 'skipped', 'reason': 'No API key'}
            continue

        provider_results = {
            'lowercase': {},
            'uppercase': {},
            'case_sensitive': None
        }

        for lowercase_model, uppercase_model in provider['test_models']:
            print(f"\nTesting model: {lowercase_model} vs {uppercase_model}")

            # Test lowercase
            print(f"  Testing lowercase: {lowercase_model}")
            try:
                client = OpenAI(
                    base_url=provider['base_url'],
                    api_key=provider['api_key'],
                    default_headers=provider['headers']
                )

                response = client.chat.completions.create(
                    model=lowercase_model,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=10,
                    timeout=15
                )
                print(f"  [OK] Lowercase works: {response.choices[0].message.content[:50]}")
                provider_results['lowercase'][lowercase_model] = 'success'

            except Exception as e:
                error_msg = str(e)[:150]
                print(f"  [ERROR] Lowercase failed: {error_msg}")
                provider_results['lowercase'][lowercase_model] = f'failed: {error_msg}'

            # Test uppercase/mixed case
            print(f"  Testing mixed case: {uppercase_model}")
            try:
                client = OpenAI(
                    base_url=provider['base_url'],
                    api_key=provider['api_key'],
                    default_headers=provider['headers']
                )

                response = client.chat.completions.create(
                    model=uppercase_model,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=10,
                    timeout=15
                )
                print(f"  [OK] Mixed case works: {response.choices[0].message.content[:50]}")
                provider_results['uppercase'][uppercase_model] = 'success'

            except Exception as e:
                error_msg = str(e)[:150]
                print(f"  [ERROR] Mixed case failed: {error_msg}")
                provider_results['uppercase'][uppercase_model] = f'failed: {error_msg}'

        # Determine case sensitivity
        lowercase_success = any('success' in str(v) for v in provider_results['lowercase'].values())
        uppercase_success = any('success' in str(v) for v in provider_results['uppercase'].values())

        if lowercase_success and not uppercase_success:
            provider_results['case_sensitive'] = 'Requires lowercase'
        elif uppercase_success and not lowercase_success:
            provider_results['case_sensitive'] = 'Requires exact case'
        elif lowercase_success and uppercase_success:
            provider_results['case_sensitive'] = 'Case insensitive'
        else:
            provider_results['case_sensitive'] = 'Both failed (may be other issue)'

        print(f"\n[RESULT] {provider['name']}: {provider_results['case_sensitive']}")
        results[provider['name']] = provider_results

    # Print summary
    print(f"\n\n{'='*60}")
    print("SUMMARY: Case Sensitivity by Provider")
    print(f"{'='*60}")

    for provider_name, result in results.items():
        if result.get('status') == 'skipped':
            print(f"{provider_name:20} : SKIPPED ({result['reason']})")
        else:
            print(f"{provider_name:20} : {result['case_sensitive']}")

    print(f"\n{'='*60}")
    print("RECOMMENDATION")
    print(f"{'='*60}")

    case_sensitive_providers = [
        name for name, result in results.items()
        if result.get('case_sensitive') in ['Requires lowercase', 'Requires exact case']
    ]

    if case_sensitive_providers:
        print(f"The following providers are case-sensitive: {', '.join(case_sensitive_providers)}")
        print("\nRECOMMENDATION: Normalize all model IDs to lowercase before sending to providers")
        print("This will ensure compatibility across all providers.")
    else:
        print("All tested providers are case-insensitive!")
        print("However, normalizing to lowercase is still recommended for consistency.")

if __name__ == '__main__':
    test_provider_case_sensitivity()
