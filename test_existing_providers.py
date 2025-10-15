"""Verify existing providers still work after Fireworks/Together integration"""
import requests
import json

def test_provider(gateway_name, test_url):
    """Test a provider's catalog endpoint"""
    print(f"\n{'='*60}")
    print(f"Testing {gateway_name.upper()} Gateway")
    print('='*60)
    
    try:
        r = requests.get(test_url, timeout=15)
        print(f"Status Code: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            models = data.get('data', [])
            print(f"✅ SUCCESS - {len(models)} models available")
            print(f"Gateway: {data.get('gateway', 'N/A')}")
            
            if models:
                print(f"\nSample models:")
                for i, model in enumerate(models[:3]):
                    print(f"  {i+1}. {model.get('id', 'N/A')} - {model.get('name', 'N/A')}")
            
            return True
        else:
            print(f"❌ FAILED - Status {r.status_code}")
            print(f"Error: {r.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

# Test server health first
print("Testing server health...")
try:
    r = requests.get('http://localhost:8000/health', timeout=5)
    if r.status_code == 200:
        print(f"✅ Server is running - {r.json().get('status')}")
    else:
        print(f"⚠️ Server health check failed: {r.status_code}")
except Exception as e:
    print(f"❌ Server not responding: {e}")
    print("\n⚠️ Please start the server with: uvicorn src.main:app --reload")
    exit(1)

# Test each provider
results = {}
results['portkey'] = test_provider('Portkey', 'http://localhost:8000/catalog/models?gateway=portkey')
results['featherless'] = test_provider('Featherless', 'http://localhost:8000/catalog/models?gateway=featherless')
results['chutes'] = test_provider('Chutes', 'http://localhost:8000/catalog/models?gateway=chutes')
results['fireworks'] = test_provider('Fireworks', 'http://localhost:8000/catalog/models?gateway=fireworks')
results['together'] = test_provider('Together', 'http://localhost:8000/catalog/models?gateway=together')

# Summary
print(f"\n{'='*60}")
print("SUMMARY")
print('='*60)
for provider, status in results.items():
    status_icon = "✅" if status else "❌"
    print(f"{status_icon} {provider.capitalize()}: {'Working' if status else 'Failed'}")

print(f"\n{'='*60}")
if all(results.values()):
    print("✅ ALL PROVIDERS WORKING")
else:
    print("⚠️ SOME PROVIDERS FAILED - Server may need restart")
    print("Run: uvicorn src.main:app --reload")
print('='*60)