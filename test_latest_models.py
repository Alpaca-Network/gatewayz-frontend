#!/usr/bin/env python3
"""
Test the ranking models endpoint with latest_models table
"""

import requests
import json

def test_latest_models_endpoint():
    """Test the /ranking/models endpoint with latest_models table"""
    print("🧪 Testing /ranking/models endpoint (latest_models table)")
    print("=" * 60)
    
    try:
        # Test the endpoint
        response = requests.get("http://localhost:8000/ranking/models?limit=5")
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Endpoint working!")
            print(f"Success: {data.get('success', False)}")
            print(f"Has logo URLs: {data.get('has_logo_urls', False)}")
            print(f"Models returned: {len(data.get('data', []))}")
            
            # Show sample data
            models = data.get('data', [])
            if models:
                print("\n📊 Sample Models:")
                print("-" * 60)
                for i, model in enumerate(models, 1):
                    rank = model.get('rank', 'N/A')
                    model_name = model.get('model_name', 'N/A')
                    author = model.get('author', 'N/A')
                    logo_url = model.get('logo_url', 'N/A')
                    print(f"{i:2d}. Rank: {rank:2d} | {model_name:25s} | {author:10s}")
                    if logo_url != 'N/A':
                        print(f"     Logo: {logo_url}")
                
                # Check rankings
                ranks = [m.get('rank') for m in models if 'rank' in m]
                print(f"\nRanks: {ranks}")
                
                if len(set(ranks)) == 1:
                    print("⚠️  All models have the same rank!")
                else:
                    print("✅ Ranks are different")
            else:
                print("❌ No models returned")
        else:
            print(f"❌ Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Make sure the API server is running")
        print("   Run: python main.py")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_latest_models_endpoint()
