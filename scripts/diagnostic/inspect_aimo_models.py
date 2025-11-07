#!/usr/bin/env python3
"""Inspect raw AIMO model data"""
import os
import httpx
import json

# Load env
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

api_key = os.environ.get("AIMO_API_KEY")
print(f"Using API key: ...{api_key[-20:]}\n")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

print("Fetching models from AIMO API...")
response = httpx.get(
    "https://devnet.aimo.network/api/v1/models",
    headers=headers,
    timeout=20.0,
)

print(f"Status: {response.status_code}\n")

if response.status_code == 200:
    data = response.json()
    models = data.get("data", [])
    print(f"Found {len(models)} models\n")

    if models:
        print("First model (raw):")
        print(json.dumps(models[0], indent=2))

        print("\n\nFirst 10 model IDs:")
        for i, model in enumerate(models[:10], 1):
            model_id = model.get('id', 'N/A')
            model_name = model.get('name', model.get('display_name', 'N/A'))
            print(f"{i:2d}. ID: {model_id}")
            print(f"    Name: {model_name}")
else:
    print(f"Error: {response.text}")
