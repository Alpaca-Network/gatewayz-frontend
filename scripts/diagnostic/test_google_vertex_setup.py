#!/usr/bin/env python3
"""
Test script to verify Google Vertex AI setup is working correctly.
Run this after configuring your .env file with GCP credentials.
"""
import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def print_section(title):
    """Print a section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def check_env_vars():
    """Check if environment variables are set"""
    print_section("Step 1: Checking Environment Variables")

    from dotenv import load_dotenv
    load_dotenv()

    checks = {
        "GOOGLE_PROJECT_ID": os.getenv("GOOGLE_PROJECT_ID"),
        "GOOGLE_VERTEX_LOCATION": os.getenv("GOOGLE_VERTEX_LOCATION"),
        "GOOGLE_APPLICATION_CREDENTIALS": os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
        "GOOGLE_VERTEX_CREDENTIALS_JSON": os.getenv("GOOGLE_VERTEX_CREDENTIALS_JSON"),
    }

    all_good = True
    for key, value in checks.items():
        if value:
            if key == "GOOGLE_APPLICATION_CREDENTIALS":
                # Check if file exists
                if Path(value).exists():
                    print(f"✅ {key}: {value} (file exists)")
                else:
                    print(f"❌ {key}: {value} (FILE NOT FOUND!)")
                    all_good = False
            elif key == "GOOGLE_VERTEX_CREDENTIALS_JSON":
                print(f"✅ {key}: Set (base64 encoded, length: {len(value)})")
            else:
                print(f"✅ {key}: {value}")
        else:
            if key in ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_VERTEX_CREDENTIALS_JSON"]:
                # At least one should be set
                continue
            print(f"❌ {key}: NOT SET")
            all_good = False

    # Check that at least one credential method is set
    has_creds = checks["GOOGLE_APPLICATION_CREDENTIALS"] or checks["GOOGLE_VERTEX_CREDENTIALS_JSON"]
    if not has_creds:
        print("\n❌ ERROR: No credentials configured!")
        print("   Set either GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_VERTEX_CREDENTIALS_JSON")
        all_good = False

    return all_good

def test_credentials():
    """Test if credentials can be loaded and are valid"""
    print_section("Step 2: Testing Credential Loading")

    try:
        from src.services.google_vertex_client import get_google_vertex_credentials

        print("Attempting to load credentials...")
        credentials = get_google_vertex_credentials()

        if credentials:
            print(f"✅ Credentials loaded successfully!")
            print(f"   Type: {type(credentials).__name__}")
            print(f"   Valid: {credentials.valid}")

            if not credentials.valid:
                print("   Refreshing credentials...")
                from google.auth.transport.requests import Request
                credentials.refresh(Request())
                print(f"✅ Credentials refreshed! Valid: {credentials.valid}")

            return True
        else:
            print("❌ Failed to load credentials (returned None)")
            return False

    except Exception as e:
        print(f"❌ Error loading credentials: {e}")
        print(f"   Type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

def test_api_call():
    """Test a simple API call to Vertex AI"""
    print_section("Step 3: Testing Vertex AI API Call")

    try:
        from src.services.google_vertex_client import make_google_vertex_request_openai

        print("Making test request to gemini-2.0-flash...")
        print("Prompt: 'Say hello in exactly 3 words'")

        messages = [
            {"role": "user", "content": "Say hello in exactly 3 words"}
        ]

        response = make_google_vertex_request_openai(
            messages=messages,
            model="gemini-2.0-flash",
            max_tokens=10,
            temperature=0.7
        )

        print("\n✅ API call successful!")
        print(f"   Model: {response.get('model')}")
        print(f"   Response: {response['choices'][0]['message']['content']}")
        print(f"   Tokens used: {response['usage']['total_tokens']}")
        print(f"   Finish reason: {response['choices'][0]['finish_reason']}")

        return True

    except Exception as e:
        print(f"\n❌ API call failed: {e}")
        print(f"   Type: {type(e).__name__}")

        # Check for common errors
        error_str = str(e).lower()
        if "403" in error_str or "forbidden" in error_str:
            print("\n💡 HINT: Permission denied. Check that:")
            print("   1. Vertex AI API is enabled in GCP")
            print("   2. Service account has 'Vertex AI User' role")
            print("   3. Billing is enabled on the project")
        elif "404" in error_str or "not found" in error_str:
            print("\n💡 HINT: Resource not found. Check that:")
            print("   1. Project ID is correct")
            print("   2. Region/location is correct")
            print("   3. Model 'gemini-2.0-flash' is available in your region")
        elif "401" in error_str or "unauthorized" in error_str:
            print("\n💡 HINT: Authentication failed. Check that:")
            print("   1. JSON key file is valid and not expired")
            print("   2. Service account still exists in GCP")
            print("   3. Credentials are not corrupted")

        import traceback
        traceback.print_exc()
        return False

def list_available_models():
    """List models available through Vertex AI"""
    print_section("Step 4: Listing Available Models")

    try:
        from src.services.portkey_providers import fetch_models_from_google_vertex

        print("Fetching models from Google Vertex AI...")
        models = fetch_models_from_google_vertex()

        if models:
            print(f"\n✅ Found {len(models)} models:")
            for i, model in enumerate(models, 1):
                print(f"   {i:2d}. {model['id']:40s} - {model.get('display_name', 'N/A')}")
            return True
        else:
            print("❌ No models returned")
            return False

    except Exception as e:
        print(f"❌ Failed to list models: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("  Google Vertex AI Setup Test")
    print("=" * 80)
    print("\nThis script will verify your Google Vertex AI configuration.")
    print("Make sure you've set up your .env file with GCP credentials first!\n")

    results = {}

    # Test 1: Environment variables
    results['env'] = check_env_vars()
    if not results['env']:
        print("\n⚠️  Fix environment variables before continuing.")
        print("   Edit your .env file and add the missing values.")
        return False

    # Test 2: Credentials
    results['creds'] = test_credentials()
    if not results['creds']:
        print("\n⚠️  Fix credentials before continuing.")
        return False

    # Test 3: API call
    results['api'] = test_api_call()

    # Test 4: List models
    results['models'] = list_available_models()

    # Summary
    print_section("Summary")
    all_passed = all(results.values())

    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}  {test_name.upper()}")

    if all_passed:
        print("\n🎉 All tests passed! Google Vertex AI is configured correctly.")
        print("   You can now use Gemini models in your backend.")
    else:
        print("\n❌ Some tests failed. Please fix the issues above.")
        print("   Check the hints and error messages for guidance.")

    return all_passed

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
