#!/usr/bin/env python3
"""
Test script to verify CORS configuration
"""
import requests
import json

def test_cors_headers():
    """Test CORS headers for the API"""
    
    # Test URLs - Test production after deployment
    base_url = "https://api.gatewayz.ai"  # Production URL
    test_endpoints = [
        "/referral/code",
        "/user/credit-transactions?limit=50",
        "/health"
    ]
    
    print("🧪 Testing CORS Configuration")
    print("=" * 50)
    
    for endpoint in test_endpoints:
        url = f"{base_url}{endpoint}"
        print(f"\n🔍 Testing: {url}")
        
        try:
            # Test OPTIONS request (preflight)
            response = requests.options(url, headers={
                'Origin': 'https://beta.gatewayz.ai',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Authorization, Content-Type'
            })
            
            print(f"   Status: {response.status_code}")
            print(f"   Headers:")
            
            cors_headers = [
                'Access-Control-Allow-Origin',
                'Access-Control-Allow-Methods', 
                'Access-Control-Allow-Headers',
                'Access-Control-Allow-Credentials'
            ]
            
            for header in cors_headers:
                value = response.headers.get(header, 'NOT SET')
                status = "✅" if value != 'NOT SET' else "❌"
                print(f"     {status} {header}: {value}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("💡 If you see 'NOT SET' for CORS headers, the server needs to be restarted")
    print("💡 Make sure APP_ENV is set correctly in your environment")

if __name__ == "__main__":
    test_cors_headers()
