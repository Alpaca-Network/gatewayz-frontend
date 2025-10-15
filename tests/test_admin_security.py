#!/usr/bin/env python3
"""
Test script to verify admin endpoint security
"""

import requests
import json

def test_admin_endpoints():
    """Test that all admin endpoints require proper authentication"""
    
    # List of admin endpoints to test
    admin_endpoints = [
        # Admin.py endpoints
        ("POST", "/admin/add_credits", {"api_key": "test", "credits": 10}),
        ("GET", "/admin/balance", None),
        ("GET", "/admin/monitor", None),
        ("POST", "/admin/limit", {"api_key": "test", "rate_limits": {}}),
        ("POST", "/admin/refresh-providers", None),
        ("GET", "/admin/cache-status", None),
        ("GET", "/admin/huggingface-cache-status", None),
        ("POST", "/admin/refresh-huggingface-cache", None),
        ("GET", "/admin/test-huggingface/test-model", None),
        ("GET", "/admin/debug-models", None),
        ("GET", "/admin/trial/analytics", None),
        
        # Plans.py endpoints
        ("POST", "/admin/assign-plan", {"user_id": 1, "plan_id": 1, "duration_months": 1}),
        
        # Notifications.py endpoints
        ("GET", "/admin/notifications/stats", None),
        ("POST", "/admin/notifications/process", None),
        
        # Rate_limits.py endpoints
        ("GET", "/admin/rate-limits/system", None),
        ("GET", "/admin/rate-limits/alerts", None),
        
        # Coupons.py endpoints (these should already be protected)
        ("POST", "/admin/coupons", {"code": "TEST", "value_usd": 10, "coupon_scope": "global", "max_uses": 1, "valid_until": "2024-12-31T23:59:59Z"}),
        ("GET", "/admin/coupons", None),
        
        # Roles.py endpoints (these should already be protected)
        ("POST", "/admin/roles/update", {"user_id": 1, "new_role": "admin", "reason": "test"}),
        ("GET", "/admin/roles/1", None),
    ]
    
    base_url = "http://localhost:8000"
    results = []
    
    print("🔒 Testing Admin Endpoint Security")
    print("=" * 60)
    
    for method, endpoint, data in admin_endpoints:
        try:
            if method == "GET":
                response = requests.get(f"{base_url}{endpoint}")
            elif method == "POST":
                response = requests.post(f"{base_url}{endpoint}", json=data)
            elif method == "PUT":
                response = requests.put(f"{base_url}{endpoint}", json=data)
            elif method == "DELETE":
                response = requests.delete(f"{base_url}{endpoint}")
            
            # Check if endpoint is properly protected
            if response.status_code == 401 or response.status_code == 403:
                status = "✅ PROTECTED"
                result = "PASS"
            elif response.status_code == 200:
                status = "❌ VULNERABLE"
                result = "FAIL"
            else:
                status = f"⚠️  UNKNOWN ({response.status_code})"
                result = "UNKNOWN"
            
            results.append({
                "endpoint": f"{method} {endpoint}",
                "status_code": response.status_code,
                "status": status,
                "result": result
            })
            
            print(f"{status} {method:4s} {endpoint:40s} - {response.status_code}")
            
        except requests.exceptions.ConnectionError:
            print(f"❌ CONNECTION ERROR - Server not running")
            break
        except Exception as e:
            print(f"❌ ERROR {method:4s} {endpoint:40s} - {str(e)}")
            results.append({
                "endpoint": f"{method} {endpoint}",
                "status_code": "ERROR",
                "status": "❌ ERROR",
                "result": "ERROR"
            })
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SECURITY TEST SUMMARY")
    print("=" * 60)
    
    total = len(results)
    protected = len([r for r in results if r["result"] == "PASS"])
    vulnerable = len([r for r in results if r["result"] == "FAIL"])
    errors = len([r for r in results if r["result"] == "ERROR"])
    
    print(f"Total Endpoints Tested: {total}")
    print(f"✅ Protected: {protected}")
    print(f"❌ Vulnerable: {vulnerable}")
    print(f"⚠️  Errors: {errors}")
    
    if vulnerable > 0:
        print(f"\n🚨 SECURITY ALERT: {vulnerable} endpoints are vulnerable!")
        print("Vulnerable endpoints:")
        for result in results:
            if result["result"] == "FAIL":
                print(f"  - {result['endpoint']}")
    else:
        print("\n🎉 All admin endpoints are properly protected!")
    
    return results

if __name__ == "__main__":
    test_admin_endpoints()
