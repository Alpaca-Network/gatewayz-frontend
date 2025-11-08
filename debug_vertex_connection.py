#!/usr/bin/env python3
"""
Diagnostic script to debug Google Vertex AI connection issues

This script will:
1. Check for environment variables
2. Test credential loading
3. Test access token generation
4. Test a simple API call to Vertex AI
"""

import os
import sys
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    print("=" * 80)
    print("Google Vertex AI Connection Diagnostic Tool")
    print("=" * 80)
    print()

    # Step 1: Check environment variables
    print("STEP 1: Checking Environment Variables")
    print("-" * 80)

    env_vars = {
        "GOOGLE_PROJECT_ID": os.environ.get("GOOGLE_PROJECT_ID"),
        "GOOGLE_VERTEX_LOCATION": os.environ.get("GOOGLE_VERTEX_LOCATION"),
        "GOOGLE_APPLICATION_CREDENTIALS": os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
        "GOOGLE_VERTEX_CREDENTIALS_JSON": os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON"),
    }

    for var_name, var_value in env_vars.items():
        if var_value:
            if var_name == "GOOGLE_VERTEX_CREDENTIALS_JSON":
                print(f"✅ {var_name}: SET (length: {len(var_value)} chars)")
            elif var_name == "GOOGLE_APPLICATION_CREDENTIALS":
                # Check if file exists
                if os.path.exists(var_value):
                    print(f"✅ {var_name}: {var_value} (file exists)")
                else:
                    print(f"⚠️  {var_name}: {var_value} (file NOT found)")
            else:
                print(f"✅ {var_name}: {var_value}")
        else:
            print(f"❌ {var_name}: NOT SET")

    print()

    # Check if at least one credential source is available
    has_credentials = (
        env_vars["GOOGLE_APPLICATION_CREDENTIALS"] or
        env_vars["GOOGLE_VERTEX_CREDENTIALS_JSON"]
    )

    if not has_credentials:
        print("❌ ERROR: No Google credentials configured!")
        print()
        print("Please set one of the following:")
        print("  1. GOOGLE_VERTEX_CREDENTIALS_JSON (raw JSON or base64-encoded)")
        print("  2. GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)")
        print()
        return 1

    # Step 2: Test credential loading
    print("STEP 2: Testing Credential Loading")
    print("-" * 80)

    try:
        from src.services.google_vertex_client import diagnose_google_vertex_credentials

        diagnosis = diagnose_google_vertex_credentials()

        print(f"Health Status: {diagnosis['health_status'].upper()}")
        print(f"Credentials Available: {diagnosis['credentials_available']}")
        print(f"Credential Source: {diagnosis['credential_source']}")
        print(f"Project ID: {diagnosis['project_id']}")
        print(f"Location: {diagnosis['location']}")
        print(f"Token Available: {diagnosis['token_available']}")
        print(f"Token Valid: {diagnosis['token_valid']}")

        if diagnosis.get('error'):
            print(f"❌ Error: {diagnosis['error']}")

        print()
        print("Detailed Steps:")
        for step in diagnosis['steps']:
            status = "✅" if step['passed'] else "❌"
            print(f"  {status} {step['step']}: {step['details']}")

        print()

        if diagnosis['health_status'] != 'healthy':
            print("❌ Credential diagnosis failed!")
            return 1

        print("✅ Credentials loaded successfully!")
        print()

    except Exception as e:
        print(f"❌ Failed to load credentials: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Step 3: Test a simple API call
    print("STEP 3: Testing Vertex AI API Call")
    print("-" * 80)

    try:
        from src.services.google_vertex_client import make_google_vertex_request_openai

        # Simple test prompt
        messages = [
            {"role": "user", "content": "Say 'Hello from Vertex AI!' in exactly those words."}
        ]

        print("Sending test request to Vertex AI...")
        print(f"Model: gemini-2.0-flash")
        print(f"Messages: {messages}")
        print()

        response = make_google_vertex_request_openai(
            messages=messages,
            model="gemini-2.0-flash",
            max_tokens=50,
            temperature=0.0
        )

        print("✅ API call successful!")
        print()
        print("Response:")
        print(f"  Model: {response.get('model')}")
        print(f"  Content: {response['choices'][0]['message']['content']}")
        print(f"  Finish Reason: {response['choices'][0]['finish_reason']}")
        print(f"  Usage: {response.get('usage')}")
        print()

    except Exception as e:
        print(f"❌ API call failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Step 4: Test provider detection
    print("STEP 4: Testing Provider Detection")
    print("-" * 80)

    try:
        from src.services.model_transformations import detect_provider_from_model_id

        test_models = [
            "google/gemini-2.0-flash",
            "google/gemini-1.5-pro",
            "gemini-2.0-flash",
            "gemini-1.5-pro",
        ]

        for model_id in test_models:
            detected = detect_provider_from_model_id(model_id)
            status = "✅" if detected == "google-vertex" else "⚠️"
            print(f"  {status} {model_id} -> {detected}")

        print()

    except Exception as e:
        print(f"❌ Provider detection failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    print("=" * 80)
    print("✅ ALL DIAGNOSTICS PASSED!")
    print("=" * 80)
    return 0

if __name__ == "__main__":
    sys.exit(main())
