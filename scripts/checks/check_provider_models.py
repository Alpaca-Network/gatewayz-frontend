#!/usr/bin/env python3
"""
Check model availability and counts for each new Portkey provider.
Queries the backend to verify each provider has models and samples one.
"""

import logging
from src.services.models import get_cached_models

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def check_provider_models():
    """Check model availability for all new providers"""

    new_providers = ['google', 'cerebras', 'nebius', 'xai', 'novita', 'hug']

    logger.info("=" * 70)
    logger.info("NEW PORTKEY PROVIDER MODEL VERIFICATION")
    logger.info("=" * 70)
    logger.info("")

    results = {}

    for provider in new_providers:
        logger.info(f"Checking {provider.upper()}...")

        # Get models for this provider
        models = get_cached_models(provider)

        if models is None or models == []:
            logger.warning(f"  No models returned for {provider}")
            results[provider] = {
                'count': 0,
                'models': [],
                'sample': None,
                'status': 'NO_MODELS'
            }
        else:
            logger.info(f"  Found {len(models)} models")

            # Get sample model
            sample_model = models[0] if models else None
            sample_info = None

            if sample_model:
                sample_info = {
                    'id': sample_model.get('id', 'N/A'),
                    'name': sample_model.get('name', 'N/A'),
                    'provider_slug': sample_model.get('provider_slug', 'N/A'),
                    'source_gateway': sample_model.get('source_gateway', 'N/A'),
                }
                logger.info(f"  Sample model: {sample_info['id']}")
                logger.info(f"    - Name: {sample_info['name']}")
                logger.info(f"    - Provider: {sample_info['provider_slug']}")
                logger.info(f"    - Gateway: {sample_info['source_gateway']}")

            results[provider] = {
                'count': len(models),
                'models': models,
                'sample': sample_info,
                'status': 'AVAILABLE' if len(models) > 0 else 'EMPTY'
            }

        logger.info("")

    # Print summary
    logger.info("=" * 70)
    logger.info("SUMMARY")
    logger.info("=" * 70)
    logger.info("")

    total_models = 0
    available_count = 0

    for provider in new_providers:
        result = results[provider]
        count = result['count']
        status = result['status']
        total_models += count

        if status == 'AVAILABLE':
            available_count += 1
            logger.info(f"✓ {provider:12} | {count:6} models | {status}")
        else:
            logger.info(f"✗ {provider:12} | {count:6} models | {status}")

    logger.info("")
    logger.info(f"Total Models Available: {total_models}")
    logger.info(f"Providers with Models: {available_count}/{len(new_providers)}")
    logger.info("")

    # Check if Portkey aggregation includes new providers
    logger.info("Checking 'all' gateway aggregation...")
    all_models = get_cached_models("all")

    if all_models:
        logger.info(f"✓ 'all' gateway has {len(all_models)} total models")

        # Count models by provider
        provider_counts = {}
        for model in all_models:
            gateway = model.get('source_gateway', 'unknown')
            provider_counts[gateway] = provider_counts.get(gateway, 0) + 1

        logger.info("")
        logger.info("Model distribution across all providers:")
        for gateway in sorted(provider_counts.keys()):
            count = provider_counts[gateway]
            logger.info(f"  {gateway:15} | {count:6} models")
    else:
        logger.error("✗ 'all' gateway returned no models")

    logger.info("")
    logger.info("=" * 70)

    return results


def verify_model_schema(model):
    """Verify model has required fields"""
    required_fields = [
        'id', 'name', 'provider_slug', 'source_gateway',
        'description', 'pricing', 'architecture'
    ]

    missing = [f for f in required_fields if f not in model]
    return len(missing) == 0, missing


if __name__ == "__main__":
    results = check_provider_models()

    # Detailed verification
    logger.info("\nDETAILED MODEL VERIFICATION")
    logger.info("=" * 70)

    for provider, data in results.items():
        if data['sample']:
            logger.info(f"\n{provider.upper()} - Sample Model Verification:")
            sample = data['sample']

            model = data['models'][0]
            is_valid, missing = verify_model_schema(model)

            if is_valid:
                logger.info(f"  ✓ Schema validation: PASS")
                logger.info(f"    ID: {sample['id']}")
                logger.info(f"    Name: {sample['name']}")
                logger.info(f"    Provider: {sample['provider_slug']}")
                logger.info(f"    Gateway: {sample['source_gateway']}")
            else:
                logger.warning(f"  ✗ Schema validation: FAIL")
                logger.warning(f"    Missing fields: {missing}")
