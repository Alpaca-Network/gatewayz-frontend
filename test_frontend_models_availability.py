#!/usr/bin/env python3
"""
Test script to check model availability across all gateways using HTTP requests.
This script fetches models from all supported gateways and generates a report
of what models are available vs what might be missing in the frontend.
"""

import json
import os
import sys
from collections import defaultdict
from typing import Dict, List, Any
import urllib.request
import urllib.error


def fetch_models_from_gateway(gateway: str, api_base: str = "http://localhost:8000") -> List[Dict]:
    """Fetch models from a specific gateway via HTTP"""
    url = f"{api_base}/v1/models?gateway={gateway}&limit=10000"

    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode())
            models = data.get("data", [])
            return models
    except urllib.error.HTTPError as e:
        if e.code == 503:
            # Service unavailable - no models in cache
            return []
        print(f"HTTP Error {e.code} for {gateway}: {e.reason}")
        return []
    except Exception as e:
        print(f"Error fetching {gateway}: {str(e)}")
        return []


def fetch_all_gateway_models(api_base: str = "http://localhost:8000") -> Dict[str, List[Dict]]:
    """Fetch models from all supported gateways"""

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
        "hug",  # huggingface
        "aimo",
        "near",
        "fal",
        "helicone",
        "anannas",
        "aihubmix",
        "vercel-ai-gateway",
    ]

    results = {}

    print("=" * 80)
    print("FETCHING MODELS FROM ALL GATEWAYS")
    print("=" * 80)
    print()

    for gateway in gateways:
        print(f"Fetching models from {gateway}...", end=" ", flush=True)
        models = fetch_models_from_gateway(gateway, api_base)
        results[gateway] = models
        if models:
            print(f"✓ Found {len(models)} models")
        else:
            print(f"✗ No models found (cache might be empty or service down)")

    return results


def analyze_models(gateway_models: Dict[str, List[Dict]]) -> Dict[str, Any]:
    """Analyze the models and generate statistics"""

    print()
    print("=" * 80)
    print("ANALYSIS RESULTS")
    print("=" * 80)
    print()

    analysis = {
        "total_gateways": len(gateway_models),
        "gateways_with_models": 0,
        "gateways_without_models": 0,
        "total_models": 0,
        "unique_models": set(),
        "models_by_gateway": {},
        "providers_by_gateway": {},
        "unique_providers": set(),
        "model_details": [],
    }

    # Gateway-level stats
    for gateway, models in gateway_models.items():
        if models:
            analysis["gateways_with_models"] += 1
            analysis["total_models"] += len(models)
            analysis["models_by_gateway"][gateway] = len(models)

            # Extract unique model IDs and providers
            gateway_providers = set()
            for model in models:
                model_id = model.get("id") or model.get("name")
                if model_id:
                    analysis["unique_models"].add(model_id.lower())

                    # Extract provider
                    provider = model.get("provider") or model.get("provider_slug")
                    if not provider and "/" in model_id:
                        provider = model_id.split("/")[0]

                    if provider:
                        gateway_providers.add(provider.lower().strip("@"))
                        analysis["unique_providers"].add(provider.lower().strip("@"))

                    # Store detailed info for the first 5 models per gateway
                    if len([m for m in analysis["model_details"] if m["gateway"] == gateway]) < 5:
                        analysis["model_details"].append({
                            "gateway": gateway,
                            "model_id": model_id,
                            "provider": provider,
                            "context_length": model.get("context_length", 0),
                            "pricing": model.get("pricing"),
                            "is_private": model.get("is_private", False),
                        })

            analysis["providers_by_gateway"][gateway] = sorted(list(gateway_providers))
        else:
            analysis["gateways_without_models"] += 1

    analysis["unique_models"] = sorted(list(analysis["unique_models"]))
    analysis["unique_providers"] = sorted(list(analysis["unique_providers"]))

    return analysis


def print_analysis(analysis: Dict[str, Any]):
    """Print formatted analysis results"""

    print(f"Total Gateways Checked: {analysis['total_gateways']}")
    print(f"Gateways with Models: {analysis['gateways_with_models']}")
    print(f"Gateways without Models: {analysis['gateways_without_models']}")
    print(f"Total Models (with duplicates): {analysis['total_models']}")
    print(f"Unique Models: {len(analysis['unique_models'])}")
    print(f"Unique Providers: {len(analysis['unique_providers'])}")
    print()

    print("=" * 80)
    print("MODELS BY GATEWAY")
    print("=" * 80)
    print()

    for gateway, count in sorted(analysis["models_by_gateway"].items(), key=lambda x: x[1], reverse=True):
        providers = analysis["providers_by_gateway"].get(gateway, [])
        bar = "█" * min(50, count // 10)
        print(f"{gateway:25} {count:5} models | {len(providers):3} providers | {bar}")

    print()
    print("=" * 80)
    print("TOP PROVIDERS (across all gateways)")
    print("=" * 80)
    print()

    # Count provider occurrences
    provider_counts = defaultdict(int)
    for gateway, providers in analysis["providers_by_gateway"].items():
        for provider in providers:
            provider_counts[provider] += 1

    for i, (provider, count) in enumerate(sorted(provider_counts.items(), key=lambda x: x[1], reverse=True)[:30], 1):
        bar = "█" * min(20, count * 2)
        print(f"{i:2}. {provider:30} {count:2} gateway(s) | {bar}")

    print()
    print("=" * 80)
    print("SAMPLE MODELS (first 5 from each gateway)")
    print("=" * 80)
    print()

    current_gateway = None
    for detail in analysis["model_details"]:
        if detail["gateway"] != current_gateway:
            current_gateway = detail["gateway"]
            print(f"\n{current_gateway.upper()}:")

        pricing_str = "No pricing"
        if detail["pricing"]:
            prompt = detail["pricing"].get("prompt", "N/A")
            completion = detail["pricing"].get("completion", "N/A")
            pricing_str = f"${prompt}/{completion}"

        private_str = " [PRIVATE]" if detail["is_private"] else ""
        ctx_str = f"{detail['context_length']:,}".rjust(10) if detail['context_length'] else "Unknown".rjust(10)
        print(f"  • {detail['model_id']:60} | {ctx_str}ctx | {pricing_str}{private_str}")


def check_specific_models(gateway_models: Dict[str, List[Dict]]):
    """Check for specific popular models that should be available"""

    print()
    print("=" * 80)
    print("CHECKING POPULAR MODELS AVAILABILITY")
    print("=" * 80)
    print()

    popular_models = [
        "openai/gpt-4o",
        "openai/gpt-4-turbo",
        "openai/gpt-4",
        "openai/gpt-3.5-turbo",
        "anthropic/claude-3-5-sonnet",
        "anthropic/claude-3-opus",
        "anthropic/claude-3-sonnet",
        "anthropic/claude-3-haiku",
        "meta-llama/llama-3.1-405b-instruct",
        "meta-llama/llama-3.1-70b-instruct",
        "meta-llama/llama-3.1-8b-instruct",
        "google/gemini-pro",
        "google/gemini-1.5-pro",
        "mistralai/mistral-large",
        "mistralai/mixtral-8x7b-instruct",
        "cohere/command-r-plus",
        "qwen/qwen-2-72b-instruct",
    ]

    availability = {}

    for model_id in popular_models:
        found_in = []
        for gateway, models in gateway_models.items():
            if models:
                for model in models:
                    cached_id = (model.get("id") or model.get("name") or "").lower()
                    if model_id.lower() in cached_id or cached_id in model_id.lower():
                        found_in.append(gateway)
                        break

        availability[model_id] = found_in

        if found_in:
            print(f"✓ {model_id:50} | {', '.join(found_in)}")
        else:
            print(f"✗ {model_id:50} | NOT FOUND")


def save_results(gateway_models: Dict[str, List[Dict]], analysis: Dict[str, Any]):
    """Save results to JSON files for further analysis"""

    print()
    print("=" * 80)
    print("SAVING RESULTS")
    print("=" * 80)
    print()

    # Save full model data
    output_file = "test_results_all_models.json"
    with open(output_file, 'w') as f:
        json.dump(gateway_models, f, indent=2, default=str)
    file_size = os.path.getsize(output_file) / 1024 / 1024
    print(f"✓ Saved full model data to: {output_file} ({file_size:.2f} MB)")

    # Save analysis summary
    summary_file = "test_results_summary.json"
    with open(summary_file, 'w') as f:
        # Convert sets to lists for JSON serialization
        analysis_copy = analysis.copy()
        analysis_copy["unique_models"] = list(analysis_copy["unique_models"])
        analysis_copy["unique_providers"] = list(analysis_copy["unique_providers"])
        json.dump(analysis_copy, f, indent=2, default=str)
    print(f"✓ Saved analysis summary to: {summary_file}")

    # Save a CSV for easy viewing
    csv_file = "test_results_models.csv"
    with open(csv_file, 'w') as f:
        f.write("Gateway,Model ID,Provider,Context Length,Prompt Price,Completion Price,Is Private\n")
        for gateway, models in gateway_models.items():
            for model in models:
                model_id = (model.get("id") or model.get("name") or "Unknown").replace('"', '""')
                provider = (model.get("provider") or model.get("provider_slug") or "Unknown").replace('"', '""')
                context = model.get("context_length") or 0
                pricing = model.get("pricing") or {}
                prompt_price = pricing.get("prompt", "N/A") if pricing else "N/A"
                completion_price = pricing.get("completion", "N/A") if pricing else "N/A"
                is_private = "Yes" if model.get("is_private") else "No"
                f.write(f'"{gateway}","{model_id}","{provider}",{context},"{prompt_price}","{completion_price}",{is_private}\n')
    file_size = os.path.getsize(csv_file) / 1024
    print(f"✓ Saved CSV data to: {csv_file} ({file_size:.2f} KB)")


def main():
    """Main test function"""

    print()
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "FRONTEND MODELS AVAILABILITY TEST" + " " * 24 + "║")
    print("╚" + "=" * 78 + "╝")
    print()

    # Check if API is running
    api_base = os.environ.get("API_BASE_URL", "http://localhost:8000")
    print(f"Using API base URL: {api_base}")
    print()

    # Fetch models from all gateways
    gateway_models = fetch_all_gateway_models(api_base)

    # Analyze the results
    analysis = analyze_models(gateway_models)

    # Print formatted analysis
    print_analysis(analysis)

    # Check specific popular models
    check_specific_models(gateway_models)

    # Save results
    save_results(gateway_models, analysis)

    print()
    print("=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
    print()
    print("Summary:")
    print(f"  • {analysis['gateways_with_models']}/{analysis['total_gateways']} gateways have models")
    print(f"  • {len(analysis['unique_models'])} unique models found")
    print(f"  • {len(analysis['unique_providers'])} unique providers found")
    print()

    if analysis['gateways_without_models'] > 0:
        print("⚠️  WARNING: Some gateways have no models!")
        print("   This could mean:")
        print("   1. The model cache is empty (run the API server to populate)")
        print("   2. The API endpoints are not returning data")
        print("   3. Those gateways are not configured")
        print()

    print("Next steps:")
    print("  1. Review test_results_summary.json for detailed analysis")
    print("  2. Check test_results_all_models.json for full model data")
    print("  3. Open test_results_models.csv in a spreadsheet for easy viewing")
    print()


if __name__ == "__main__":
    main()
