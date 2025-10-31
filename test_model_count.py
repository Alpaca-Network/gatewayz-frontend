#!/usr/bin/env python3
"""Test script to verify the model counting fix"""

def get_model_count_by_provider_OLD(provider_slug: str, models_data: list = None) -> int:
    """OLD VERSION - only checks ID field"""
    if not models_data or not provider_slug:
        return 0

    count = 0
    for model in models_data:
        model_id = model.get('id', '')
        if '/' in model_id:
            model_provider = model_id.split('/')[0]
            if model_provider == provider_slug:
                count += 1

    return count


def get_model_count_by_provider_NEW(provider_slug: str, models_data: list = None) -> int:
    """NEW VERSION - checks provider_slug field, ID field, and source_gateway"""
    if not models_data or not provider_slug:
        return 0

    count = 0
    provider_slug_lower = provider_slug.lower().lstrip('@')

    for model in models_data:
        # Strategy 1: Check the provider_slug field directly
        model_provider_slug = model.get('provider_slug', '').lower().lstrip('@')
        if model_provider_slug == provider_slug_lower:
            count += 1
            continue

        # Strategy 2: Extract provider from model ID (format: provider/model-name)
        model_id = model.get('id', '')
        if '/' in model_id:
            model_provider = model_id.split('/')[0].lower().lstrip('@')
            if model_provider == provider_slug_lower:
                count += 1
                continue

        # Strategy 3: Check source_gateway field (for gateway-specific providers)
        source_gateway = model.get('source_gateway', '').lower()
        if source_gateway == provider_slug_lower:
            count += 1
            continue

    return count


# Test data mimicking different provider formats
test_models = [
    # Groq format: id starts with provider (works with old version)
    {'id': 'groq/llama-3-8b', 'provider_slug': 'groq', 'source_gateway': 'groq'},
    {'id': 'groq/llama-3-70b', 'provider_slug': 'groq', 'source_gateway': 'groq'},

    # Fireworks format: complex ID, provider_slug is separate (BROKEN with old version)
    {'id': 'accounts/fireworks/models/deepseek-v3', 'provider_slug': 'fireworks', 'source_gateway': 'fireworks'},
    {'id': 'accounts/fireworks/models/llama-3', 'provider_slug': 'fireworks', 'source_gateway': 'fireworks'},
    {'id': 'accounts/fireworks/models/qwen-2.5', 'provider_slug': 'fireworks', 'source_gateway': 'fireworks'},

    # Together format (provider_slug differs from ID prefix - BROKEN with old version)
    {'id': 'meta-llama/Llama-3-8b', 'provider_slug': 'together', 'source_gateway': 'together'},
    {'id': 'mistralai/Mixtral-8x7B', 'provider_slug': 'together', 'source_gateway': 'together'},

    # Featherless format
    {'id': 'google/gemma-2-9b', 'provider_slug': 'google', 'source_gateway': 'featherless'},
    {'id': 'anthropic/claude-3', 'provider_slug': 'anthropic', 'source_gateway': 'openrouter'},

    # Near format
    {'id': 'near/llama-3', 'provider_slug': 'near', 'source_gateway': 'near'},

    # DeepInfra format
    {'id': 'meta-llama/Meta-Llama-3-8B', 'provider_slug': 'meta-llama', 'source_gateway': 'deepinfra'},

    # Cerebras, Nebius, xAI, Novita (from recent refactor)
    {'id': '@cerebras/llama3-70b', 'provider_slug': 'cerebras', 'source_gateway': 'cerebras'},
    {'id': '@nebius/llama3-8b', 'provider_slug': 'nebius', 'source_gateway': 'nebius'},
    {'id': '@xai/grok-beta', 'provider_slug': 'xai', 'source_gateway': 'xai'},
    {'id': '@novita/sdxl', 'provider_slug': 'novita', 'source_gateway': 'novita'},

    # Hugging Face format
    {'id': 'huggingface/gpt2', 'provider_slug': 'huggingface', 'source_gateway': 'hug'},
]

# Test counting for each provider
providers_to_test = [
    'groq', 'fireworks', 'together', 'google', 'near',
    'cerebras', 'nebius', 'xai', 'novita', 'huggingface',
    'openrouter', 'featherless', 'deepinfra', 'anthropic', 'meta-llama'
]

print('\n' + '='*70)
print('MODEL COUNT COMPARISON: OLD vs NEW')
print('='*70)
print(f'{"Provider":<15} {"OLD Count":<12} {"NEW Count":<12} {"Status"}')
print('-'*70)

issues_found = []
for provider in providers_to_test:
    old_count = get_model_count_by_provider_OLD(provider, test_models)
    new_count = get_model_count_by_provider_NEW(provider, test_models)

    if old_count == 0 and new_count > 0:
        status = '✓ FIXED'
        issues_found.append((provider, old_count, new_count))
    elif old_count == new_count and new_count > 0:
        status = '✓ OK'
    elif new_count == 0:
        status = '(no models)'
    else:
        status = ''

    print(f'{provider:<15} {old_count:<12} {new_count:<12} {status}')

print('='*70)
print(f'\nSummary:')
print(f'  - Total providers tested: {len(providers_to_test)}')
print(f'  - Providers with 0 models (OLD): {sum(1 for p in providers_to_test if get_model_count_by_provider_OLD(p, test_models) == 0)}')
print(f'  - Providers with 0 models (NEW): {sum(1 for p in providers_to_test if get_model_count_by_provider_NEW(p, test_models) == 0)}')
print(f'  - Issues fixed: {len(issues_found)}')

if issues_found:
    print(f'\nProviders that were broken and are now fixed:')
    for provider, old, new in issues_found:
        print(f'  - {provider}: {old} -> {new} models')
