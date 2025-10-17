import os
import pytest

# Skip all tests in this module if chutes is not installed
pytest.importorskip("chutes")

from chutes import Chutes

api_key = "cpk_0fc45d79a09e4be6a2c2435221361c71.e8060b822b7b5563847ade88501ef20a.tB8wgtKBInv8HCa4nGUTyGVpvqGg9Qc4"
client = Chutes(api_key=api_key)

# 1) Get catalog
print("Fetching models catalog...")
models = client.models.list()

print(f"Total models: {len(models)}")
print(f"\nFirst model attributes: {dir(models[0]) if models else 'No models'}")

if models:
    print(f"\nFirst 3 models:")
    for i, model in enumerate(models[:3]):
        print(f"\n{i+1}. {model}")
        # Try to access common attributes
        for attr in ['id', 'name', 'tags', 'popularity', 'hot', 'temperature']:
            if hasattr(model, attr):
                print(f"   {attr}: {getattr(model, attr)}")

# 2) Try to filter for hot models
print("\n\nAttempting to filter hot models...")
try:
    hot_models = [m for m in models if hasattr(m, 'tags') and 'hot' in (m.tags or [])]
    print(f"Models with 'hot' tag: {len(hot_models)}")
    if hot_models:
        print(f"First hot model: {hot_models[0].id if hasattr(hot_models[0], 'id') else hot_models[0]}")
except Exception as e:
    print(f"Error filtering hot models: {e}")

# 3) Try popularity filter
try:
    popular_models = sorted(
        [m for m in models if hasattr(m, 'popularity') and (m.popularity or 0) > 0],
        key=lambda m: m.popularity or 0,
        reverse=True
    )
    print(f"Models with popularity > 0: {len(popular_models)}")
    if popular_models:
        print(f"Top 5 by popularity:")
        for i, m in enumerate(popular_models[:5]):
            print(f"  {i+1}. {m.id if hasattr(m, 'id') else m} - popularity: {m.popularity}")
except Exception as e:
    print(f"Error sorting by popularity: {e}")
