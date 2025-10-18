#!/usr/bin/env python3
"""Test multi-sort strategy for fetching all HuggingFace models"""
import os
from dotenv import load_dotenv
load_dotenv(override=True)

import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

from src.services.huggingface_models import fetch_models_from_huggingface_api

print("=" * 70)
print("TESTING MULTI-SORT STRATEGY FOR HUGGINGFACE MODELS")
print("=" * 70)

print("\nFetching models using multi-sort strategy...")
print("This will fetch with sort=likes and sort=downloads, then merge unique results\n")

models = fetch_models_from_huggingface_api(task=None, limit=None, use_cache=False)

if models:
    print("\n" + "=" * 70)
    print(f"SUCCESS! Fetched {len(models)} unique HuggingFace models")
    print("=" * 70)
    print(f"\nFirst 5 models:")
    for i, model in enumerate(models[:5], 1):
        print(f"{i}. {model['id']}")
    print(f"\nLast 5 models:")
    for i, model in enumerate(models[-5:], len(models)-4):
        print(f"{i}. {model['id']}")
    print("\n" + "=" * 70)
else:
    print("\n" + "=" * 70)
    print("FAILED: No models returned")
    print("=" * 70)
