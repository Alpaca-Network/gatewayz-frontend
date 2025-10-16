#!/usr/bin/env python3
"""
Test script for Modelz integration endpoints.
Tests the new /models/modelz endpoints to ensure they work correctly.
"""

import asyncio
import httpx
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

async def test_modelz_endpoints():
    """Test all Modelz integration endpoints."""
    
    async with httpx.AsyncClient() as client:
        print("🧪 Testing Modelz Integration Endpoints")
        print("=" * 50)
        
        # Test 1: Get all models from Modelz
        print("\n1️⃣ Testing /modelz/models (all models)")
        try:
            response = await client.get(f"{BASE_URL}/modelz/models")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success: Found {data.get('total_count', 0)} models")
                print(f"   Filter: {data.get('filter', {}).get('description', 'Unknown')}")
                if data.get('models') and len(data['models']) > 0:
                    sample_model = data['models'][0]
                    print(f"   Sample model: {sample_model.get('model_id', 'Unknown')}")
                    print(f"   Is graduated: {sample_model.get('is_graduated', 'Unknown')}")
            else:
                print(f"❌ Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        # Test 2: Get graduated models only
        print("\n2️⃣ Testing /modelz/models?isGraduated=true (graduated models)")
        try:
            response = await client.get(f"{BASE_URL}/modelz/models?isGraduated=true")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success: Found {data.get('total_count', 0)} graduated models")
                print(f"   Filter: {data.get('filter', {}).get('description', 'Unknown')}")
            else:
                print(f"❌ Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        # Test 3: Get non-graduated models only
        print("\n3️⃣ Testing /modelz/models?isGraduated=false (non-graduated models)")
        try:
            response = await client.get(f"{BASE_URL}/modelz/models?isGraduated=false")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success: Found {data.get('total_count', 0)} non-graduated models")
                print(f"   Filter: {data.get('filter', {}).get('description', 'Unknown')}")
            else:
                print(f"❌ Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        # Test 4: Get model IDs only
        print("\n4️⃣ Testing /modelz/ids (model IDs only)")
        try:
            response = await client.get(f"{BASE_URL}/modelz/ids")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success: Found {data.get('total_count', 0)} model IDs")
                if data.get('model_ids') and len(data['model_ids']) > 0:
                    print(f"   Sample IDs: {data['model_ids'][:3]}")
            else:
                print(f"❌ Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        # Test 5: Check specific model (if we have any models)
        print("\n5️⃣ Testing /modelz/check/{model_id}")
        try:
            # First get a model ID to test with
            response = await client.get(f"{BASE_URL}/modelz/ids")
            if response.status_code == 200:
                data = response.json()
                if data.get('model_ids') and len(data['model_ids']) > 0:
                    test_model_id = data['model_ids'][0]
                    print(f"   Testing with model: {test_model_id}")
                    
                    check_response = await client.get(f"{BASE_URL}/modelz/check/{test_model_id}")
                    if check_response.status_code == 200:
                        check_data = check_response.json()
                        print(f"✅ Success: Model exists: {check_data.get('exists_on_modelz', False)}")
                        if check_data.get('model_details'):
                            print(f"   Has model details: Yes")
                    else:
                        print(f"❌ Error: {check_response.status_code} - {check_response.text}")
                else:
                    print("⚠️  No models found to test with")
            else:
                print(f"❌ Error getting model IDs: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        # Test 6: Test with non-existent model
        print("\n6️⃣ Testing /modelz/check/non-existent-model")
        try:
            response = await client.get(f"{BASE_URL}/modelz/check/non-existent-model")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success: Model exists: {data.get('exists_on_modelz', False)}")
            else:
                print(f"❌ Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        print("\n" + "=" * 50)
        print("🏁 Modelz Integration Tests Complete")

async def test_direct_modelz_api():
    """Test the direct Modelz API to compare responses."""
    
    print("\n🔗 Testing Direct Modelz API")
    print("=" * 30)
    
    async with httpx.AsyncClient() as client:
        try:
            # Test direct Modelz API
            response = await client.get("https://backend.alpacanetwork.ai/api/tokens")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Direct Modelz API: {len(data) if isinstance(data, list) else 'Unknown'} items")
                if isinstance(data, list) and len(data) > 0:
                    sample = data[0]
                    print(f"   Sample keys: {list(sample.keys())}")
            else:
                print(f"❌ Direct Modelz API Error: {response.status_code}")
        except Exception as e:
            print(f"❌ Direct Modelz API Exception: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting Modelz Integration Tests")
    print("Make sure your Gatewayz server is running on http://localhost:8000")
    print()
    
    # Run tests
    asyncio.run(test_modelz_endpoints())
    asyncio.run(test_direct_modelz_api())
