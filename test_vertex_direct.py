#!/usr/bin/env python3
"""
Direct Vertex AI Test - Bypassing Gatewayz
Tests Google Vertex AI directly using the official SDK
"""
import os
import sys
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("=" * 80)
print("DIRECT VERTEX AI TEST (Outside Gatewayz)")
print("=" * 80)

# Configuration from environment
project_id = os.getenv("GOOGLE_PROJECT_ID")
location = os.getenv("GOOGLE_VERTEX_LOCATION", "us-central1")
vertex_creds_json = os.getenv("GOOGLE_VERTEX_CREDENTIALS_JSON")

print(f"\nConfiguration:")
print(f"  Project ID: {project_id}")
print(f"  Location: {location}")
print(f"  Credentials: {'✓ Set' if vertex_creds_json else '✗ Not set'}")
print()

if not project_id or not vertex_creds_json:
    print("ERROR: Missing required environment variables")
    print("  Required: GOOGLE_PROJECT_ID, GOOGLE_VERTEX_CREDENTIALS_JSON")
    sys.exit(1)

# Parse credentials
try:
    creds_dict = json.loads(vertex_creds_json)
    print(f"Credentials parsed successfully")
    print(f"  Service Account: {creds_dict.get('client_email')}")
    print(f"  Project from creds: {creds_dict.get('project_id')}")
except Exception as e:
    print(f"ERROR: Failed to parse credentials: {e}")
    sys.exit(1)

print("\n" + "=" * 80)
print("TEST 1: Using REST API directly with httpx")
print("=" * 80)

try:
    import httpx
    from google.oauth2.service_account import Credentials
    from google.auth.transport.requests import Request

    # Create credentials
    print("\n1. Creating service account credentials...")
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    print("   ✓ Credentials created")

    # Get access token
    print("\n2. Refreshing credentials to get access token...")
    credentials.refresh(Request())
    print(f"   ✓ Access token obtained (length: {len(credentials.token)} chars)")
    print(f"   ✓ Token valid: {credentials.valid}")
    print(f"   ✓ Token expires: {credentials.expiry}")

    # Test with gemini-2.0-flash-exp model
    model_name = "gemini-2.0-flash-exp"
    print(f"\n3. Testing model: {model_name}")

    # Construct API endpoint
    api_endpoint = f"{location}-aiplatform.googleapis.com"
    url = (
        f"https://{api_endpoint}/v1/"
        f"projects/{project_id}/"
        f"locations/{location}/"
        f"publishers/google/models/{model_name}:generateContent"
    )

    print(f"   URL: {url}")

    # Prepare request
    headers = {
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json",
    }

    request_body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": "Hello! Please respond with 'Vertex AI is working correctly.'"}]
            }
        ],
        "generationConfig": {
            "maxOutputTokens": 100,
            "temperature": 0.1
        }
    }

    print("\n4. Making API request...")
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, headers=headers, json=request_body)
        print(f"   Response status: {response.status_code}")

        if response.status_code == 200:
            print("   ✓ Request successful!")
            response_data = response.json()

            # Extract and display response
            candidates = response_data.get("candidates", [])
            if candidates:
                content = candidates[0].get("content", {}).get("parts", [])
                if content:
                    text = content[0].get("text", "")
                    print(f"\n   Model Response:")
                    print(f"   {text}")

                    # Show usage stats
                    usage = response_data.get("usageMetadata", {})
                    print(f"\n   Token Usage:")
                    print(f"     Prompt tokens: {usage.get('promptTokenCount', 0)}")
                    print(f"     Response tokens: {usage.get('candidatesTokenCount', 0)}")
                    print(f"     Total tokens: {usage.get('totalTokenCount', 0)}")
                else:
                    print("   ✗ No content in response")
            else:
                print("   ✗ No candidates in response")

            print(f"\n   Full response:")
            print(f"   {json.dumps(response_data, indent=2)}")
        else:
            print(f"   ✗ Request failed!")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")

except ImportError as e:
    print(f"\n✗ Missing required package: {e}")
    print("   Install with: pip install httpx google-auth google-auth-httplib2")
except Exception as e:
    print(f"\n✗ Test failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("TEST 2: Using Vertex AI SDK (google-cloud-aiplatform)")
print("=" * 80)

try:
    print("\n1. Importing Vertex AI SDK...")
    import vertexai
    from vertexai.generative_models import GenerativeModel

    print("   ✓ SDK imported successfully")

    print("\n2. Initializing Vertex AI...")
    # Initialize with credentials from service account info
    from google.oauth2 import service_account
    credentials = service_account.Credentials.from_service_account_info(
        creds_dict,
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )

    vertexai.init(
        project=project_id,
        location=location,
        credentials=credentials
    )
    print(f"   ✓ Initialized with project: {project_id}, location: {location}")

    print("\n3. Creating GenerativeModel instance...")
    model = GenerativeModel("gemini-2.0-flash-exp")
    print("   ✓ Model created: gemini-2.0-flash-exp")

    print("\n4. Generating content...")
    response = model.generate_content(
        "Hello! Please respond with 'Vertex AI SDK is working correctly.'"
    )

    print("   ✓ Content generated successfully!")
    print(f"\n   Model Response:")
    print(f"   {response.text}")

    # Show usage metadata if available
    if hasattr(response, 'usage_metadata'):
        print(f"\n   Token Usage:")
        print(f"     Prompt tokens: {response.usage_metadata.prompt_token_count}")
        print(f"     Response tokens: {response.usage_metadata.candidates_token_count}")
        print(f"     Total tokens: {response.usage_metadata.total_token_count}")

except ImportError as e:
    print(f"\n⚠ SDK not available: {e}")
    print("   Install with: pip install google-cloud-aiplatform")
    print("   Skipping SDK test...")
except Exception as e:
    print(f"\n✗ SDK test failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("TEST 3: List Available Models")
print("=" * 80)

try:
    import httpx
    from google.oauth2.service_account import Credentials
    from google.auth.transport.requests import Request

    print("\n1. Getting access token...")
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    credentials.refresh(Request())
    print("   ✓ Token obtained")

    print("\n2. Listing available Gemini models...")
    api_endpoint = f"{location}-aiplatform.googleapis.com"
    url = f"https://{api_endpoint}/v1/projects/{project_id}/locations/{location}/publishers/google/models"

    headers = {
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.get(url, headers=headers)

        if response.status_code == 200:
            print("   ✓ Models list retrieved")
            models_data = response.json()
            models = models_data.get("models", [])

            # Filter for Gemini models
            gemini_models = [m for m in models if "gemini" in m.get("name", "").lower()]

            print(f"\n   Found {len(gemini_models)} Gemini models:")
            for model in gemini_models[:10]:  # Show first 10
                model_name = model.get("name", "").split("/")[-1]
                display_name = model.get("displayName", "N/A")
                print(f"     - {model_name}")
                if display_name != model_name:
                    print(f"       Display: {display_name}")
        else:
            print(f"   ✗ Failed to list models: {response.status_code}")
            print(f"   Response: {response.text[:500]}")

except Exception as e:
    print(f"\n✗ Failed to list models: {e}")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

print("\nThis test directly accessed Google Vertex AI without using any gatewayz code.")
print("If these tests passed, Vertex AI is working correctly and the issue is likely")
print("in the gatewayz integration. If they failed, the issue is with Vertex AI setup.")
print()
