#!/usr/bin/env python3
"""Test Chutes API endpoints"""

import sys
import requests

BASE_URL = "http://localhost:8000"

def test_chutes_models_endpoint():
    """Test the /catalog/models endpoint with chutes gateway"""
    print("Testing Chutes API endpoint...")
    print("-" * 60)

    try:
        # Test Chutes-only endpoint
        print("1. Testing gateway=chutes parameter...")
        response = requests.get(f"{BASE_URL}/catalog/models", params={"gateway": "chutes", "limit": 5})

        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Total models: {data.get('total', 0)}")
            print(f"   ✓ Returned: {data.get('returned', 0)}")
            print(f"   ✓ Gateway: {data.get('gateway', 'N/A')}")
            print(f"   ✓ Note: {data.get('note', 'N/A')}")

            if data.get('data'):
                print(f"\n   First model: {data['data'][0].get('id', 'Unknown')}")
                print(f"   Model type: {data['data'][0].get('model_type', 'Unknown')}")
        else:
            print(f"   ❌ ERROR: Status {response.status_code}")
            print(f"   Response: {response.text}")
            return False

        # Test 'all' gateway to ensure Chutes is included
        print("\n2. Testing gateway=all parameter...")
        response = requests.get(f"{BASE_URL}/catalog/models", params={"gateway": "all", "limit": 10})

        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Total models (all gateways): {data.get('total', 0)}")

            # Count Chutes models in the response
            chutes_count = sum(1 for m in data.get('data', []) if m.get('source_gateway') == 'chutes')
            print(f"   ✓ Chutes models in 'all': {chutes_count}")
        else:
            print(f"   ❌ ERROR: Status {response.status_code}")
            return False

        print("\n" + "=" * 60)
        print("✓ Chutes API test PASSED!")
        return True

    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to the API server.")
        print("   Make sure the server is running: uvicorn src.main:app --reload")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_chutes_models_endpoint()
    sys.exit(0 if success else 1)
