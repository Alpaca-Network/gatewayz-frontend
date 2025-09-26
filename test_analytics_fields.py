#!/usr/bin/env python3
"""
Test script to verify the new analytics fields in the /provider endpoint
"""

import requests
import json

def test_analytics_fields():
    """Test the new token_generated and weekly_growth fields"""
    base_url = "http://localhost:8000"
    
    print("Testing Analytics Fields in /provider Endpoint")
    print("=" * 60)
    
    # Test 1: Get providers and check for new fields
    print("\n1. Testing /provider endpoint with new analytics fields")
    try:
        response = requests.get(f"{base_url}/provider?limit=10")
        if response.status_code == 200:
            data = response.json()
            providers = data.get('data', [])
            
            print(f"✅ Found {len(providers)} providers")
            
            # Check each provider for new analytics fields
            for i, provider in enumerate(providers):
                print(f"\nProvider {i+1}: {provider.get('name')} ({provider.get('slug')})")
                
                # Check token_generated
                token_generated = provider.get('token_generated')
                if token_generated:
                    print(f"  ✅ token_generated: {token_generated}")
                else:
                    print(f"  ❌ token_generated is missing")
                
                # Check weekly_growth
                weekly_growth = provider.get('weekly_growth')
                if weekly_growth:
                    print(f"  ✅ weekly_growth: {weekly_growth}")
                else:
                    print(f"  ❌ weekly_growth is missing")
                
                # Check other existing fields
                print(f"  model_count: {provider.get('model_count')}")
                print(f"  site_url: {provider.get('site_url')}")
                print(f"  logo_url: {provider.get('logo_url')}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 2: Check specific providers mentioned in the issue
    print("\n2. Testing specific providers (SiliconFlow, Stealth, Z.AI)")
    specific_providers = ['siliconflow', 'stealth', 'z-ai']
    
    for provider_slug in specific_providers:
        try:
            response = requests.get(f"{base_url}/provider")
            if response.status_code == 200:
                data = response.json()
                providers = data.get('data', [])
                
                # Find the specific provider
                target_provider = None
                for provider in providers:
                    if provider.get('slug') == provider_slug:
                        target_provider = provider
                        break
                
                if target_provider:
                    print(f"\n✅ Found {provider_slug}:")
                    print(f"  Name: {target_provider.get('name')}")
                    print(f"  token_generated: {target_provider.get('token_generated')}")
                    print(f"  weekly_growth: {target_provider.get('weekly_growth')}")
                    print(f"  model_count: {target_provider.get('model_count')}")
                    print(f"  site_url: {target_provider.get('site_url')}")
                    print(f"  logo_url: {target_provider.get('logo_url')}")
                else:
                    print(f"❌ Provider {provider_slug} not found")
            else:
                print(f"❌ Error fetching providers: {response.status_code}")
        except Exception as e:
            print(f"❌ Exception for {provider_slug}: {e}")
    
    # Test 3: Verify data format
    print("\n3. Testing data format validation")
    try:
        response = requests.get(f"{base_url}/provider?limit=5")
        if response.status_code == 200:
            data = response.json()
            providers = data.get('data', [])
            
            for provider in providers:
                token_generated = provider.get('token_generated', '')
                weekly_growth = provider.get('weekly_growth', '')
                
                # Check token_generated format (should be like "21.1B")
                if token_generated and ('B' in token_generated or 'M' in token_generated or 'K' in token_generated):
                    print(f"✅ {provider.get('slug')}: token_generated format is correct ({token_generated})")
                else:
                    print(f"❌ {provider.get('slug')}: token_generated format is incorrect ({token_generated})")
                
                # Check weekly_growth format (should be like "+25.4%")
                if weekly_growth and ('+' in weekly_growth or '-' in weekly_growth) and '%' in weekly_growth:
                    print(f"✅ {provider.get('slug')}: weekly_growth format is correct ({weekly_growth})")
                else:
                    print(f"❌ {provider.get('slug')}: weekly_growth format is incorrect ({weekly_growth})")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print(f"\n{'='*60}")
    print("Analytics Fields Test Summary:")
    print("- Check that token_generated and weekly_growth fields are present")
    print("- Check that data formats are correct (B/M/K for tokens, +/-% for growth)")
    print("- Check that specific providers have the expected data")
    print("- Note: These are currently mock values as OpenRouter API doesn't provide these metrics")

if __name__ == "__main__":
    test_analytics_fields()
