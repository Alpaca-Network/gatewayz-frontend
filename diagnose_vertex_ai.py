#!/usr/bin/env python3
"""
Diagnose Google Vertex AI Configuration
"""
import os
import json
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request

load_dotenv()

print("=" * 80)
print("GOOGLE VERTEX AI CONFIGURATION DIAGNOSIS")
print("=" * 80)

# Check environment variables
print("\n1. Environment Variables:")
vertex_creds_json = os.getenv("GOOGLE_VERTEX_CREDENTIALS_JSON")
app_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GOOGLE_PROJECT_ID")

if vertex_creds_json:
    print("   ✓ GOOGLE_VERTEX_CREDENTIALS_JSON is set")
    try:
        creds_dict = json.loads(vertex_creds_json)
        print(f"   ✓ Credentials JSON is valid")
        print(f"   ✓ Project ID: {creds_dict.get('project_id')}")
        print(f"   ✓ Service Account: {creds_dict.get('client_email')}")
    except Exception as e:
        print(f"   ✗ Failed to parse credentials JSON: {e}")
else:
    print("   ✗ GOOGLE_VERTEX_CREDENTIALS_JSON is NOT set")

if app_creds_path:
    print(f"   ℹ GOOGLE_APPLICATION_CREDENTIALS: {app_creds_path}")
    if os.path.exists(app_creds_path):
        print(f"   ✓ File exists")
    else:
        print(f"   ✗ File does NOT exist (placeholder)")
else:
    print("   ℹ GOOGLE_APPLICATION_CREDENTIALS is NOT set")

if project_id:
    print(f"   ✓ Project ID: {project_id}")
else:
    print("   ⚠ Project ID not set in environment")

# Test authentication
print("\n2. Testing Authentication:")
if vertex_creds_json:
    try:
        creds_dict = json.loads(vertex_creds_json)
        scopes = [
            "https://www.googleapis.com/auth/cloud-platform",
            "https://www.googleapis.com/auth/aiplatform",
        ]

        print(f"   Creating credentials with scopes:")
        for scope in scopes:
            print(f"     - {scope}")

        credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        print("   ✓ Credentials object created")

        print("   Attempting to refresh credentials (get access token)...")
        try:
            credentials.refresh(Request())
            print("   ✓ Successfully obtained access token!")
            print(f"   ✓ Token valid: {credentials.valid}")
            print(f"   ✓ Token expires at: {credentials.expiry}")

            # Check if we have both tokens
            if hasattr(credentials, 'token') and credentials.token:
                print(f"   ✓ Access token: {credentials.token[:20]}...")
            else:
                print(f"   ✗ No access token in credentials object")

        except Exception as refresh_error:
            print(f"   ✗ Failed to refresh credentials: {refresh_error}")
            print("\n   This usually means:")
            print("   1. The service account doesn't have Vertex AI permissions")
            print("   2. Vertex AI API is not enabled in your GCP project")
            print("   3. The service account email doesn't exist or was deleted")

            print("\n   To fix:")
            print(f"   1. Go to: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project={creds_dict.get('project_id')}")
            print("      Click 'Enable' if not enabled")
            print(f"   2. Go to: https://console.cloud.google.com/iam-admin/iam?project={creds_dict.get('project_id')}")
            print(f"      Find: {creds_dict.get('client_email')}")
            print("      Add role: 'Vertex AI User'")

    except Exception as e:
        print(f"   ✗ Error during authentication test: {e}")
else:
    print("   ⚠ Skipping (no credentials found)")

# Test API access
print("\n3. Testing Vertex AI API Access:")
try:
    if vertex_creds_json:
        creds_dict = json.loads(vertex_creds_json)
        project_id = creds_dict.get('project_id')

        import httpx

        # Try to get access token first
        scopes = ["https://www.googleapis.com/auth/cloud-platform"]
        credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        credentials.refresh(Request())

        # Test Vertex AI endpoint
        location = os.getenv("GOOGLE_VERTEX_LOCATION", "us-central1")
        url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models"

        headers = {
            "Authorization": f"Bearer {credentials.token}",
            "Content-Type": "application/json",
        }

        print(f"   Testing API endpoint: {url}")
        response = httpx.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            print("   ✓ Vertex AI API is accessible!")
            models = response.json()
            print(f"   ✓ Found {len(models.get('models', []))} models")
        else:
            print(f"   ✗ API request failed: HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")

except Exception as api_error:
    print(f"   ✗ API test failed: {api_error}")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

if vertex_creds_json:
    try:
        creds_dict = json.loads(vertex_creds_json)
        scopes = ["https://www.googleapis.com/auth/cloud-platform"]
        credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        credentials.refresh(Request())
        print("\n✓ Your Vertex AI setup is WORKING!")
        print("  Google models should work now.")
    except:
        print("\n✗ Your Vertex AI setup has ISSUES")
        print("  Follow the steps above to fix.")
        print("\n  Quick links:")
        try:
            creds_dict = json.loads(vertex_creds_json)
            project_id = creds_dict.get('project_id')
            print(f"  - Enable API: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project={project_id}")
            print(f"  - IAM Console: https://console.cloud.google.com/iam-admin/iam?project={project_id}")
        except:
            pass
else:
    print("\n✗ No Vertex AI credentials found")
    print("  Set GOOGLE_VERTEX_CREDENTIALS_JSON in .env")

print("\n")
