#!/usr/bin/env python3
"""Test Portkey pricing cross-reference with OpenRouter"""

import sys
sys.path.insert(0, '/Users/vaughn/Documents/GitHub/gatewayz-backend')

# Clear cache
from src.cache import _portkey_models_cache
_portkey_models_cache['data'] = None
_portkey_models_cache['timestamp'] = None

from src.services.models import get_cached_models

# Fetch with improved matching
portkey_models = get_cached_models('portkey') or []

if portkey_models:
    with_pricing = [m for m in portkey_models if m.get('pricing', {}).get('prompt') is not None]
    without_pricing = [m for m in portkey_models if m.get('pricing', {}).get('prompt') is None]

    print(f'Portkey Models: {len(portkey_models)} total')
    print(f'  ✅ With pricing (matched): {len(with_pricing)} ({round(len(with_pricing)/len(portkey_models)*100, 1)}%)')
    print(f'  ⚠️  Without pricing: {len(without_pricing)} ({round(len(without_pricing)/len(portkey_models)*100, 1)}%)')
    print()

    # Count match types
    exact = [m for m in portkey_models if 'exact match' in m.get('description', '')]
    approx = [m for m in portkey_models if 'approximate match' in m.get('description', '')]
    canonical = [m for m in portkey_models if 'canonical match' in m.get('description', '')]

    print(f'Match types:')
    print(f'  Exact: {len(exact)}')
    print(f'  Approximate: {len(approx)}')
    print(f'  Canonical: {len(canonical)}')
    print()

    # Show examples
    if with_pricing:
        print(f'Sample matched models:')
        for m in with_pricing[:5]:
            price = m.get('pricing', {}).get('prompt')
            if price and price != '0':
                print(f'  {m.get("id")} - ${price}/token')
            else:
                print(f'  {m.get("id")} - Free')
    print()

    # Show unmatched examples
    if without_pricing:
        print(f'Sample unmatched models (no pricing):')
        for m in without_pricing[:5]:
            print(f'  {m.get("id")}')
