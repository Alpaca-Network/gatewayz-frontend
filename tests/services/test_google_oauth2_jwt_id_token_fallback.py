"""Test Google OAuth2 JWT id_token fallback functionality

This test module verifies that the google_oauth2_jwt service correctly
handles cases where Google's OAuth2 endpoint returns an id_token instead
of an access_token.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from src.services.google_oauth2_jwt import exchange_jwt_for_access_token


class TestIdTokenFallback:
    """Test cases for id_token fallback in OAuth2 exchange"""

    def test_exchange_jwt_returns_access_token_when_present(self):
        """Test normal flow: access_token is present in response"""
        test_jwt = "test.jwt.assertion"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test_access_token_value",
            "token_type": "Bearer",
            "expires_in": 3600,
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            result = exchange_jwt_for_access_token(test_jwt)

            assert result["access_token"] == "test_access_token_value"
            assert result["token_type"] == "Bearer"
            assert result["expires_in"] == 3600

    def test_exchange_jwt_falls_back_to_id_token(self):
        """Test fallback: id_token is used when access_token is missing"""
        test_jwt = "test.jwt.assertion"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id_token": "test_id_token_value",
            "token_type": "Bearer",
            "expires_in": 3600,
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            result = exchange_jwt_for_access_token(test_jwt)

            assert result["access_token"] == "test_id_token_value"
            assert result["token_type"] == "Bearer"
            assert result["expires_in"] == 3600

    def test_exchange_jwt_prefers_access_token_over_id_token(self):
        """Test that access_token is preferred when both are present"""
        test_jwt = "test.jwt.assertion"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test_access_token_value",
            "id_token": "test_id_token_value",
            "token_type": "Bearer",
            "expires_in": 3600,
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            result = exchange_jwt_for_access_token(test_jwt)

            # Should use access_token, not id_token
            assert result["access_token"] == "test_access_token_value"

    def test_exchange_jwt_raises_when_no_token_present(self):
        """Test that error is raised when neither token is present"""
        test_jwt = "test.jwt.assertion"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "token_type": "Bearer",
            "expires_in": 3600,
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            with pytest.raises(ValueError) as exc_info:
                exchange_jwt_for_access_token(test_jwt)

            assert "No access_token or id_token in OAuth2 response" in str(exc_info.value)

    def test_exchange_jwt_handles_http_error(self):
        """Test that HTTP errors are properly handled"""
        test_jwt = "test.jwt.assertion"

        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Invalid grant"

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            with pytest.raises(ValueError) as exc_info:
                exchange_jwt_for_access_token(test_jwt)

            assert "Google OAuth2 token endpoint returned 400" in str(exc_info.value)

    def test_exchange_jwt_sends_correct_request(self):
        """Test that the correct request is sent to Google's token endpoint"""
        test_jwt = "test.jwt.assertion"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test_token",
            "token_type": "Bearer",
            "expires_in": 3600,
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            exchange_jwt_for_access_token(test_jwt)

            # Verify the correct endpoint was called
            mock_client.post.assert_called_once()
            call_args = mock_client.post.call_args

            assert "https://oauth2.googleapis.com/token" in call_args[0]

            # Verify request data
            request_data = call_args[1]["data"]
            assert request_data["grant_type"] == "urn:ietf:params:oauth:grant-type:jwt-bearer"
            assert request_data["assertion"] == test_jwt

    def test_id_token_with_real_google_response_structure(self):
        """Test with a realistic Google OAuth2 response containing id_token"""
        test_jwt = "test.jwt.assertion"

        # Simulate real Google response with id_token
        google_id_token = (
            "eyJhbGciOiJSUzI1NiIsImtpZCI6ImI1ZTQ0MGFlOTQxZTk5ODFlZTJmYTEzNzZkNDJjNDZkNzMxZGVlM2YiLCJ0eXAiOiJKV1QifQ."
            "eyJhdWQiOiJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2Nsb3VkLXBsYXRmb3JtIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwi"
            "ZW1haWxfdmVyaWZpZWQiOnRydWUsImV4cCI6MTcwMDAwMDAwMCwiaWF0IjoxNjk5OTk2NDAwLCJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMjM0NTY3ODkwIn0."
            "signature_placeholder"
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id_token": google_id_token,
            "token_type": "Bearer",
            "expires_in": 3600,
        }

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            result = exchange_jwt_for_access_token(test_jwt)

            assert result["access_token"] == google_id_token
            assert result["token_type"] == "Bearer"
            assert result["expires_in"] == 3600


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
