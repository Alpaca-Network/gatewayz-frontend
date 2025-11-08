"""Unit tests for JWT id_token fallback logic

Simple unit tests that don't require database connection.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from src.services.google_oauth2_jwt import exchange_jwt_for_access_token


class TestJWTIdTokenFallback:
    """Unit tests for JWT id_token fallback"""

    def test_id_token_fallback_scenario(self):
        """Test the exact scenario from the bug report"""
        test_jwt = "test.jwt.assertion"

        # This is the exact response structure from the error message
        google_response = {
            "id_token": (
                "eyJhbGciOiJSUzI1NiIsImtpZCI6ImI1ZTQ0MGFlOTQxZTk5ODFlZTJmYTEzNzZkNDJjNDZkNzMxZGVlM2YiLCJ0eXAiOiJKV1QifQ."
                "eyJhdWQiOiJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2Nsb3VkLXBsYXRmb3JtLGh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvYWlwbGF0Zm9ybSIsImF6cCI6ImdhdGV3YXl6QGdhdGV3YXl6LTQ2ODUxOS5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsImVtYWlsIjoiZ2F0ZXdheXpAZ2F0ZXdheXotNDY4NTE5LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImV4cCI6MTc2MjU5MzEzMiwiaWF0IjoxNzYyNTg5NTMyLCJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDEwODIzNjEyMjkxMjI1ODI0NzQifQ."
                "W22Xg2LoJH7aS7U9wWTP1zaxZGRI7SgdCSiwaiZls-pu7-ImcZ-GuAibI3J_usJB-PkolLuojvhZlLRxXfljkcMl4Tn8xOJPeLSHEA_v4wGaTqyWHudaFlJ0W9kIvRRxhr28vqT73qBqxvCnEg3sy0ppTYjYgXLQ3IXgj8ejGgEIA3G-mVBDXadCcOlR2k2KfbneFX8om0c9sswHWmfS8_EMUBh6abjrWK4UZ-FZvbefYevxA8cQO3AsQKywMy-WWUOLJT2CpEYsWN53Gkm4Ly4ymIxhQPwtkx5k25gsVkBSUU5QuKtQlv0DSMmOKvdeRvavtbealsLqrZY70iXtsg"
            )
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = google_response

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            # This should NOT raise an error anymore
            result = exchange_jwt_for_access_token(test_jwt)

            # The id_token should be used as the access_token
            assert result["access_token"] == google_response["id_token"]
            assert result["token_type"] == "Bearer"

    def test_comparison_before_and_after_fix(self):
        """Document the behavior change from the fix"""
        test_jwt = "test.jwt"
        id_token = "google.id_token.jwt"

        # Response that only has id_token (no access_token)
        google_response = {"id_token": id_token}

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = google_response

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            # BEFORE FIX: This would raise "Failed to exchange JWT for access token"
            # AFTER FIX: This works and returns the id_token
            result = exchange_jwt_for_access_token(test_jwt)

            assert result["access_token"] == id_token
            assert result is not None

    def test_fallback_order(self):
        """Test that access_token is preferred over id_token"""
        test_jwt = "test.jwt"
        access_token = "access.token"
        id_token = "id.token"

        # Response with both tokens
        google_response = {
            "access_token": access_token,
            "id_token": id_token,
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = google_response

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value.__enter__.return_value = mock_client
            mock_client.post.return_value = mock_response

            result = exchange_jwt_for_access_token(test_jwt)

            # Should prefer access_token
            assert result["access_token"] == access_token
            assert result["access_token"] != id_token


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
