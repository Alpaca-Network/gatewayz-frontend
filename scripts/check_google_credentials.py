#!/usr/bin/env python3
"""Check Google Vertex AI credentials

This script validates Google Cloud credentials using the same logic
as the application, helping diagnose credential issues.
"""

import json
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from src.services.google_vertex_client import (
        get_google_vertex_credentials,
        get_google_vertex_access_token,
    )
    from src.config import Config
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Make sure you're running from the project root directory")
    sys.exit(1)


def check_environment_variables():
    """Check which credential environment variables are set"""
    print("=" * 70)
    print("Checking Environment Variables")
    print("=" * 70)
    
    cred_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    cred_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    
    if cred_json:
        print("✓ GOOGLE_VERTEX_CREDENTIALS_JSON is set")
        # Try to detect if it's base64 or raw JSON
        try:
            json.loads(cred_json)
            print("  → Appears to be raw JSON")
        except json.JSONDecodeError:
            try:
                import base64
                decoded = base64.b64decode(cred_json).decode("utf-8")
                json.loads(decoded)
                print("  → Appears to be base64-encoded JSON")
            except Exception:
                print("  ⚠ Could not parse as JSON or base64")
    else:
        print("✗ GOOGLE_VERTEX_CREDENTIALS_JSON is not set")
    
    if cred_file:
        print(f"✓ GOOGLE_APPLICATION_CREDENTIALS is set: {cred_file}")
        if os.path.exists(cred_file):
            print(f"  → File exists: {os.path.getsize(cred_file)} bytes")
        else:
            print(f"  ⚠ File does not exist!")
    else:
        print("✗ GOOGLE_APPLICATION_CREDENTIALS is not set")
    
    print()
    
    # Check other Google config
    print("Other Google Configuration:")
    print(f"  GOOGLE_PROJECT_ID: {Config.GOOGLE_PROJECT_ID}")
    print(f"  GOOGLE_VERTEX_LOCATION: {Config.GOOGLE_VERTEX_LOCATION}")
    print()


def check_credentials():
    """Check if credentials can be loaded"""
    print("=" * 70)
    print("Loading Credentials")
    print("=" * 70)
    
    try:
        credentials = get_google_vertex_credentials()
        print("✓ Successfully loaded credentials")
        
        # Get service account email if available
        if hasattr(credentials, 'service_account_email'):
            print(f"  Service Account: {credentials.service_account_email}")
        elif hasattr(credentials, '_service_account_email'):
            print(f"  Service Account: {credentials._service_account_email}")
        
        # Check if valid
        if credentials.valid:
            print("  ✓ Credentials are valid")
        else:
            print("  ⚠ Credentials are not valid (may need refresh)")
        
        return credentials
    except Exception as e:
        print(f"✗ Failed to load credentials: {e}")
        import traceback
        traceback.print_exc()
        return None


def check_access_token(credentials):
    """Check if we can get an access token"""
    print("=" * 70)
    print("Getting Access Token")
    print("=" * 70)
    
    if not credentials:
        print("✗ Cannot check access token - credentials not loaded")
        return None
    
    try:
        token = get_google_vertex_access_token()
        if token:
            print(f"✓ Successfully obtained access token")
            print(f"  Token length: {len(token)} characters")
            print(f"  Token preview: {token[:20]}...")
            return token
        else:
            print("✗ Access token is None")
            return None
    except Exception as e:
        print(f"✗ Failed to get access token: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_vertex_api(token):
    """Test making a simple API call to Vertex AI"""
    print("=" * 70)
    print("Testing Vertex AI API")
    print("=" * 70)
    
    if not token:
        print("✗ Cannot test API - no access token")
        return False
    
    try:
        import httpx
        
        project_id = Config.GOOGLE_PROJECT_ID
        location = Config.GOOGLE_VERTEX_LOCATION
        model = "gemini-2.0-flash"  # Use a stable model
        
        url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/{model}:generateContent"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "Say hello"}]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 10
            }
        }
        
        print(f"  Project: {project_id}")
        print(f"  Location: {location}")
        print(f"  Model: {model}")
        print(f"  URL: {url}")
        print()
        
        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        
        if response.status_code == 200:
            data = response.json()
            if "candidates" in data and len(data["candidates"]) > 0:
                text = data["candidates"][0].get("content", {}).get("parts", [{}])[0].get("text", "")
                print(f"✓ API call successful!")
                print(f"  Response: {text[:100]}...")
                return True
            else:
                print(f"⚠ API call returned 200 but no candidates in response")
                print(f"  Response: {response.text[:200]}")
                return False
        else:
            print(f"✗ API call failed with status {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"✗ API test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all credential checks"""
    print("\n" + "=" * 70)
    print("Google Vertex AI Credentials Checker")
    print("=" * 70 + "\n")
    
    # Check environment
    check_environment_variables()
    
    # Load credentials
    credentials = check_credentials()
    
    if not credentials:
        print("\n" + "=" * 70)
        print("SUMMARY: Credentials could not be loaded")
        print("=" * 70)
        print("\nPlease configure one of:")
        print("  1. GOOGLE_VERTEX_CREDENTIALS_JSON (raw JSON or base64)")
        print("  2. GOOGLE_APPLICATION_CREDENTIALS (file path)")
        print("  3. Application Default Credentials (gcloud auth application-default login)")
        sys.exit(1)
    
    # Get access token
    token = check_access_token(credentials)
    
    # Test API
    api_works = test_vertex_api(token)
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    if credentials:
        print("✓ Credentials loaded")
    else:
        print("✗ Credentials failed to load")
    
    if token:
        print("✓ Access token obtained")
    else:
        print("✗ Access token failed")
    
    if api_works:
        print("✓ Vertex AI API test successful")
        print("\n🎉 All checks passed! Your credentials are working correctly.")
        sys.exit(0)
    else:
        print("✗ Vertex AI API test failed")
        print("\n⚠ Credentials are loaded but API calls are failing.")
        print("Check:")
        print("  - Project ID is correct")
        print("  - Vertex AI API is enabled in your project")
        print("  - Service account has 'roles/aiplatform.user' permission")
        print("  - Model is available in your region")
        sys.exit(1)


if __name__ == "__main__":
    main()

