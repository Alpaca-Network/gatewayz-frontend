"""Tests for Google OAuth2 JWT exchange service

Tests the raw OAuth2 JWT exchange flow for Google service accounts
without using SDKs.
"""

import json
import time
from unittest.mock import MagicMock, patch

import pytest

from src.services.google_oauth2_jwt import (
    GOOGLE_OAUTH2_TOKEN_ENDPOINT,
    JWT_GRANT_TYPE,
    build_jwt_assertion,
    exchange_jwt_for_access_token,
    get_access_token_from_service_account,
    _base64url_encode,
)


# ==================== Test Fixtures ====================


@pytest.fixture
def mock_service_account_json():
    """Fixture providing a mock service account JSON"""
    return json.dumps({
        "type": "service_account",
        "project_id": "test-project-123",
        "private_key_id": "key-id-123",
        "private_key": (
            "-----BEGIN RSA PRIVATE KEY-----\n"
            "MIIEowIBAAKCAQEA2a2rwplBCXH/2yKzqnEICRa1RBVmYb3I01hDTdaVmX6p5IBm\n"
            "l6cPR95TK8a7aPOPVWvlDrg+CYq8P5BppqUEhZx2Y0CQ+uO0A3N9OBEaPGBQNjYA\n"
            "6qSGVVr8RkQWLDuFQPTy+5UD0LXXsM6xL3I39xwg7LLZ2XfkNqEtLqYRKmKGZWJC\n"
            "p6vXZXq6K7m9K5JJd7XGZQqCCTGqIZGv3kbWKJy+WKWL2yqUlDpMJa0zVkL5VvHV\n"
            "N2E0LSJLLXzQVKLYJZQfTN7F5XWjNqCCvFwM+qsVVzHz7bK5P5VLk7JK4vqVGYkE\n"
            "XzVmZKqMq9Nd5QDvXKvLGQoYg2j1FGOvpM7CsQIDAQABAoIBAQCqiKM0hZhDlvAL\n"
            "6wP8KZK2KWLFfLNKbYIr5nLCzKZJ8P7KvCZBuGZz5L3B2uEFQgJn0lX1t8B5bR9a\n"
            "TxP0L2Xc5zKnZvKLZJCZGQzVnGVGK7cM8Z0xB3YC8xZ2J9L5Q3K8R7Z5K9Q6Z8M7\n"
            "M0W6N2P1R1Q5S2O2S4T3P3U3T2V4U4W5V6X7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L1\n"
            "M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3\n"
            "S4T5U6V7W8X9Y0Z1A2AoGBAPrJIKhWVZDzKxLQRZ2qLZKqZb8Q5Z0vZ0Z1Z2Z3Z4Z5\n"
            "Z6Z7Z8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8\n"
            "D9E0F1G2H3I4J5K6L7M8N9O0PrZq0rAoGBAPrJIKhWVZDzKxLQRZ2qLZKqZb8Q5Z0v\n"
            "Z0Z1Z2Z3Z4Z5Z6Z7Z8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2\n"
            "X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0PrZq0rAoGBAPrJIKhWVZDzKxLQRZ2q\n"
            "LZKqZb8Q5Z0vZ0Z1Z2Z3Z4Z5Z6Z7Z8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6\n"
            "R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0PrZq0rAoGBAPrJIKhW\n"
            "VZDzKxLQRZ2qLZKqZb8Q5Z0vZ0Z1Z2Z3Z4Z5Z6Z7Z8Z9A0B1C2D3E4F5G6H7I8J9K0\n"
            "L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0PrZq0r\n"
            "AoGBAPrJIKhWVZDzKxLQRZ2qLZKqZb8Q5Z0vZ0Z1Z2Z3Z4Z5Z6Z7Z8Z9A0B1C2D3E4F\n"
            "-----END RSA PRIVATE KEY-----\n"
        ),
        "client_email": "test-sa@test-project.iam.gserviceaccount.com",
        "client_id": "123456789",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    })


@pytest.fixture
def mock_access_token_response():
    """Fixture providing a mock access token response"""
    return {
        "access_token": "ya29.mock_token_xyz123",
        "token_type": "Bearer",
        "expires_in": 3599,
    }


@pytest.fixture
def valid_service_account_email():
    """Fixture providing a valid service account email"""
    return "test-sa@test-project.iam.gserviceaccount.com"


@pytest.fixture
def valid_scope():
    """Fixture providing a valid Google OAuth2 scope"""
    return "https://www.googleapis.com/auth/cloud-platform"


# ==================== Tests for _base64url_encode ====================


def test_base64url_encode_simple():
    """Test base64url encoding of simple strings"""
    data = b"hello world"
    encoded = _base64url_encode(data)

    # Should be valid base64url (no padding, uses - and _ instead of + and /)
    assert "=" not in encoded
    assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
               for c in encoded)


def test_base64url_encode_json():
    """Test base64url encoding of JSON"""
    data = json.dumps({"test": "data"}).encode("utf-8")
    encoded = _base64url_encode(data)

    # Should be valid base64url
    assert "=" not in encoded


def test_base64url_encode_decode_roundtrip():
    """Test that base64url encoding can be decoded back"""
    import base64

    original = b"test data for encoding"
    encoded = _base64url_encode(original)

    # Add back padding for decoding
    padding = 4 - (len(encoded) % 4)
    if padding != 4:
        encoded_padded = encoded + "=" * padding
    else:
        encoded_padded = encoded

    decoded = base64.urlsafe_b64decode(encoded_padded)
    assert decoded == original


# ==================== Tests for build_jwt_assertion ====================


@patch("src.services.google_oauth2_jwt._sign_with_rsa_sha256")
def test_build_jwt_assertion_structure(mock_sign, valid_service_account_email, valid_scope):
    """Test JWT assertion has correct structure"""
    # Mock the signing function to return a dummy signature
    mock_sign.return_value = b"mock_signature"

    private_key = "-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY\n-----END RSA PRIVATE KEY-----"

    jwt_assertion = build_jwt_assertion(
        service_account_email=valid_service_account_email,
        private_key=private_key,
        scope=valid_scope,
    )

    # JWT should have three parts separated by dots
    parts = jwt_assertion.split(".")
    assert len(parts) == 3, "JWT should have 3 parts: header.payload.signature"

    header_b64, payload_b64, signature_b64 = parts

    # Decode header and payload (add padding for decoding)
    import base64

    def decode_jwt_part(part):
        padding = 4 - (len(part) % 4)
        if padding != 4:
            part = part + "=" * padding
        return json.loads(base64.urlsafe_b64decode(part))

    header = decode_jwt_part(header_b64)
    payload = decode_jwt_part(payload_b64)

    # Verify header
    assert header["typ"] == "JWT"
    assert header["alg"] == "RS256"

    # Verify payload
    assert payload["iss"] == valid_service_account_email
    assert payload["scope"] == valid_scope
    assert payload["aud"] == "https://oauth2.googleapis.com/token"
    assert payload["sub"] == valid_service_account_email
    assert "exp" in payload
    assert "iat" in payload
    assert payload["exp"] > payload["iat"]


@patch("src.services.google_oauth2_jwt._sign_with_rsa_sha256")
def test_build_jwt_assertion_with_custom_subject(mock_sign, valid_service_account_email, valid_scope):
    """Test JWT assertion with custom subject claim"""
    mock_sign.return_value = b"mock_signature"

    private_key = "-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY\n-----END RSA PRIVATE KEY-----"
    custom_subject = "user@example.com"

    jwt_assertion = build_jwt_assertion(
        service_account_email=valid_service_account_email,
        private_key=private_key,
        scope=valid_scope,
        subject=custom_subject,
    )

    parts = jwt_assertion.split(".")
    payload_b64 = parts[1]

    import base64

    padding = 4 - (len(payload_b64) % 4)
    if padding != 4:
        payload_b64 = payload_b64 + "=" * padding

    payload = json.loads(base64.urlsafe_b64decode(payload_b64))

    # Verify custom subject
    assert payload["sub"] == custom_subject


@patch("src.services.google_oauth2_jwt._sign_with_rsa_sha256")
def test_build_jwt_assertion_expiry(mock_sign, valid_service_account_email, valid_scope):
    """Test JWT assertion expiry calculation"""
    mock_sign.return_value = b"mock_signature"

    private_key = "-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY\n-----END RSA PRIVATE KEY-----"
    custom_expiry = 7200  # 2 hours

    before_time = int(time.time())
    jwt_assertion = build_jwt_assertion(
        service_account_email=valid_service_account_email,
        private_key=private_key,
        scope=valid_scope,
        expiry_seconds=custom_expiry,
    )
    after_time = int(time.time())

    parts = jwt_assertion.split(".")
    payload_b64 = parts[1]

    import base64

    padding = 4 - (len(payload_b64) % 4)
    if padding != 4:
        payload_b64 = payload_b64 + "=" * padding

    payload = json.loads(base64.urlsafe_b64decode(payload_b64))

    # Verify expiry is approximately current_time + custom_expiry
    assert before_time <= payload["iat"] <= after_time
    assert before_time + custom_expiry <= payload["exp"] <= after_time + custom_expiry


def test_build_jwt_assertion_invalid_key():
    """Test JWT assertion building with invalid private key"""
    with patch("src.services.google_oauth2_jwt._sign_with_rsa_sha256") as mock_sign:
        mock_sign.side_effect = ValueError("Invalid key format")

        with pytest.raises(ValueError, match="Failed to build JWT assertion"):
            build_jwt_assertion(
                service_account_email="test@example.com",
                private_key="invalid_key",
                scope="https://www.googleapis.com/auth/cloud-platform",
            )


# ==================== Tests for exchange_jwt_for_access_token ====================


@patch("httpx.Client.post")
def test_exchange_jwt_for_access_token_success(mock_post, mock_access_token_response):
    """Test successful JWT exchange for access token"""
    # Mock the HTTP response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_access_token_response
    mock_post.return_value = mock_response

    jwt_assertion = "header.payload.signature"
    result = exchange_jwt_for_access_token(jwt_assertion)

    # Verify the request was made correctly
    mock_post.assert_called_once()
    call_args = mock_post.call_args

    assert GOOGLE_OAUTH2_TOKEN_ENDPOINT in str(call_args)
    assert "data" in call_args.kwargs
    request_data = call_args.kwargs["data"]
    assert request_data["grant_type"] == JWT_GRANT_TYPE
    assert request_data["assertion"] == jwt_assertion

    # Verify response
    assert result["access_token"] == "ya29.mock_token_xyz123"
    assert result["token_type"] == "Bearer"
    assert result["expires_in"] == 3599


@patch("httpx.Client.post")
def test_exchange_jwt_for_access_token_401_error(mock_post):
    """Test JWT exchange with 401 unauthorized error"""
    # Mock the HTTP response
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.text = '{"error": "invalid_assertion"}'
    mock_post.return_value = mock_response

    jwt_assertion = "invalid.jwt.signature"

    with pytest.raises(ValueError, match="returned 401"):
        exchange_jwt_for_access_token(jwt_assertion)


@patch("httpx.Client.post")
def test_exchange_jwt_for_access_token_500_error(mock_post):
    """Test JWT exchange with 500 server error"""
    # Mock the HTTP response
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_post.return_value = mock_response

    jwt_assertion = "header.payload.signature"

    with pytest.raises(ValueError, match="returned 500"):
        exchange_jwt_for_access_token(jwt_assertion)


@patch("httpx.Client.post")
def test_exchange_jwt_for_access_token_network_error(mock_post):
    """Test JWT exchange with network error"""
    import httpx

    mock_post.side_effect = httpx.NetworkError("Connection failed")

    jwt_assertion = "header.payload.signature"

    with pytest.raises(ValueError, match="Failed to exchange JWT"):
        exchange_jwt_for_access_token(jwt_assertion)


# ==================== Tests for get_access_token_from_service_account ====================


@patch("src.services.google_oauth2_jwt.exchange_jwt_for_access_token")
@patch("src.services.google_oauth2_jwt.build_jwt_assertion")
def test_get_access_token_from_service_account_success(
    mock_build_jwt, mock_exchange, mock_service_account_json
):
    """Test getting access token from service account JSON"""
    # Mock the JWT building and exchange
    mock_build_jwt.return_value = "mock.jwt.assertion"
    mock_exchange.return_value = {
        "access_token": "ya29.mock_token",
        "token_type": "Bearer",
        "expires_in": 3599,
    }

    result = get_access_token_from_service_account(mock_service_account_json)

    # Verify JWT was built
    mock_build_jwt.assert_called_once()
    call_args = mock_build_jwt.call_args
    assert call_args.kwargs["service_account_email"] == "test-sa@test-project.iam.gserviceaccount.com"
    assert call_args.kwargs["scope"] == "https://www.googleapis.com/auth/cloud-platform"

    # Verify JWT was exchanged
    mock_exchange.assert_called_once_with("mock.jwt.assertion")

    # Verify result
    assert result == "ya29.mock_token"


def test_get_access_token_from_service_account_invalid_json():
    """Test with invalid service account JSON"""
    invalid_json = "not valid json"

    with pytest.raises(ValueError, match="Invalid service account JSON"):
        get_access_token_from_service_account(invalid_json)


def test_get_access_token_from_service_account_missing_email():
    """Test with service account JSON missing client_email"""
    invalid_json = json.dumps({
        "type": "service_account",
        # Missing "client_email"
        "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----",
    })

    with pytest.raises(ValueError, match="client_email"):
        get_access_token_from_service_account(invalid_json)


def test_get_access_token_from_service_account_missing_key():
    """Test with service account JSON missing private_key"""
    invalid_json = json.dumps({
        "type": "service_account",
        "client_email": "test@example.com",
        # Missing "private_key"
    })

    with pytest.raises(ValueError, match="private_key"):
        get_access_token_from_service_account(invalid_json)


@patch("src.services.google_oauth2_jwt.exchange_jwt_for_access_token")
@patch("src.services.google_oauth2_jwt.build_jwt_assertion")
def test_get_access_token_from_service_account_custom_scope(
    mock_build_jwt, mock_exchange, mock_service_account_json
):
    """Test with custom OAuth2 scope"""
    mock_build_jwt.return_value = "mock.jwt.assertion"
    mock_exchange.return_value = {
        "access_token": "ya29.mock_token",
        "token_type": "Bearer",
        "expires_in": 3599,
    }

    custom_scope = "https://www.googleapis.com/auth/ai-platform"
    result = get_access_token_from_service_account(mock_service_account_json, scope=custom_scope)

    # Verify custom scope was used
    call_args = mock_build_jwt.call_args
    assert call_args.kwargs["scope"] == custom_scope

    assert result == "ya29.mock_token"


# ==================== Integration Tests ====================


@pytest.mark.integration
@patch("httpx.Client.post")
@patch("src.services.google_oauth2_jwt._sign_with_rsa_sha256")
def test_full_oauth2_jwt_flow_integration(
    mock_sign, mock_post, mock_service_account_json, mock_access_token_response
):
    """Test the complete OAuth2 JWT flow end-to-end"""
    # Mock signing
    mock_sign.return_value = b"mock_signature_bytes"

    # Mock HTTP response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_access_token_response
    mock_post.return_value = mock_response

    # Execute the full flow
    result = get_access_token_from_service_account(mock_service_account_json)

    # Verify we got an access token
    assert result == "ya29.mock_token_xyz123"

    # Verify HTTP POST was called
    assert mock_post.called

    # Verify the request data contains the required fields
    call_args = mock_post.call_args
    request_data = call_args.kwargs.get("data", {})
    assert request_data.get("grant_type") == JWT_GRANT_TYPE
    assert "assertion" in request_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
