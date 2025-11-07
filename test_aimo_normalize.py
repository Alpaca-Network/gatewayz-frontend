#!/usr/bin/env python3
"""Test AIMO normalization logic standalone"""
import httpx
import json

print("=" * 60)
print("Test: AIMO Model Normalization Logic")
print("=" * 60)

# Fetch raw models
print("\n1. Fetching models from AIMO API...")
api_key = "aimo-sk-dev-2zpjTUg1bwBvnLEGuw14H7YgYirodkpi1VLf8KV2PA1eEAzNfcaRtsadQkVYQkbdEkWrmpcGXY4DFPr1ABuJArLFPAySbUrFBs899G7dGZqhHzLvr48oh2Yfk4ynsz3RtvN1xFE1NXs3SxFmNFDfGPmAzb66n4eJ37FFwvaXb8DwHPjiY"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

response = httpx.get(
    "https://devnet.aimo.network/api/v1/models",
    headers=headers,
    timeout=20.0,
)
response.raise_for_status()

payload = response.json()
raw_models = payload.get("data", [])
print(f"✓ Fetched {len(raw_models)} models")

# Standalone normalization function (copied from src/services/models.py)
def normalize_aimo_model(aimo_model: dict) -> dict:
    """Normalize AIMO catalog entries to resemble OpenRouter model shape"""
    model_name = aimo_model.get("name")
    if not model_name:
        print(f"⚠ Model missing 'name' field: {aimo_model}")
        return None

    # Get provider information (use first provider if multiple)
    providers = aimo_model.get("providers", [])
    if not providers:
        print(f"⚠ Model '{model_name}' has no providers")
        return None

    # For now, use the first provider
    provider = providers[0]
    provider_id = provider.get("id")
    provider_name = provider.get("name", "unknown")

    # Construct model ID in AIMO format: provider_pubkey:model_name
    model_id = f"{provider_id}:{model_name}"

    slug = model_id
    provider_slug = "aimo"
    if ":" in model_id:
        provider_slug = model_id.split(":")[0]

    display_name = aimo_model.get("display_name") or model_name.replace("-", " ").title()
    description = f"AIMO Network decentralized model {model_name} provided by {provider_name}."

    context_length = aimo_model.get("context_length", 0)

    # Extract pricing from provider object
    pricing = {
        "prompt": None,
        "completion": None,
        "request": None,
        "image": None,
        "web_search": None,
        "internal_reasoning": None,
    }

    provider_pricing = provider.get("pricing", {})
    if provider_pricing:
        prompt_price = provider_pricing.get("prompt")
        completion_price = provider_pricing.get("completion")
        pricing["prompt"] = str(prompt_price) if prompt_price is not None else None
        pricing["completion"] = str(completion_price) if completion_price is not None else None

    # Extract architecture
    aimo_arch = aimo_model.get("architecture", {})
    input_modalities = aimo_arch.get("input_modalities", ["text"])
    output_modalities = aimo_arch.get("output_modalities", ["text"])

    if input_modalities == ["text"] and output_modalities == ["text"]:
        modality = "text->text"
    else:
        modality = "multimodal"

    architecture = {
        "modality": modality,
        "input_modalities": input_modalities,
        "output_modalities": output_modalities,
        "tokenizer": None,
        "instruct_type": None,
    }

    normalized = {
        "id": slug,
        "slug": slug,
        "canonical_slug": slug,
        "hugging_face_id": None,
        "name": display_name,
        "created": aimo_model.get("created"),
        "description": description,
        "context_length": context_length,
        "architecture": architecture,
        "pricing": pricing,
        "top_provider": None,
        "per_request_limits": None,
        "supported_parameters": [],
        "default_parameters": {},
        "provider_slug": provider_slug,
        "provider_site_url": "https://aimo.network",
        "model_logo_url": None,
        "source_gateway": "aimo",
        "raw_aimo": aimo_model,
    }

    return normalized

# Test normalization
print("\n2. Testing normalization on all models...")
normalized_models = []
failed = 0

for model in raw_models:
    normalized = normalize_aimo_model(model)
    if normalized:
        normalized_models.append(normalized)
    else:
        failed += 1

print(f"✓ Successfully normalized {len(normalized_models)} models")
print(f"✗ Failed to normalize {failed} models")

if normalized_models:
    print(f"\n3. Sample normalized models:")
    for i, model in enumerate(normalized_models[:5], 1):
        print(f"\n{i}. {model.get('id')}")
        print(f"   Name: {model.get('name')}")
        print(f"   Provider: {model.get('provider_slug')}")
        print(f"   Gateway: {model.get('source_gateway')}")
        print(f"   Pricing: prompt={model.get('pricing', {}).get('prompt')}, completion={model.get('pricing', {}).get('completion')}")
else:
    print("\n⚠ WARNING: No models were successfully normalized!")

print("\n" + "=" * 60)
print(f"Summary: {len(normalized_models)} AIMO models ready to display")
print("=" * 60)
