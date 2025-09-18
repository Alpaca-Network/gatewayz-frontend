#!/usr/bin/env python3
"""
Test script for pricing endpoints
Tests both /plans and /subscription/plans endpoints
"""

import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:8000"

def test_plans_endpoint():
    """Test the /plans endpoint"""
    print("🔍 Testing /plans endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/plans")
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Found {len(data)} plans")
            
            for plan in data:
                print(f"\n📋 Plan: {plan.get('name', 'Unknown')}")
                print(f"   Description: {plan.get('description', 'N/A')}")
                print(f"   Price: ${plan.get('price_per_month', 0):.2f}/month")
                print(f"   Monthly Tokens: {plan.get('monthly_token_limit', 0):,}")
                print(f"   Monthly Requests: {plan.get('monthly_request_limit', 0):,}")
                print(f"   Features: {', '.join(plan.get('features', []))}")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

def test_subscription_plans_endpoint():
    """Test the /subscription/plans endpoint"""
    print("\n🔍 Testing /subscription/plans endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/subscription/plans")
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Found {len(data.get('plans', []))} plans")
            
            print(f"\n📊 Trial Info:")
            trial_info = data.get('trial_info', {})
            print(f"   Trial Days: {trial_info.get('trial_days', 0)}")
            print(f"   Trial Credits: ${trial_info.get('trial_credits', 0):.2f}")
            print(f"   Trial Tokens: {trial_info.get('trial_tokens', 0):,}")
            print(f"   Trial Requests: {trial_info.get('trial_requests', 0):,}")
            
            print(f"\n📋 Plans:")
            for plan in data.get('plans', []):
                print(f"\n   Plan: {plan.get('name', 'Unknown')}")
                print(f"   Description: {plan.get('description', 'N/A')}")
                print(f"   Price: ${plan.get('price_per_month', 0):.2f}/month")
                print(f"   Plan Type: {plan.get('plan_type', 'unknown')}")
                print(f"   Trial Days: {plan.get('trial_days', 0)}")
                print(f"   Trial Credits: ${plan.get('trial_credits', 0):.2f}")
                print(f"   Monthly Tokens: {plan.get('monthly_token_limit', 0):,}")
                print(f"   Monthly Requests: {plan.get('monthly_request_limit', 0):,}")
                print(f"   Concurrent Requests: {plan.get('max_concurrent_requests', 0)}")
                print(f"   Features: {', '.join(plan.get('features', []))}")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

def test_pricing_calculation():
    """Test pricing calculations"""
    print("\n💰 Testing pricing calculations...")
    
    # Standard pricing: $20 per 1M tokens
    price_per_token = 0.00002
    price_per_1k = 0.02
    price_per_1m = 20.00
    
    test_cases = [
        (1000, "1K tokens"),
        (10000, "10K tokens"),
        (100000, "100K tokens"),
        (1000000, "1M tokens"),
        (5000000, "5M tokens"),
        (25000000, "25M tokens"),
        (100000000, "100M tokens")
    ]
    
    print(f"   Price per token: ${price_per_token:.6f}")
    print(f"   Price per 1K tokens: ${price_per_1k:.4f}")
    print(f"   Price per 1M tokens: ${price_per_1m:.2f}")
    
    print(f"\n   Test Cases:")
    for tokens, description in test_cases:
        cost = tokens * price_per_token
        print(f"   {description}: ${cost:.2f}")

def main():
    """Run all tests"""
    print("🚀 Testing Pricing Endpoints")
    print("=" * 50)
    
    # Test both endpoints
    test_plans_endpoint()
    test_subscription_plans_endpoint()
    
    # Test pricing calculations
    test_pricing_calculation()
    
    print("\n" + "=" * 50)
    print("✅ Testing complete!")

if __name__ == "__main__":
    main()
