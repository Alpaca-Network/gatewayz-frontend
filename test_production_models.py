#!/usr/bin/env python3
"""
Test script to check model availability from the PRODUCTION API
This queries the live Gatewayz API to see what models are actually available
"""

import json
import urllib.request
import urllib.error
from collections import defaultdict
from typing import Dict, List, Any

# Production API base URL
PROD_API = "https://gatewayz-api.vercel.app"

def fetch_models_from_gateway(gateway: str) -> List[Dict]:
    """Fetch models from a specific gateway via production API"""
    url = f"{PROD_API}/v1/models?gateway={gateway}&limit=10000"

    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Gatewayz-Test-Script/1.0')

        with urllib.request.urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode())
            models = data.get("data", [])
            return models
    except urllib.error.HTTPError as e:
        if e.code == 503:
            return []
        print(f"HTTP Error {e.code} for {gateway}: {e.reason}")
        return []
    except Exception as e:
        print(f"Error fetching {gateway}: {str(e)}")
        return []


def main():
    """Main test function"""

    print()
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 15 + "PRODUCTION FRONTEND MODELS AVAILABILITY TEST" + " " * 18 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    print(f"Testing against: {PROD_API}")
    print()

    gateways = [
        "openrouter",
        "featherless",
        "deepinfra",
        "chutes",
        "groq",
        "fireworks",
        "together",
        "cerebras",
        "nebius",
        "xai",
        "novita",
        "hug",
        "aimo",
        "near",
        "fal",
        "helicone",
        "anannas",
        "aihubmix",
        "vercel-ai-gateway",
    ]

    print("=" * 80)
    print("FETCHING MODELS FROM ALL GATEWAYS")
    print("=" * 80)
    print()

    gateway_models = {}
    total_models = 0
    unique_models = set()
    provider_counts = defaultdict(int)

    for gateway in gateways:
        print(f"Fetching {gateway:25}...", end=" ", flush=True)
        models = fetch_models_from_gateway(gateway)
        gateway_models[gateway] = models

        if models:
            print(f"✓ {len(models):5} models")
            total_models += len(models)

            # Track unique models and providers
            for model in models:
                model_id = (model.get("id") or model.get("name") or "").lower()
                if model_id:
                    unique_models.add(model_id)

                provider = model.get("provider") or model.get("provider_slug") or ""
                if not provider and "/" in model_id:
                    provider = model_id.split("/")[0]
                if provider:
                    provider_counts[provider.lower().strip("@")] += 1
        else:
            print(f"✗ No models")

    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print()
    print(f"Total gateways checked: {len(gateways)}")
    print(f"Gateways with models: {sum(1 for m in gateway_models.values() if m)}")
    print(f"Total models (with duplicates): {total_models:,}")
    print(f"Unique models: {len(unique_models):,}")
    print(f"Unique providers: {len(provider_counts):,}")
    print()

    print("=" * 80)
    print("MODELS BY GATEWAY (Top 15)")
    print("=" * 80)
    print()

    sorted_gateways = sorted(gateway_models.items(), key=lambda x: len(x[1]), reverse=True)[:15]
    for gateway, models in sorted_gateways:
        if models:
            bar = "█" * min(50, len(models) // 10)
            print(f"{gateway:25} {len(models):5} models | {bar}")

    print()
    print("=" * 80)
    print("TOP 30 PROVIDERS")
    print("=" * 80)
    print()

    for i, (provider, count) in enumerate(sorted(provider_counts.items(), key=lambda x: x[1], reverse=True)[:30], 1):
        bar = "█" * min(30, count // 5)
        print(f"{i:2}. {provider:35} {count:5} models | {bar}")

    # Save results
    print()
    print("=" * 80)
    print("SAVING RESULTS")
    print("=" * 80)
    print()

    with open("production_test_results.json", "w") as f:
        json.dump({
            "gateway_models": {k: v for k, v in gateway_models.items() if v},
            "summary": {
                "total_gateways": len(gateways),
                "gateways_with_models": sum(1 for m in gateway_models.values() if m),
                "total_models": total_models,
                "unique_models": len(unique_models),
                "unique_providers": len(provider_counts),
            }
        }, f, indent=2)
    print("✓ Saved results to: production_test_results.json")

    # Create CSV
    with open("production_test_models.csv", "w") as f:
        f.write("Gateway,Model ID,Provider,Context Length,Is Private\n")
        for gateway, models in gateway_models.items():
            for model in models[:500]:  # Limit to 500 per gateway
                model_id = (model.get("id") or "").replace('"', '""')
                provider = (model.get("provider") or model.get("provider_slug") or "").replace('"', '""')
                context = model.get("context_length", 0)
                is_private = "Yes" if model.get("is_private") else "No"
                f.write(f'"{gateway}","{model_id}","{provider}",{context},{is_private}\n')
    print("✓ Saved CSV to: production_test_models.csv")

    print()
    print("=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
    print()

if __name__ == "__main__":
    main()
