#!/usr/bin/env python3
"""
Production Model Endpoint Testing Script
Tests all gateway model endpoints on https://api.gatewayz.ai
"""

import requests
import json
from datetime import datetime
from typing import Dict, List, Tuple

# Production API URL
PROD_URL = "https://api.gatewayz.ai"

# All gateways to test
GATEWAYS = [
    "openrouter",
    "portkey", 
    "chutes",
    "featherless",
    "together",
    "fireworks",
    "groq"
]

def test_gateway_models(gateway: str, limit: int = 3) -> Tuple[bool, Dict]:
    """Test a gateway's model catalog endpoint"""
    url = f"{PROD_URL}/catalog/models"
    params = {"gateway": gateway, "limit": limit}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        
        result = {
            "gateway": gateway,
            "status_code": response.status_code,
            "success": response.status_code == 200,
            "response_time_ms": int(response.elapsed.total_seconds() * 1000),
            "error": None,
            "model_count": 0,
            "sample_models": []
        }
        
        if response.status_code == 200:
            data = response.json()
            if "data" in data and isinstance(data["data"], list):
                result["model_count"] = len(data["data"])
                result["sample_models"] = [m.get("id", "N/A") for m in data["data"][:3]]
        else:
            result["error"] = response.text[:200]
            
        return result["success"], result
        
    except Exception as e:
        return False, {
            "gateway": gateway,
            "status_code": 0,
            "success": False,
            "response_time_ms": 0,
            "error": str(e),
            "model_count": 0,
            "sample_models": []
        }

def test_specific_model(gateway: str, model_id: str) -> Tuple[bool, Dict]:
    """Test fetching a specific model"""
    url = f"{PROD_URL}/catalog/model/{model_id}"
    params = {"gateway": gateway}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        
        result = {
            "gateway": gateway,
            "model_id": model_id,
            "status_code": response.status_code,
            "success": response.status_code == 200,
            "response_time_ms": int(response.elapsed.total_seconds() * 1000),
            "error": None
        }
        
        if response.status_code != 200:
            result["error"] = response.text[:200]
            
        return result["success"], result
        
    except Exception as e:
        return False, {
            "gateway": gateway,
            "model_id": model_id,
            "status_code": 0,
            "success": False,
            "response_time_ms": 0,
            "error": str(e)
        }

def print_header(text: str):
    """Print formatted header"""
    print(f"\n{'='*80}")
    print(f"  {text}")
    print(f"{'='*80}\n")

def print_result(gateway: str, result: Dict):
    """Print test result in formatted way"""
    status = "✅ PASS" if result["success"] else "❌ FAIL"
    print(f"{status} {gateway.upper():<15} | Status: {result['status_code']:<4} | "
          f"Response: {result['response_time_ms']:>5}ms | Models: {result['model_count']}")
    
    if result["sample_models"]:
        print(f"     Sample models: {', '.join(result['sample_models'][:2])}")
    
    if result["error"]:
        print(f"     ⚠️  Error: {result['error'][:100]}")

def main():
    print_header("🧪 Production Model Endpoint Testing")
    print(f"Testing URL: {PROD_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Gateways: {len(GATEWAYS)}")
    
    all_results = []
    passed = 0
    failed = 0
    
    # Test 1: List models for each gateway
    print_header("Test 1: Model Catalog Endpoints")
    
    for gateway in GATEWAYS:
        success, result = test_gateway_models(gateway, limit=5)
        all_results.append(result)
        print_result(gateway, result)
        
        if success:
            passed += 1
        else:
            failed += 1
    
    # Test 2: Specific model lookups
    print_header("Test 2: Specific Model Lookups")
    
    test_models = [
        ("openrouter", "openai/gpt-4"),
        ("groq", "llama-3.1-70b-versatile"),
        ("together", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"),
    ]
    
    for gateway, model_id in test_models:
        success, result = test_specific_model(gateway, model_id)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {gateway.upper():<15} | Model: {model_id:<50} | "
              f"Status: {result['status_code']}")
        
        if result.get("error"):
            print(f"     ⚠️  Error: {result['error'][:100]}")
    
    # Summary
    print_header("📊 Test Summary")
    
    total_tests = passed + failed
    success_rate = (passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    # Gateway breakdown
    print("\n🌐 Gateway Status:")
    for result in all_results:
        status = "🟢 ONLINE" if result["success"] else "🔴 OFFLINE"
        print(f"  {status:<12} {result['gateway'].upper():<15} - {result['model_count']} models")
    
    # Save results to file
    output_file = f"production_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump({
            "test_time": datetime.now().isoformat(),
            "prod_url": PROD_URL,
            "total_tests": total_tests,
            "passed": passed,
            "failed": failed,
            "success_rate": success_rate,
            "results": all_results
        }, f, indent=2)
    
    print(f"\n💾 Results saved to: {output_file}")
    
    # Exit code based on results
    if failed > 0:
        print("\n⚠️  Some tests failed. Please check the results above.")
        return 1
    else:
        print("\n✅ All tests passed! Production endpoints are working correctly.")
        return 0

if __name__ == "__main__":
    exit(main())