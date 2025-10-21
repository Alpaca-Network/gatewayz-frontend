import os
from dotenv import load_dotenv
load_dotenv(override=True)

import httpx
import json

print("=" * 70)
print("ARCH-ROUTER MODEL TEST")
print("=" * 70)

# Verify model exists
print("\n1. Checking backend for Arch-Router model...")
try:
    from src.services.models import get_cached_models
    
    hug_models = get_cached_models("hug")
    
    if hug_models:
        archer = [m for m in hug_models if m.get("id") == "katanemo/Arch-Router-1.5B"]
        if archer:
            model = archer[0]
            print("   [OK] Model found in backend")
            print("   ID: " + model.get('id'))
            print("   Gateway: " + model.get('source_gateway'))
        else:
            print("   [FAIL] Model not found")
            exit(1)
    else:
        print("   [FAIL] No HF models in cache")
        exit(1)
except Exception as e:
    print("   [ERROR] " + str(e))
    exit(1)

# Test with HF API
print("\n2. Sending test message to Arch-Router...")
print("-" * 70)

try:
    hf_api_key = os.getenv("HUG_API_KEY")
    
    if not hf_api_key:
        print("   [ERROR] HUG_API_KEY not set")
        exit(1)
    
    api_url = "https://api-inference.huggingface.co/models/katanemo/Arch-Router-1.5B"
    headers = {
        "Authorization": "Bearer " + hf_api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": "What is the capital of France?",
        "parameters": {
            "max_new_tokens": 100,
        }
    }
    
    print("   Sending request...")
    response = httpx.post(api_url, json=payload, headers=headers, timeout=60.0)
    
    print("   Status: " + str(response.status_code))
    
    if response.status_code == 200:
        result = response.json()
        print("\n   [SUCCESS] Response from Arch-Router:")
        print("-" * 70)
        
        if isinstance(result, list) and len(result) > 0:
            output = result[0]
            if "generated_text" in output:
                print("   " + output["generated_text"])
        else:
            print("   " + json.dumps(result, indent=2))
        
    elif response.status_code == 503:
        print("   [INFO] Model is loading (cold start)")
        print("   Response: " + response.text)
    else:
        print("   [ERROR] Status " + str(response.status_code))
        print("   Details: " + response.text)

except Exception as e:
    print("   [ERROR] " + str(e))
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)

