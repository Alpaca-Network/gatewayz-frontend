#!/usr/bin/env python3
"""Test script for Google Vertex AI with Application Default Credentials"""

import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from src.services.google_vertex_client import (
    initialize_vertex_ai,
    make_google_vertex_request_openai,
    diagnose_google_vertex_credentials,
)


def test_vertex_ai_with_adc():
    """Test Vertex AI using Application Default Credentials (from a service account).

    Initializes Vertex AI using ADC. The library will find credentials from:
    1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON file)
    2. GOOGLE_VERTEX_CREDENTIALS_JSON environment variable (raw JSON)
    3. Application Default Credentials (gcloud, metadata server, etc.)
    """
    print("Testing Google Vertex AI Connection with Service Account...\n")

    # Step 1: Diagnose credentials
    print("=" * 60)
    print("Step 1: Diagnosing credentials")
    print("=" * 60)

    diagnosis = diagnose_google_vertex_credentials()
    print(f"Credential Source: {diagnosis['credential_source']}")
    print(f"Project ID: {diagnosis['project_id']}")
    print(f"Location: {diagnosis['location']}")
    print(f"Health Status: {diagnosis['health_status']}")
    print()

    for step in diagnosis['steps']:
        status = "✓" if step['passed'] else "✗"
        print(f"{status} {step['step']}: {step['details']}")

    if diagnosis.get('error'):
        print(f"\nError: {diagnosis['error']}")
        return False

    print()

    # Step 2: Make a test request
    print("=" * 60)
    print("Step 2: Making test API call")
    print("=" * 60)

    try:
        messages = [
            {"role": "user", "content": "Say hello and confirm you're working!"}
        ]

        print("Calling Vertex AI API...")
        response = make_google_vertex_request_openai(
            messages=messages,
            model="gemini-2.5-flash-lite",
            max_tokens=100,
            temperature=0.7
        )

        print("\n✓ API Test Successful!")
        print(f"\nResponse: {response['choices'][0]['message']['content']}")
        print(f"\nUsage: {response['usage']}")

        return True

    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_vertex_ai_with_adc()
    sys.exit(0 if success else 1)
