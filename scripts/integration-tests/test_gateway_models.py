#!/usr/bin/env python3
"""
Test script to check model fetching for all gateways
"""
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.models import get_cached_models
from src.config import Config
from utils import print_section

def check_gateway(gateway_name: str):
    """Test model fetching for a specific gateway"""
    print_section(f"Testing {gateway_name.upper()} gateway", 60)

    # Check API key
    api_key_map = {
        'xai': Config.XAI_API_KEY,
        'near': Config.NEAR_API_KEY,
        'google': Config.PORTKEY_API_KEY,  # Google uses Portkey filtering
        'cerebras': Config.CEREBRAS_API_KEY,
        'nebius': Config.NEBIUS_API_KEY,
        'novita': Config.NOVITA_API_KEY,
        'huggingface': Config.HUG_API_KEY,
        'hug': Config.HUG_API_KEY,
    }

    api_key = api_key_map.get(gateway_name)
    if api_key:
        print(f"✓ API Key: Configured ({api_key[:10]}...)")
    else:
        print(f"✗ API Key: NOT configured")
        print(f"  Set {gateway_name.upper()}_API_KEY in .env file")
        return

    # Try to fetch models
    print(f"\nFetching models...")
    try:
        models = get_cached_models(gateway_name)
        if models:
            print(f"✓ Success! Fetched {len(models)} models")
            if len(models) > 0:
                print(f"\nSample models:")
                for i, model in enumerate(models[:3]):
                    print(f"  {i+1}. {model.get('id', 'N/A')} - {model.get('name', 'N/A')}")
        else:
            print(f"✗ Failed: No models returned (returned None or empty list)")
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    print_section("Gateway Model Fetching Test", 60)

    gateways = ['xai', 'near', 'google', 'cerebras', 'nebius', 'novita', 'huggingface']

    for gateway in gateways:
        check_gateway(gateway)

    print_section("Test Complete", 60)

if __name__ == "__main__":
    main()
