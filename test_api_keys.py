"""Test if API keys are loaded correctly"""
from src.config import Config

print("Checking API Key Configuration:")
print("=" * 60)
print(f"FEATHERLESS_API_KEY: {'✓ Set' if Config.FEATHERLESS_API_KEY else '✗ Not set'}")
if Config.FEATHERLESS_API_KEY:
    print(f"  Value: {Config.FEATHERLESS_API_KEY[:20]}...")
    
print(f"GROQ_API_KEY: {'✓ Set' if Config.GROQ_API_KEY else '✗ Not set'}")
if Config.GROQ_API_KEY:
    print(f"  Value: {Config.GROQ_API_KEY[:20]}...")
    
print(f"FIREWORKS_API_KEY: {'✓ Set' if Config.FIREWORKS_API_KEY else '✗ Not set'}")
if Config.FIREWORKS_API_KEY:
    print(f"  Value: {Config.FIREWORKS_API_KEY[:20]}...")
    
print(f"TOGETHER_API_KEY: {'✓ Set' if Config.TOGETHER_API_KEY else '✗ Not set'}")
if Config.TOGETHER_API_KEY:
    print(f"  Value: {Config.TOGETHER_API_KEY[:20]}...")

print("\n" + "=" * 60)
print("Testing API Calls:")
print("=" * 60)

# Test Groq
print("\n[1] Testing Groq API...")
if Config.GROQ_API_KEY:
    try:
        import httpx
        response = httpx.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {Config.GROQ_API_KEY}"},
            timeout=10.0
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            model_count = len(data.get("data", []))
            print(f"  ✓ Success - {model_count} models available")
        else:
            print(f"  ✗ Error: {response.text[:100]}")
    except Exception as e:
        print(f"  ✗ Exception: {e}")
else:
    print("  ✗ Skipped - No API key")

# Test Fireworks
print("\n[2] Testing Fireworks API...")
if Config.FIREWORKS_API_KEY:
    try:
        import httpx
        response = httpx.get(
            "https://api.fireworks.ai/inference/v1/models",
            headers={"Authorization": f"Bearer {Config.FIREWORKS_API_KEY}"},
            timeout=10.0
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            model_count = len(data.get("data", []))
            print(f"  ✓ Success - {model_count} models available")
        else:
            print(f"  ✗ Error: {response.text[:100]}")
    except Exception as e:
        print(f"  ✗ Exception: {e}")
else:
    print("  ✗ Skipped - No API key")

# Test Together
print("\n[3] Testing Together API...")
if Config.TOGETHER_API_KEY:
    try:
        import httpx
        response = httpx.get(
            "https://api.together.xyz/v1/models",
            headers={"Authorization": f"Bearer {Config.TOGETHER_API_KEY}"},
            timeout=10.0
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                model_count = len(data)
            else:
                model_count = len(data.get("data", []))
            print(f"  ✓ Success - {model_count} models available")
        else:
            print(f"  ✗ Error: {response.text[:100]}")
    except Exception as e:
        print(f"  ✗ Exception: {e}")
else:
    print("  ✗ Skipped - No API key")

# Test Featherless
print("\n[4] Testing Featherless API...")
if Config.FEATHERLESS_API_KEY:
    try:
        import httpx
        response = httpx.get(
            "https://api.featherless.ai/v1/models",
            headers={"Authorization": f"Bearer {Config.FEATHERLESS_API_KEY}"},
            timeout=10.0
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            model_count = len(data.get("data", []))
            print(f"  ✓ Success - {model_count} models available")
        else:
            print(f"  ✗ Error: {response.text[:100]}")
    except Exception as e:
        print(f"  ✗ Exception: {e}")
else:
    print("  ✗ Skipped - No API key")

print("\n" + "=" * 60)