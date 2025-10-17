#!/usr/bin/env python3
"""
Export all models and their prices from all gateways to CSV
"""

import csv
import json
from datetime import datetime
from src.services.models import get_cached_models

def export_models_to_csv(output_file: str = None):
    """
    Export all models from all gateways to a CSV file

    Args:
        output_file: Path to output CSV file (default: models_export_YYYY-MM-DD_HHMMSS.csv)
    """
    if output_file is None:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        output_file = f"models_export_{timestamp}.csv"

    # List of all gateways
    gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]

    # Collect all models
    all_models = []
    for gateway in gateways:
        print(f"Fetching models from {gateway}...")
        models = get_cached_models(gateway) or []
        print(f"  Found {len(models)} models from {gateway}")

        for model in models:
            model_data = {
                "gateway": gateway,
                "id": model.get("id", ""),
                "name": model.get("name", ""),
                "provider": model.get("provider", model.get("provider_slug", "")),
                "provider_slug": model.get("provider_slug", ""),
                "description": model.get("description", ""),
                "context_length": model.get("context_length", ""),
                "prompt_price": model.get("pricing", {}).get("prompt") if isinstance(model.get("pricing"), dict) else "",
                "completion_price": model.get("pricing", {}).get("completion") if isinstance(model.get("pricing"), dict) else "",
                "modality": model.get("architecture", {}).get("modality", "") if isinstance(model.get("architecture"), dict) else model.get("modality", ""),
                "rank": model.get("rank", ""),
                "source_gateway": model.get("source_gateway", gateway),
            }
            all_models.append(model_data)

    # Write to CSV
    if all_models:
        fieldnames = [
            "gateway",
            "id",
            "name",
            "provider",
            "provider_slug",
            "description",
            "context_length",
            "prompt_price",
            "completion_price",
            "modality",
            "rank",
            "source_gateway",
        ]

        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_models)

        print(f"\nSuccessfully exported {len(all_models)} models to {output_file}")
        return output_file
    else:
        print("\nNo models found in cache. Make sure the backend has initialized the model cache.")
        return None


if __name__ == "__main__":
    print("Starting model export...\n")
    output_file = export_models_to_csv()
    if output_file:
        print(f"\nCSV file created: {output_file}")
        print(f"Location: {output_file}")
    else:
        print("\nExport failed - no models in cache")

    # Also create a summary report
    print("\n" + "="*60)
    print("EXPORT SUMMARY")
    print("="*60)

    import csv
    from collections import defaultdict

    if output_file:
        gateway_counts = defaultdict(int)
        provider_counts = defaultdict(int)
        pricing_stats = defaultdict(lambda: {"with_pricing": 0, "without_pricing": 0})

        with open(output_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            total = 0
            for row in reader:
                total += 1
                gateway = row['gateway']
                provider = row['provider'] or row['provider_slug'] or 'Unknown'
                gateway_counts[gateway] += 1
                provider_counts[provider] += 1

                prompt_price = row['prompt_price']
                completion_price = row['completion_price']

                if prompt_price and completion_price and prompt_price != '/' and completion_price != '/':
                    pricing_stats[gateway]["with_pricing"] += 1
                else:
                    pricing_stats[gateway]["without_pricing"] += 1

        print(f"\nTotal Models Exported: {total}\n")
        print("By Gateway:")
        for gateway in sorted(gateway_counts.keys()):
            count = gateway_counts[gateway]
            with_pricing = pricing_stats[gateway]["with_pricing"]
            without_pricing = pricing_stats[gateway]["without_pricing"]
            print(f"  {gateway:15} {count:6} models (pricing: {with_pricing}/{without_pricing})")
