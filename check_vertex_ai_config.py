#!/usr/bin/env python3
"""
Check Google Vertex AI configuration and credentials

This script helps diagnose configuration issues before running the test.
"""

import json
import os
import sys


def check_config():
    """Check Vertex AI configuration"""

    print("\n" + "="*80)
    print("GOOGLE VERTEX AI CONFIGURATION CHECK")
    print("="*80)

    issues = []
    warnings = []

    # Check GOOGLE_VERTEX_CREDENTIALS_JSON
    print("\n1. Service Account Credentials")
    print("   ─────────────────────────────────────────────────────")

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

    if not service_account_json:
        print("   ✗ GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        issues.append("GOOGLE_VERTEX_CREDENTIALS_JSON not configured")
    else:
        print("   ✓ GOOGLE_VERTEX_CREDENTIALS_JSON is set")

        # Try to parse it
        try:
            creds = json.loads(service_account_json)

            # Check required fields
            required_fields = ["type", "project_id", "private_key", "client_email"]
            missing_fields = [f for f in required_fields if f not in creds]

            if missing_fields:
                print(f"   ✗ Missing required fields: {', '.join(missing_fields)}")
                issues.append(f"Missing fields in credentials: {', '.join(missing_fields)}")
            else:
                print(f"   ✓ All required fields present")
                print(f"     • Type: {creds.get('type')}")
                print(f"     • Project ID: {creds.get('project_id')}")
                print(f"     • Service Account: {creds.get('client_email')}")

                # Check private key format
                private_key = creds.get("private_key", "")
                if private_key.startswith("-----BEGIN"):
                    print(f"     • Private Key: Valid PEM format")
                else:
                    print(f"     • Private Key: Invalid format (not PEM)")
                    issues.append("Private key is not in PEM format")

        except json.JSONDecodeError as e:
            print(f"   ✗ Invalid JSON: {e}")
            issues.append(f"Invalid JSON in credentials: {e}")

    # Check GOOGLE_PROJECT_ID
    print("\n2. GCP Project Configuration")
    print("   ─────────────────────────────────────────────────────")

    project_id = os.environ.get("GOOGLE_PROJECT_ID")

    if not project_id:
        print("   ✗ GOOGLE_PROJECT_ID not set")
        issues.append("GOOGLE_PROJECT_ID not configured")
    else:
        print(f"   ✓ GOOGLE_PROJECT_ID: {project_id}")

    # Check GOOGLE_VERTEX_LOCATION
    print("\n3. GCP Region Configuration")
    print("   ─────────────────────────────────────────────────────")

    location = os.environ.get("GOOGLE_VERTEX_LOCATION")

    if not location:
        print("   ✗ GOOGLE_VERTEX_LOCATION not set")
        print("   Default: us-central1")
        warnings.append("GOOGLE_VERTEX_LOCATION not set, using default")
    else:
        print(f"   ✓ GOOGLE_VERTEX_LOCATION: {location}")

    # Check if JWT module is available
    print("\n4. Python Dependencies")
    print("   ─────────────────────────────────────────────────────")

    deps = [
        ("cryptography", "RSA signing"),
        ("httpx", "HTTP requests"),
    ]

    for module_name, purpose in deps:
        try:
            __import__(module_name)
            print(f"   ✓ {module_name}: Available ({purpose})")
        except ImportError:
            print(f"   ✗ {module_name}: Not installed")
            issues.append(f"Missing Python module: {module_name}")

    # Check if google_oauth2_jwt is importable
    try:
        from src.services.google_oauth2_jwt import get_access_token_from_service_account
        print(f"   ✓ google_oauth2_jwt: Available (JWT exchange)")
    except ImportError as e:
        print(f"   ✗ google_oauth2_jwt: Not available - {e}")
        issues.append("google_oauth2_jwt module not found")

    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)

    if not issues and not warnings:
        print("\n✓ Configuration looks good! You can run the test.")
        print("\nTo test Gemini 2.0 Flash:")
        print("   python3 test_gemini_2_flash.py")
        return 0

    if issues:
        print(f"\n✗ Found {len(issues)} configuration issue(s):\n")
        for i, issue in enumerate(issues, 1):
            print(f"   {i}. {issue}")

    if warnings:
        print(f"\n⚠ Found {len(warnings)} warning(s):\n")
        for i, warning in enumerate(warnings, 1):
            print(f"   {i}. {warning}")

    print("\nTo fix configuration issues:")
    print("   1. Set GOOGLE_VERTEX_CREDENTIALS_JSON with your service account JSON")
    print("   2. Set GOOGLE_PROJECT_ID with your GCP project ID")
    print("   3. Ensure your service account has Vertex AI User role")
    print("   4. Ensure Vertex AI API is enabled in your GCP project")

    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(check_config())
