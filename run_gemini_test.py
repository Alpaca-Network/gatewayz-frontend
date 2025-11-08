#!/usr/bin/env python3
"""
Direct Gemini 2.0 Flash API Test

This script makes a real API call to Google Vertex AI and shows the complete response.
Run this in an environment where GOOGLE_VERTEX_CREDENTIALS_JSON is set.
"""

import json
import logging
import os
import sys
from datetime import datetime

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def main():
    """Run the actual API test"""

    print("\n" + "="*100)
    print("DIRECT GEMINI 2.0 FLASH API TEST - SHOWING COMPLETE RESPONSE")
    print("="*100)

    # Check credentials
    print("\n📋 STEP 1: Checking Credentials")
    print("─" * 100)

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    project_id = os.environ.get("GOOGLE_PROJECT_ID")
    location = os.environ.get("GOOGLE_VERTEX_LOCATION", "us-central1")

    if not service_account_json:
        print("❌ GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        print("\nTo run this test, set your environment variables:")
        print("  export GOOGLE_VERTEX_CREDENTIALS_JSON='<your-service-account-json>'")
        print("  export GOOGLE_PROJECT_ID='<your-gcp-project>'")
        print("  export GOOGLE_VERTEX_LOCATION='us-central1'  # optional")
        return 1

    if not project_id:
        print("❌ GOOGLE_PROJECT_ID not set")
        print("  export GOOGLE_PROJECT_ID='<your-gcp-project>'")
        return 1

    print(f"✓ Project ID: {project_id}")
    print(f"✓ Location: {location}")
    print(f"✓ Credentials: Set (length: {len(service_account_json)} chars)")

    # Get access token
    print("\n🔑 STEP 2: Getting OAuth2 Access Token")
    print("─" * 100)

    try:
        from src.services.google_oauth2_jwt import get_access_token_from_service_account

        print("Building JWT assertion...")
        access_token = get_access_token_from_service_account(service_account_json)
        print(f"✓ Access token obtained")
        print(f"  Token preview: {access_token[:50]}...")
        print(f"  Token length: {len(access_token)} chars")

    except Exception as e:
        print(f"❌ Failed to get access token: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Make the API call
    print("\n🚀 STEP 3: Calling Gemini 2.0 Flash API")
    print("─" * 100)

    try:
        import httpx

        model = "gemini-2.0-flash"
        url = (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project_id}/"
            f"locations/{location}/"
            f"publishers/google/models/{model}:generateContent"
        )

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        request_body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": "Please explain what a JWT (JSON Web Token) is in a concise way, then provide an example structure. Format with clear sections."
                        }
                    ],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 500,
                "temperature": 0.7,
            },
        }

        print(f"Endpoint: {url}")
        print(f"Model: {model}")
        print(f"\nPrompt:")
        print("─" * 100)
        print(request_body["contents"][0]["parts"][0]["text"])
        print("─" * 100)

        print(f"\nMaking HTTP POST request...")

        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, headers=headers, json=request_body)

            if response.status_code != 200:
                print(f"\n❌ HTTP Error {response.status_code}")
                print(f"Response: {response.text}")
                return 1

            response_data = response.json()

            # Extract the response
            candidates = response_data.get("candidates", [])
            if not candidates:
                print("❌ No candidates in response")
                return 1

            candidate = candidates[0]
            content_parts = candidate.get("content", {}).get("parts", [])
            if not content_parts:
                print("❌ No content parts in response")
                return 1

            response_text = content_parts[0].get("text", "")
            finish_reason = candidate.get("finishReason", "UNKNOWN")

            print(f"✓ Response received successfully")
            print(f"  Status code: {response.status_code}")
            print(f"  Finish reason: {finish_reason}")

    except Exception as e:
        print(f"❌ API call failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Display the response
    print("\n✅ RESPONSE FROM GEMINI 2.0 FLASH")
    print("=" * 100)
    print(response_text)
    print("=" * 100)

    # Display token usage
    print("\n📊 TOKEN USAGE & METADATA")
    print("─" * 100)

    usage_metadata = candidate.get("usageMetadata", {})
    prompt_tokens = usage_metadata.get("promptTokenCount", 0)
    completion_tokens = usage_metadata.get("candidatesTokenCount", 0)

    print(f"Prompt tokens: {prompt_tokens}")
    print(f"Completion tokens: {completion_tokens}")
    print(f"Total tokens: {prompt_tokens + completion_tokens}")
    print(f"Finish reason: {finish_reason}")

    # Display full raw response (for debugging)
    print("\n🔍 FULL RAW RESPONSE (JSON)")
    print("─" * 100)
    print(json.dumps(response_data, indent=2, default=str))

    # Success message
    print("\n" + "=" * 100)
    print("✓ TEST SUCCESSFUL - Gemini 2.0 Flash is responding correctly!")
    print("=" * 100)
    print(f"\nTest completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
