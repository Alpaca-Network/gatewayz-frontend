#!/usr/bin/env python3
"""
Test script to verify model statistics match the JavaScript processing
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def print_model_stats():
    """Fetch and display model statistics in a format similar to the JS output"""
    
    print("=" * 80)
    print("MODEL STATISTICS - Transaction Analytics")
    print("=" * 80)
    
    # Get summary data
    response = requests.get(f"{BASE_URL}/analytics/transactions/summary?window=1d")
    
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        return
    
    data = response.json()
    summary = data.get("summary", {})
    models_stats = summary.get("models_stats", {})
    
    print(f"\nWindow: {summary.get('window')}")
    print(f"Total Requests: {summary.get('total_requests')}")
    print(f"Total Cost: ${summary.get('total_cost')}")
    print(f"Models Count: {summary.get('models_count')}")
    print("\n" + "=" * 80)
    
    # Print per-model stats (similar to JS output)
    for model, stats in models_stats.items():
        print(f"\nModel: {model}")
        print(f"  Requests (sum): {stats['requests']}")
        print(f"\n  Tokens:")
        
        # Prompt tokens
        p = stats['tokens']['prompt']
        print(f"    Prompt     - min: {p['min']:<6} max: {p['max']:<6} avg: {p['avg']:<8.2f} sum: {p['sum']}")
        
        # Completion tokens
        c = stats['tokens']['completion']
        print(f"    Completion - min: {c['min']:<6} max: {c['max']:<6} avg: {c['avg']:<8.2f} sum: {c['sum']}")
        
        # Reasoning tokens
        r = stats['tokens']['reasoning']
        print(f"    Reasoning  - min: {r['min']:<6} max: {r['max']:<6} avg: {r['avg']:<8.2f} sum: {r['sum']}")
        
        # Total tokens
        t = stats['tokens']['total']
        print(f"    Total      - min: {t['min']:<6} max: {t['max']:<6} avg: {t['avg']:<8.2f} sum: {t['sum']}")
        
        # Usage
        u = stats['usage']
        print(f"\n  Usage - min: {u['min']:<12.6f} max: {u['max']:<12.6f} avg: {u['avg']:<12.6f} sum: {u['sum']:<12.6f}")
        print()
    
    print("=" * 80)

if __name__ == "__main__":
    print_model_stats()

