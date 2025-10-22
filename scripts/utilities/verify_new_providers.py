#!/usr/bin/env python3
"""
Verification script to check model counts per provider
Runs the fetch functions for all 6 new providers and reports model counts
"""

import asyncio
import logging
import sys
import io

# Fix Windows encoding issue
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import the fetch functions
from src.services.portkey_providers import (
    fetch_models_from_google,
    fetch_models_from_cerebras,
    fetch_models_from_nebius,
    fetch_models_from_xai,
    fetch_models_from_novita,
    fetch_models_from_hug,
)

from src.services.models import (
    fetch_models_from_openrouter,
    fetch_models_from_portkey,
    fetch_models_from_featherless,
    fetch_models_from_deepinfra,
    fetch_models_from_chutes,
    fetch_models_from_groq,
    fetch_models_from_fireworks,
    fetch_models_from_together,
)


def verify_providers():
    """Verify model counts for all providers"""

    providers = {
        "google": fetch_models_from_google,
        "cerebras": fetch_models_from_cerebras,
        "nebius": fetch_models_from_nebius,
        "xai": fetch_models_from_xai,
        "novita": fetch_models_from_novita,
        "hug": fetch_models_from_hug,
    }

    # Also check the existing providers
    existing_providers = {
        "openrouter": fetch_models_from_openrouter,
        "portkey": fetch_models_from_portkey,
        "featherless": fetch_models_from_featherless,
        "deepinfra": fetch_models_from_deepinfra,
        "chutes": fetch_models_from_chutes,
        "groq": fetch_models_from_groq,
        "fireworks": fetch_models_from_fireworks,
        "together": fetch_models_from_together,
    }

    print("\n" + "="*70)
    print("MODEL COUNT VERIFICATION REPORT")
    print("="*70 + "\n")

    # Check new providers
    print("NEW PROVIDERS (Portkey SDK):")
    print("-" * 70)
    new_provider_results = {}
    for provider_name, fetch_func in providers.items():
        try:
            logger.info(f"Fetching models from {provider_name}...")
            models = fetch_func()
            count = len(models) if models else 0
            new_provider_results[provider_name] = count

            status = "[OK]" if count > 0 else "[WARN]"
            print(f"{status} {provider_name:15} : {count:4} models")

            if models and count > 0:
                # Show first 3 model IDs
                sample_ids = [m.get("id", "N/A") for m in models[:3]]
                print(f"   -> Sample models: {', '.join(sample_ids)}")
        except Exception as e:
            print(f"[ERR] {provider_name:15} : ERROR - {str(e)[:50]}")
            new_provider_results[provider_name] = 0

    # Check existing providers
    print("\n" + "="*70)
    print("EXISTING PROVIDERS (for comparison):")
    print("-" * 70)
    existing_provider_results = {}
    for provider_name, fetch_func in existing_providers.items():
        try:
            logger.info(f"Fetching models from {provider_name}...")
            models = fetch_func()
            count = len(models) if models else 0
            existing_provider_results[provider_name] = count

            status = "[OK]" if count > 0 else "[WARN]"
            print(f"{status} {provider_name:15} : {count:4} models")
        except Exception as e:
            print(f"[ERR] {provider_name:15} : ERROR - {str(e)[:50]}")
            existing_provider_results[provider_name] = 0

    # Summary
    print("\n" + "="*70)
    print("SUMMARY:")
    print("-" * 70)

    new_total = sum(new_provider_results.values())
    existing_total = sum(existing_provider_results.values())
    grand_total = new_total + existing_total

    print(f"New Providers Total    : {new_total:6} models")
    print(f"Existing Providers Total: {existing_total:6} models")
    print(f"GRAND TOTAL            : {grand_total:6} models")
    print("\n" + "="*70)

    # Check which providers have 0 models
    print("\nPROVIDERS WITH 0 MODELS:")
    print("-" * 70)
    zero_providers = []
    for provider_name, count in {**new_provider_results, **existing_provider_results}.items():
        if count == 0:
            zero_providers.append(provider_name)

    if zero_providers:
        for provider in zero_providers:
            print(f"  [WARN] {provider}")
    else:
        print("  [OK] All providers have models!")

    print("\n" + "="*70 + "\n")

    # Return exit code based on results
    if new_total > 0:
        print("[OK] New providers are working!")
        return 0
    else:
        print("[ERR] New providers returned 0 models total")
        return 1


if __name__ == "__main__":
    exit_code = verify_providers()
    sys.exit(exit_code)
