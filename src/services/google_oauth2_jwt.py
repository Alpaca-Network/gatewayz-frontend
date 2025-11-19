"""Google OAuth2 service account JWT exchange (no SDKs)

This module provides raw OAuth2 JWT exchange for Google service accounts
without using the Google SDKs. This approach is useful for:
1. Serverless environments (Vercel, Railway) with minimal dependencies
2. Custom authentication flows
3. Direct OAuth2 token exchange without SDK overhead

The implementation follows the Google OAuth2 JWT Bearer flow:
https://developers.google.com/identity/protocols/oauth2/service-account
"""

import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# Google OAuth2 token endpoint
GOOGLE_OAUTH2_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

# Grant type for JWT bearer assertion
JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer"


def build_jwt_assertion(
    service_account_email: str,
    private_key: str,
    scope: str = "https://www.googleapis.com/auth/cloud-platform",
    subject: Optional[str] = None,
    audience: str = "https://oauth2.googleapis.com/token",
    expiry_seconds: int = 3600,
) -> str:
    """Build a signed JWT assertion for Google OAuth2 service account flow

    Args:
        service_account_email: Service account email (iss claim)
        private_key: Private key from service account JSON (PEM format)
        scope: OAuth2 scope required (included in assertion)
        subject: Optional subject claim (sub) - typically same as iss for service accounts
        audience: Token endpoint audience (aud claim)
        expiry_seconds: JWT expiry time in seconds (default 1 hour)

    Returns:
        Signed JWT assertion (header.payload.signature in base64url format)

    Raises:
        ValueError: If JWT building or signing fails
    """
    try:
        logger.info(f"Building JWT assertion for service account: {service_account_email}")

        # Create JWT header
        header = {"typ": "JWT", "alg": "RS256"}
        header_encoded = _base64url_encode(json.dumps(header).encode("utf-8"))

        # Create JWT payload (claims)
        now = int(time.time())
        payload = {
            "iss": service_account_email,
            "scope": scope,
            "aud": audience,
            "exp": now + expiry_seconds,
            "iat": now,
        }

        # Add optional subject claim (typically same as iss for service accounts)
        if subject:
            payload["sub"] = subject
        else:
            # For service accounts, typically use the service account email as subject
            payload["sub"] = service_account_email

        payload_encoded = _base64url_encode(json.dumps(payload).encode("utf-8"))

        # Create signing input
        signing_input = f"{header_encoded}.{payload_encoded}".encode("utf-8")

        # Sign with private key using RS256 (RSA SHA-256)
        signature = _sign_with_rsa_sha256(signing_input, private_key)
        signature_encoded = _base64url_encode(signature)

        # Combine into JWT
        jwt_assertion = f"{signing_input.decode('utf-8')}.{signature_encoded}"

        logger.info(f"JWT assertion built successfully (length: {len(jwt_assertion)} chars)")
        logger.debug(
            f"JWT claims - iss: {service_account_email}, scope: {scope}, exp: {now + expiry_seconds}"
        )

        return jwt_assertion

    except Exception as e:
        error_msg = f"Failed to build JWT assertion: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise ValueError(error_msg) from e


def exchange_jwt_for_access_token(jwt_assertion: str) -> Dict[str, str]:
    """Exchange JWT assertion for Google OAuth2 access token

    Posts the JWT assertion to the Google OAuth2 token endpoint and returns
    the access token response.

    Args:
        jwt_assertion: Signed JWT assertion from build_jwt_assertion()

    Returns:
        Dictionary containing:
            - access_token: Bearer token for Google APIs
            - token_type: Always "Bearer"
            - expires_in: Token expiry in seconds

    Raises:
        ValueError: If token exchange fails
    """
    try:
        logger.info("Exchanging JWT assertion for access token")

        # Prepare request data
        request_data = {
            "grant_type": JWT_GRANT_TYPE,
            "assertion": jwt_assertion,
        }

        # Make HTTP POST request to Google OAuth2 endpoint
        with httpx.Client(timeout=30.0) as client:
            logger.debug(f"Posting to {GOOGLE_OAUTH2_TOKEN_ENDPOINT}")

            response = client.post(
                GOOGLE_OAUTH2_TOKEN_ENDPOINT,
                data=request_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            # Check response status
            if response.status_code != 200:
                error_text = response.text[:500]
                error_msg = (
                    f"Google OAuth2 token endpoint returned {response.status_code}. "
                    f"Error: {error_text}"
                )
                logger.error(error_msg)
                raise ValueError(error_msg)

            # Parse response
            response_data = response.json()

            # Get access_token, with fallback to id_token if access_token not present
            access_token = response_data.get("access_token")
            if not access_token:
                # Some OAuth2 flows return id_token instead of access_token
                # The id_token can be used as a bearer token for service-to-service auth
                access_token = response_data.get("id_token")
                if access_token:
                    logger.warning(
                        "OAuth2 endpoint returned id_token instead of access_token. "
                        "Using id_token as bearer token for Vertex AI API calls. "
                        "This is valid for service account authentication."
                    )
                else:
                    raise ValueError(
                        f"No access_token or id_token in OAuth2 response. "
                        f"Response keys: {list(response_data.keys())}"
                    )

            logger.info(
                f"Successfully obtained token (expires_in: {response_data.get('expires_in')} seconds)"
            )

            return {
                "access_token": access_token,
                "token_type": response_data.get("token_type", "Bearer"),
                "expires_in": response_data.get("expires_in", 3600),
            }

    except Exception as e:
        error_msg = f"Failed to exchange JWT for access token: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise ValueError(error_msg) from e


def get_access_token_from_service_account(
    service_account_json: str,
    scope: str = "https://www.googleapis.com/auth/cloud-platform",
) -> str:
    """Get Google access token from service account JSON

    High-level function that handles the complete JWT exchange flow:
    1. Parse service account JSON
    2. Build JWT assertion
    3. Exchange JWT for access token
    4. Return access token

    Args:
        service_account_json: Service account JSON (as string)
        scope: OAuth2 scope required

    Returns:
        Access token string for use with Google APIs

    Raises:
        ValueError: If any step of the process fails
    """
    try:
        logger.info("Starting OAuth2 JWT flow for service account access token")

        # Parse service account JSON
        try:
            service_account_data = json.loads(service_account_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid service account JSON: {str(e)}") from e

        # Extract required fields
        service_account_email = service_account_data.get("client_email")
        private_key = service_account_data.get("private_key")

        if not service_account_email:
            raise ValueError("Service account JSON missing 'client_email' field")
        if not private_key:
            raise ValueError("Service account JSON missing 'private_key' field")

        logger.info(f"Service account email: {service_account_email}")

        # Step 1: Build JWT assertion
        jwt_assertion = build_jwt_assertion(
            service_account_email=service_account_email,
            private_key=private_key,
            scope=scope,
        )

        # Step 2: Exchange JWT for access token
        token_response = exchange_jwt_for_access_token(jwt_assertion)

        # Return the access token
        return token_response["access_token"]

    except Exception as e:
        error_msg = f"Failed to get access token from service account: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise ValueError(error_msg) from e


# ==================== Helper Functions ====================


def _base64url_encode(data: bytes) -> str:
    """Encode bytes to base64url format (RFC 4648)

    Args:
        data: Bytes to encode

    Returns:
        Base64url-encoded string (without padding)
    """
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _sign_with_rsa_sha256(message: bytes, private_key_pem: str) -> bytes:
    """Sign message with RSA SHA-256 using private key

    Args:
        message: Message bytes to sign
        private_key_pem: Private key in PEM format

    Returns:
        Signature bytes

    Raises:
        ValueError: If signing fails
    """
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding

        # Load private key from PEM format
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"), password=None
        )

        # Sign with RSA SHA-256
        signature = private_key.sign(
            message,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )

        return signature

    except Exception as e:
        error_msg = f"RSA SHA-256 signing failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise ValueError(error_msg) from e
