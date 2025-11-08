"""
Example: Using Google OAuth2 JWT Exchange for Service Account Authentication

This example demonstrates how to use the google_oauth2_jwt module to obtain
access tokens for Google Cloud APIs without using the heavy Google SDKs.

Useful for:
- Serverless environments (Vercel, Railway)
- Lightweight microservices
- Custom authentication flows
- Automated access token management
"""

import json
import os
from typing import Optional

# Note: In production, adjust imports based on your project structure
from src.services.google_oauth2_jwt import (
    build_jwt_assertion,
    exchange_jwt_for_access_token,
    get_access_token_from_service_account,
)


# ==================== Example 1: Basic Usage ====================


def example_basic_token_exchange():
    """
    Most common use case: Get an access token from service account JSON
    """
    print("\n=== Example 1: Basic Token Exchange ===")

    # Load service account JSON from environment
    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

    if not service_account_json:
        print("Error: GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        return

    try:
        # One-liner to get an access token
        access_token = get_access_token_from_service_account(service_account_json)

        print(f"✓ Access token obtained successfully")
        print(f"  Token length: {len(access_token)} characters")
        print(f"  Token preview: {access_token[:20]}...")

        # Use the token with Google APIs
        return access_token

    except ValueError as e:
        print(f"✗ Failed to get access token: {e}")


# ==================== Example 2: Custom Scope ====================


def example_custom_scope():
    """
    Use a specific OAuth2 scope instead of the default cloud-platform
    """
    print("\n=== Example 2: Custom Scope ===")

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

    if not service_account_json:
        print("Error: GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        return

    try:
        # Request a specific scope
        access_token = get_access_token_from_service_account(
            service_account_json,
            scope="https://www.googleapis.com/auth/aiplatform"  # AI Platform only
        )

        print(f"✓ Access token obtained with custom scope")
        print(f"  Scope: https://www.googleapis.com/auth/aiplatform")

        return access_token

    except ValueError as e:
        print(f"✗ Failed: {e}")


# ==================== Example 3: Manual JWT Building ====================


def example_manual_jwt_building():
    """
    Advanced: Build JWT assertion step-by-step for more control
    """
    print("\n=== Example 3: Manual JWT Building ===")

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

    if not service_account_json:
        print("Error: GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        return

    try:
        # Parse service account JSON
        service_account_data = json.loads(service_account_json)
        service_account_email = service_account_data["client_email"]
        private_key = service_account_data["private_key"]

        print(f"✓ Service account email: {service_account_email}")

        # Step 1: Build JWT assertion
        jwt_assertion = build_jwt_assertion(
            service_account_email=service_account_email,
            private_key=private_key,
            scope="https://www.googleapis.com/auth/cloud-platform",
            expiry_seconds=3600,  # 1 hour
        )

        print(f"✓ JWT assertion built")
        print(f"  JWT length: {len(jwt_assertion)} characters")
        print(f"  JWT parts: {len(jwt_assertion.split('.'))} (header.payload.signature)")

        # Step 2: Exchange JWT for access token
        token_response = exchange_jwt_for_access_token(jwt_assertion)

        print(f"✓ Access token obtained")
        print(f"  Token type: {token_response['token_type']}")
        print(f"  Expires in: {token_response['expires_in']} seconds")
        print(f"  Access token: {token_response['access_token'][:20]}...")

        return token_response["access_token"]

    except Exception as e:
        print(f"✗ Failed: {e}")


# ==================== Example 4: With Google Vertex AI ====================


def example_with_vertex_ai():
    """
    Use the access token to call Google Vertex AI REST API
    """
    print("\n=== Example 4: Using Token with Vertex AI ===")

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    project_id = os.environ.get("GOOGLE_PROJECT_ID", "gatewayz-468519")
    location = os.environ.get("GOOGLE_VERTEX_LOCATION", "us-central1")
    model = "gemini-2.0-flash"

    if not service_account_json:
        print("Error: GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        return

    try:
        import httpx

        # Get access token
        access_token = get_access_token_from_service_account(service_account_json)

        # Build Vertex AI API request
        url = (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project_id}/locations/{location}/"
            f"publishers/google/models/{model}:generateContent"
        )

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        # Example request body for Vertex AI API:
        # request_body = {
        #     "contents": [
        #         {
        #             "role": "user",
        #             "parts": [{"text": "Hello, how are you?"}],
        #         }
        #     ],
        # }

        print(f"✓ Access token ready")
        print(f"  URL: {url}")
        print(f"  Authorization: Bearer {access_token[:20]}...")

        # Make the actual API call (commented out to avoid real API call)
        # with httpx.Client(timeout=60.0) as client:
        #     response = client.post(url, headers=headers, json=request_body)
        #     response.raise_for_status()
        #     result = response.json()
        #     print(f"✓ API call successful")
        #     return result

        print(f"\n  (Actual API call commented out to avoid charges)")
        return {"status": "ready", "token_preview": access_token[:20]}

    except Exception as e:
        print(f"✗ Failed: {e}")


# ==================== Example 5: Token Caching ====================


def example_token_caching():
    """
    Cache access token to avoid repeated exchange calls
    """
    print("\n=== Example 5: Token Caching ===")

    import time
    from functools import lru_cache

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

    if not service_account_json:
        print("Error: GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        return

    try:
        # Define a cached function (cache expires with process lifetime)
        @lru_cache(maxsize=1)
        def get_cached_token():
            """Get and cache access token"""
            return get_access_token_from_service_account(service_account_json)

        # First call: exchanges JWT for token
        print("  First call (new token)...")
        start = time.time()
        token1 = get_cached_token()
        elapsed1 = time.time() - start
        print(f"  ✓ Got token in {elapsed1:.3f}s")

        # Second call: returns cached token
        print("  Second call (cached token)...")
        start = time.time()
        token2 = get_cached_token()
        elapsed2 = time.time() - start
        print(f"  ✓ Got cached token in {elapsed2:.3f}s (faster!)")

        # Verify tokens are the same
        assert token1 == token2, "Tokens should be identical"
        print(f"\n✓ Token caching works")
        print(f"  Speed improvement: {elapsed1 / elapsed2:.1f}x faster")

    except Exception as e:
        print(f"✗ Failed: {e}")


# ==================== Example 6: Error Handling ====================


def example_error_handling():
    """
    Demonstrate error handling for common issues
    """
    print("\n=== Example 6: Error Handling ===")

    # Test 1: Invalid JSON
    print("\n  Test 1: Invalid JSON")
    try:
        get_access_token_from_service_account("not valid json")
    except ValueError as e:
        print(f"  ✓ Caught error: {str(e)[:60]}...")

    # Test 2: Missing client_email
    print("\n  Test 2: Missing client_email")
    try:
        invalid_json = json.dumps({"private_key": "key"})
        get_access_token_from_service_account(invalid_json)
    except ValueError as e:
        print(f"  ✓ Caught error: {str(e)[:60]}...")

    # Test 3: Missing private_key
    print("\n  Test 3: Missing private_key")
    try:
        invalid_json = json.dumps({"client_email": "test@example.com"})
        get_access_token_from_service_account(invalid_json)
    except ValueError as e:
        print(f"  ✓ Caught error: {str(e)[:60]}...")

    print(f"\n✓ Error handling working correctly")


# ==================== Example 7: Custom Expiry ====================


def example_custom_expiry():
    """
    Build JWT with custom expiry time
    """
    print("\n=== Example 7: Custom JWT Expiry ===")

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

    if not service_account_json:
        print("Error: GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        return

    try:
        # Parse credentials
        service_account_data = json.loads(service_account_json)
        service_account_email = service_account_data["client_email"]
        private_key = service_account_data["private_key"]

        # Build JWT with different expiry times
        expiry_times = [1800, 3600, 7200]  # 30 min, 1 hour, 2 hours

        for expiry_seconds in expiry_times:
            jwt = build_jwt_assertion(
                service_account_email=service_account_email,
                private_key=private_key,
                expiry_seconds=expiry_seconds,
            )
            print(f"  ✓ JWT built with {expiry_seconds}s expiry")

        print(f"\n✓ Custom expiry times work")

    except Exception as e:
        print(f"✗ Failed: {e}")


# ==================== Example 8: Batch Token Requests ====================


def example_batch_requests():
    """
    Get tokens for multiple scopes or audiences
    """
    print("\n=== Example 8: Multiple Scopes ===")

    service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

    if not service_account_json:
        print("Error: GOOGLE_VERTEX_CREDENTIALS_JSON not set")
        return

    try:
        # Different scopes for different services
        scopes = {
            "AI Platform": "https://www.googleapis.com/auth/aiplatform",
            "Compute Engine": "https://www.googleapis.com/auth/compute",
            "Cloud Platform": "https://www.googleapis.com/auth/cloud-platform",
        }

        tokens = {}
        for service_name, scope in scopes.items():
            token = get_access_token_from_service_account(
                service_account_json,
                scope=scope,
            )
            tokens[service_name] = token
            print(f"  ✓ Got token for {service_name}")

        print(f"\n✓ Got {len(tokens)} tokens for different scopes")

        return tokens

    except Exception as e:
        print(f"✗ Failed: {e}")


# ==================== Main ====================


def main():
    """Run all examples"""
    print("=" * 60)
    print("Google OAuth2 JWT Exchange Examples")
    print("=" * 60)

    # Run examples
    example_basic_token_exchange()
    example_custom_scope()
    example_manual_jwt_building()
    example_with_vertex_ai()
    example_token_caching()
    example_error_handling()
    example_custom_expiry()
    example_batch_requests()

    print("\n" + "=" * 60)
    print("Examples complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
