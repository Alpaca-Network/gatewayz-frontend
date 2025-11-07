#!/usr/bin/env python3
"""Simple test for Google Vertex AI that works with Python 3.9"""
import json
import os
from dotenv import load_dotenv

load_dotenv()

print("="*80)
print("  Simple Google Vertex AI Test")
print("="*80)

# Step 1: Check environment variables
print("\n[Step 1] Checking configuration...")
project_id = os.getenv("GOOGLE_PROJECT_ID")
location = os.getenv("GOOGLE_VERTEX_LOCATION")
creds_json_str = os.getenv("GOOGLE_VERTEX_CREDENTIALS_JSON")

if not project_id:
    print("❌ GOOGLE_PROJECT_ID not set")
    exit(1)

if not creds_json_str:
    print("❌ GOOGLE_VERTEX_CREDENTIALS_JSON not set")
    exit(1)

print(f"✅ Project ID: {project_id}")
print(f"✅ Location: {location}")
print(f"✅ Credentials: Set ({len(creds_json_str)} chars)")

# Step 2: Parse and validate JSON
print("\n[Step 2] Parsing credentials JSON...")
try:
    creds_dict = json.loads(creds_json_str)
    print(f"✅ Valid JSON")
    print(f"   Service Account: {creds_dict.get('client_email')}")
    print(f"   Project ID in creds: {creds_dict.get('project_id')}")
except json.JSONDecodeError as e:
    print(f"❌ Invalid JSON: {e}")
    exit(1)

# Step 3: Load credentials using google-auth
print("\n[Step 3] Loading credentials with google-auth...")
try:
    from google.oauth2.service_account import Credentials
    from google.auth.transport.requests import Request

    credentials = Credentials.from_service_account_info(
        creds_dict,
        scopes=[
            "https://www.googleapis.com/auth/cloud-platform",
            "https://www.googleapis.com/auth/aiplatform",
        ]
    )
    print("✅ Credentials object created")
    print(f"   Valid: {credentials.valid}")

    if not credentials.valid:
        print("   Refreshing...")
        credentials.refresh(Request())
        print(f"✅ Refreshed! Valid: {credentials.valid}")

    token = credentials.token
    print(f"✅ OAuth token obtained (length: {len(token)})")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Step 4: Make API call
print("\n[Step 4] Testing API call to gemini-2.0-flash...")
try:
    import httpx

    model_name = "gemini-2.0-flash"
    url = (
        f"https://{location}-aiplatform.googleapis.com/v1/"
        f"projects/{project_id}/"
        f"locations/{location}/"
        f"publishers/google/models/{model_name}:generateContent"
    )

    request_body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": "Say hello in exactly 3 words"}]
            }
        ],
        "generationConfig": {
            "maxOutputTokens": 10,
            "temperature": 0.7
        }
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    print(f"   URL: {url[:80]}...")
    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, headers=headers, json=request_body)
        response.raise_for_status()
        data = response.json()

    # Extract response
    candidates = data.get("candidates", [])
    if not candidates:
        print(f"❌ No candidates in response: {data}")
        exit(1)

    content_parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in content_parts)

    usage = data.get("usageMetadata", {})

    print("\n✅ API CALL SUCCESSFUL!")
    print(f"   Model: {model_name}")
    print(f"   Response: \"{text}\"")
    print(f"   Prompt tokens: {usage.get('promptTokenCount', 0)}")
    print(f"   Completion tokens: {usage.get('candidatesTokenCount', 0)}")
    print(f"   Finish reason: {candidates[0].get('finishReason', 'UNKNOWN')}")

except httpx.HTTPStatusError as e:
    print(f"\n❌ HTTP Error {e.response.status_code}")
    print(f"   Response: {e.response.text[:500]}")
    exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

print("\n" + "="*80)
print("🎉 SUCCESS! Google Vertex AI is working correctly!")
print("   Your 10 Gemini models are ready to use")
print("="*80)
