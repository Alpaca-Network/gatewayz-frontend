#!/usr/bin/env python3
"""
Demo: Mock Gemini 2.0 Flash Response

This script shows what a real Gemini 2.0 Flash API response looks like
without needing actual credentials. Useful for understanding the response format.
"""

import json
import sys
from datetime import datetime

def show_demo():
    """Show a mock response from Gemini 2.0 Flash"""

    print("\n" + "="*100)
    print("DEMO: GEMINI 2.0 FLASH RESPONSE FORMAT")
    print("="*100)

    print("\n📋 SCENARIO")
    print("─" * 100)
    print("Prompt: 'Explain what a JWT is in 2 sentences'")
    print("Model: gemini-2.0-flash")
    print("Status: ✓ SUCCESS")

    # Mock response data (similar to real Gemini 2.0 Flash response)
    mock_response = {
        "candidates": [
            {
                "content": {
                    "role": "model",
                    "parts": [
                        {
                            "text": "A JWT (JSON Web Token) is a compact, digitally signed token used for securely transmitting information between parties, consisting of three base64-encoded parts: header, payload, and signature. It's commonly used for authentication and authorization in modern web applications because the recipient can verify the token's authenticity without needing to contact the issuing server."
                        }
                    ]
                },
                "finishReason": "STOP",
                "usageMetadata": {
                    "promptTokenCount": 8,
                    "candidatesTokenCount": 57,
                    "totalTokenCount": 65
                }
            }
        ]
    }

    # Display formatted response
    print("\n✅ RESPONSE FROM GEMINI 2.0 FLASH")
    print("=" * 100)

    response_text = mock_response["candidates"][0]["content"]["parts"][0]["text"]
    print(response_text)

    print("\n" + "=" * 100)

    # Display token usage
    print("\n📊 TOKEN USAGE")
    print("─" * 100)

    usage = mock_response["candidates"][0]["usageMetadata"]
    print(f"Prompt tokens:      {usage['promptTokenCount']}")
    print(f"Completion tokens:  {usage['candidatesTokenCount']}")
    print(f"Total tokens:       {usage['totalTokenCount']}")

    finish_reason = mock_response["candidates"][0]["finishReason"]
    print(f"Finish reason:      {finish_reason} (complete response, not truncated)")

    # Display full raw response
    print("\n🔍 COMPLETE RAW RESPONSE (JSON FORMAT)")
    print("─" * 100)
    print(json.dumps(mock_response, indent=2))

    # Show what the authentication looked like
    print("\n🔐 AUTHENTICATION FLOW USED")
    print("─" * 100)
    print("""
1. Service Account Credentials
   - Loaded from GOOGLE_VERTEX_CREDENTIALS_JSON
   - Contains: type, project_id, private_key, client_email

2. JWT Building
   - Algorithm: RS256 (RSA SHA-256)
   - Claims: iss, scope, aud, exp, iat, sub
   - Result: Signed JWT assertion

3. Token Exchange
   - Endpoint: https://oauth2.googleapis.com/token
   - Grant type: urn:ietf:params:oauth:grant-type:jwt-bearer
   - Result: Access token (ya29.c.b0AW...)

4. API Call
   - Endpoint: https://{location}-aiplatform.googleapis.com/v1/...
   - Authorization: Bearer {access_token}
   - Method: POST with JSON body
   - Result: Gemini 2.0 Flash response
    """)

    # Show performance metrics
    print("\n⚡ PERFORMANCE CHARACTERISTICS")
    print("─" * 100)
    print("""
JWT Authentication:
  - Token generation time: ~10-50ms
  - Token exchange time: ~50-200ms
  - Total authentication: ~100-250ms

API Call:
  - Gemini 2.0 Flash latency: ~100-500ms (for typical prompts)
  - Total round-trip: ~200-750ms

Caching:
  - With cached token: ~100-500ms (just API call)
  - With LRU cache: <1ms (from cache)
    """)

    # Show real example output
    print("\n📝 ANOTHER EXAMPLE RESPONSE")
    print("─" * 100)

    mock_response_2 = {
        "candidates": [
            {
                "content": {
                    "role": "model",
                    "parts": [
                        {
                            "text": "Here's a simple JWT example:\n\nHeader (base64url decoded):\n{\n  \"alg\": \"HS256\",\n  \"typ\": \"JWT\"\n}\n\nPayload (base64url decoded):\n{\n  \"sub\": \"1234567890\",\n  \"name\": \"John Doe\",\n  \"iat\": 1516239022\n}\n\nSignature: HMACSHA256(base64url(header) + '.' + base64url(payload), secret)\n\nFinal JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
                        }
                    ]
                },
                "finishReason": "STOP",
                "usageMetadata": {
                    "promptTokenCount": 12,
                    "candidatesTokenCount": 156,
                    "totalTokenCount": 168
                }
            }
        ]
    }

    response_text_2 = mock_response_2["candidates"][0]["content"]["parts"][0]["text"]
    print(response_text_2)

    usage_2 = mock_response_2["candidates"][0]["usageMetadata"]
    print(f"\nToken usage: {usage_2['promptTokenCount']} prompt + {usage_2['candidatesTokenCount']} completion = {usage_2['totalTokenCount']} total")

    # Call to action
    print("\n" + "=" * 100)
    print("TO RUN WITH REAL CREDENTIALS:")
    print("=" * 100)
    print("""
1. Set environment variables:

   export GOOGLE_VERTEX_CREDENTIALS_JSON='<your-service-account-json>'
   export GOOGLE_PROJECT_ID='<your-gcp-project>'
   export GOOGLE_VERTEX_LOCATION='us-central1'

2. Run the real test:

   python3 run_gemini_test.py

This will make an actual API call to Google Vertex AI and show you the real response!
    """)

    return 0


if __name__ == "__main__":
    sys.exit(show_demo())
