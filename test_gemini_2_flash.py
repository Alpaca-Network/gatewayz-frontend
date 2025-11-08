#!/usr/bin/env python3
"""
Test script for Google Vertex AI Gemini 2.0 Flash integration

This script tests the complete authentication flow and API integration
with the new lightweight JWT exchange.
"""

import json
import logging
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def test_gemini_2_flash():
    """Test Gemini 2.0 Flash with a simple prompt"""

    print("\n" + "="*80)
    print("TESTING GOOGLE VERTEX AI - GEMINI 2.0 FLASH")
    print("="*80)

    # Step 1: Check environment variables
    print("\n1. Checking environment variables...")
    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    project_id = os.environ.get("GOOGLE_PROJECT_ID")
    location = os.environ.get("GOOGLE_VERTEX_LOCATION")

    if not service_account_json:
        print("   ✗ GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        print("\nTo run this test, set:")
        print("   export GOOGLE_VERTEX_CREDENTIALS_JSON='<your-service-account-json>'")
        print("   export GOOGLE_PROJECT_ID='<your-gcp-project-id>'")
        print("   export GOOGLE_VERTEX_LOCATION='<region, e.g., us-central1>'")
        return False

    if not project_id:
        print("   ✗ GOOGLE_PROJECT_ID not set")
        return False

    if not location:
        print("   ✗ GOOGLE_VERTEX_LOCATION not set")
        return False

    print(f"   ✓ GOOGLE_PROJECT_ID: {project_id}")
    print(f"   ✓ GOOGLE_VERTEX_LOCATION: {location}")
    print("   ✓ GOOGLE_VERTEX_CREDENTIALS_JSON: Set (length: {})".format(
        len(service_account_json)
    ))

    # Step 2: Test JWT authentication
    print("\n2. Testing JWT authentication...")
    try:
        from src.services.google_oauth2_jwt import get_access_token_from_service_account

        access_token = get_access_token_from_service_account(service_account_json)
        print(f"   ✓ Access token obtained (length: {len(access_token)} chars)")
        print(f"   ✓ Token preview: {access_token[:20]}...")
    except Exception as e:
        print(f"   ✗ Failed to get access token: {e}")
        return False

    # Step 3: Test API endpoint
    print("\n3. Testing Gemini 2.0 Flash API call...")
    try:
        import httpx
        from src.config import Config

        model = "gemini-2.0-flash"

        # Build request
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
                            "text": "What is 2 + 2? Reply with just the answer."
                        }
                    ],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 100,
                "temperature": 0.7,
            },
        }

        print(f"   Calling: {url}")
        print(f"   Model: {model}")
        print(f"   Prompt: 'What is 2 + 2? Reply with just the answer.'")

        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, headers=headers, json=request_body)

            if response.status_code != 200:
                print(f"   ✗ HTTP {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False

            response_data = response.json()

            # Extract the response text
            candidates = response_data.get("candidates", [])
            if not candidates:
                print("   ✗ No candidates in response")
                return False

            candidate = candidates[0]
            content_parts = candidate.get("content", {}).get("parts", [])
            if not content_parts:
                print("   ✗ No content parts in response")
                return False

            response_text = content_parts[0].get("text", "")

            print(f"   ✓ Got response from Gemini 2.0 Flash")
            print(f"\n   Response:")
            print(f"   ───────────────────────────────────────────────")
            print(f"   {response_text}")
            print(f"   ───────────────────────────────────────────────")

            # Check usage
            usage_metadata = candidate.get("usageMetadata", {})
            prompt_tokens = usage_metadata.get("promptTokenCount", 0)
            completion_tokens = usage_metadata.get("candidatesTokenCount", 0)

            print(f"\n   Tokens used:")
            print(f"   • Prompt: {prompt_tokens}")
            print(f"   • Completion: {completion_tokens}")
            print(f"   • Total: {prompt_tokens + completion_tokens}")

            return True

    except Exception as e:
        print(f"   ✗ API call failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run the test"""
    try:
        success = test_gemini_2_flash()

        print("\n" + "="*80)
        if success:
            print("✓ TEST PASSED - Gemini 2.0 Flash is working correctly!")
            print("="*80)
            return 0
        else:
            print("✗ TEST FAILED - See errors above")
            print("="*80)
            return 1
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
