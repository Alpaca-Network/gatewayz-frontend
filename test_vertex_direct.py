#!/usr/bin/env python3
"""
Direct test of Google Vertex AI Gemini API
Uses credentials from .env file
"""

import json
import os
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import requests

# Load credentials from .env
from dotenv import load_dotenv
load_dotenv()

# Parse service account JSON from env
credentials_json = os.getenv('GOOGLE_VERTEX_CREDENTIALS_JSON')
if not credentials_json:
    print("❌ GOOGLE_VERTEX_CREDENTIALS_JSON not found in .env")
    exit(1)

credentials_dict = json.loads(credentials_json)
project_id = os.getenv('GOOGLE_PROJECT_ID', 'gatewayz-468519')
location = os.getenv('GOOGLE_VERTEX_LOCATION', 'us-central1')

# Create credentials
credentials = service_account.Credentials.from_service_account_info(
    credentials_dict,
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)

# Get access token
credentials.refresh(Request())
access_token = credentials.token

print(f"✅ Got access token: {access_token[:20]}...")
print(f"📍 Project: {project_id}")
print(f"📍 Location: {location}")
print()

# Test Gemini 2.0 Flash
model = "gemini-2.0-flash-001"
url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/{model}:generateContent"

print(f"🧪 Testing model: {model}")
print(f"📡 URL: {url}")
print()

payload = {
    "contents": [{
        "role": "user",
        "parts": [{"text": "Say hello and tell me what model you are"}]
    }],
    "generationConfig": {
        "maxOutputTokens": 100,
        "temperature": 0.7
    }
}

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

response = requests.post(url, headers=headers, json=payload)

print(f"📊 Status Code: {response.status_code}")
print()

if response.status_code == 200:
    result = response.json()
    print("✅ SUCCESS!")
    print(json.dumps(result, indent=2))

    # Extract the text response
    if 'candidates' in result and len(result['candidates']) > 0:
        text = result['candidates'][0]['content']['parts'][0]['text']
        print()
        print("💬 Response:", text)
else:
    print("❌ FAILED!")
    print(response.text)
