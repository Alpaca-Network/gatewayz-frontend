#!/usr/bin/env python3
"""
Comprehensive tests for provider failover logic - CRITICAL for reliability

Tests cover:
- Provider chain building
- Failover eligibility detection
- Error mapping from various exception types
- Retry-after header propagation
- Authentication error handling
- Rate limit error handling
- Timeout error handling
- Model not found errors
"""

import pytest
from unittest.mock import Mock
import asyncio
import httpx
from fastapi import HTTPException

from src.services.provider_failover import (
    build_provider_failover_chain,
    should_failover,
    map_provider_error,
    FALLBACK_PROVIDER_PRIORITY,
    FALLBACK_ELIGIBLE_PROVIDERS,
    FAILOVER_STATUS_CODES
)

# Try to import OpenAI SDK exceptions (same pattern as the module)
try:
    from openai import (
        APIConnectionError,
        APIStatusError,
        APITimeoutError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        OpenAIError,
        PermissionDeniedError,
        RateLimitError,
    )
    OPENAI_SDK_AVAILABLE = True
except ImportError:
    OPENAI_SDK_AVAILABLE = False
    # Create mock exception classes for testing
    class APIConnectionError(Exception):
        pass
    class APITimeoutError(Exception):
        pass
    class APIStatusError(Exception):
        def __init__(self, message, response=None, body=None):
            super().__init__(message)
            self.response = response
            self.body = body
            self.status_code = getattr(response, 'status_code', 500) if response else 500
    class AuthenticationError(APIStatusError):
        pass
    class BadRequestError(APIStatusError):
        pass
    class NotFoundError(APIStatusError):
        pass
    class OpenAIError(Exception):
        pass
    class PermissionDeniedError(APIStatusError):
        pass
    class RateLimitError(APIStatusError):
        pass


# ============================================================
# TEST CLASS: Provider Chain Building
# ============================================================

class TestBuildProviderFailoverChain:
    """Test provider failover chain construction"""

    def test_chain_with_huggingface_first(self):
        """Test chain starting with huggingface"""
        chain = build_provider_failover_chain("huggingface")

        assert chain[0] == "huggingface"
        assert "featherless" in chain
        assert "fireworks" in chain
        assert "together" in chain
        assert "openrouter" in chain
        # Verify all providers in priority list are included
        assert len(chain) == len(FALLBACK_PROVIDER_PRIORITY)

    def test_chain_with_openrouter_first(self):
        """Test chain starting with openrouter"""
        chain = build_provider_failover_chain("openrouter")

        assert chain[0] == "openrouter"
        # Other providers should follow in priority order
        remaining = [p for p in chain if p != "openrouter"]
        for i, provider in enumerate(remaining):
            # Should be in same relative order as FALLBACK_PROVIDER_PRIORITY
            assert provider in FALLBACK_PROVIDER_PRIORITY

    def test_chain_with_featherless_first(self):
        """Test chain starting with featherless"""
        chain = build_provider_failover_chain("featherless")

        assert chain[0] == "featherless"
        assert "huggingface" in chain
        assert "fireworks" in chain
        assert len(chain) == len(FALLBACK_PROVIDER_PRIORITY)

    def test_chain_with_none_provider(self):
        """Test chain with None provider defaults to openrouter"""
        chain = build_provider_failover_chain(None)

        assert chain[0] == "openrouter"

    def test_chain_with_empty_string(self):
        """Test chain with empty string defaults to openrouter"""
        chain = build_provider_failover_chain("")

        assert chain[0] == "openrouter"

    def test_chain_with_unknown_provider(self):
        """Test chain with unknown provider (not in fallback list)"""
        chain = build_provider_failover_chain("custom_provider")

        # Unknown providers should only return themselves (no fallback)
        assert chain == ["custom_provider"]

    def test_chain_with_removed_provider(self):
        """Test chain with removed provider (not eligible for fallback)"""
        # Portkey has been removed and is no longer a valid provider
        # Test that unknown providers return only themselves
        chain = build_provider_failover_chain("unknown_provider")

        # Unknown providers should only return themselves (no fallback chain)
        assert chain == ["unknown_provider"]

    def test_chain_case_insensitive(self):
        """Test chain building is case insensitive"""
        chain_lower = build_provider_failover_chain("huggingface")
        chain_upper = build_provider_failover_chain("HUGGINGFACE")
        chain_mixed = build_provider_failover_chain("HuggingFace")

        assert chain_lower == chain_upper == chain_mixed

    def test_chain_no_duplicates(self):
        """Test chain has no duplicate providers"""
        for provider in FALLBACK_ELIGIBLE_PROVIDERS:
            chain = build_provider_failover_chain(provider)
            assert len(chain) == len(set(chain))

    def test_fallback_provider_priority_constants(self):
        """Test fallback provider constants are defined correctly"""
        assert "huggingface" in FALLBACK_PROVIDER_PRIORITY
        assert "featherless" in FALLBACK_PROVIDER_PRIORITY
        assert "fireworks" in FALLBACK_PROVIDER_PRIORITY
        assert "together" in FALLBACK_PROVIDER_PRIORITY
        assert "openrouter" in FALLBACK_PROVIDER_PRIORITY

        # Verify FALLBACK_ELIGIBLE_PROVIDERS matches priority list
        assert FALLBACK_ELIGIBLE_PROVIDERS == set(FALLBACK_PROVIDER_PRIORITY)


# ============================================================
# TEST CLASS: Failover Eligibility
# ============================================================

class TestShouldFailover:
    """Test failover eligibility detection"""

    def test_should_failover_401(self):
        """Test 401 Unauthorized triggers failover"""
        exc = HTTPException(status_code=401, detail="Unauthorized")
        assert should_failover(exc) is True

    def test_should_failover_403(self):
        """Test 403 Forbidden triggers failover"""
        exc = HTTPException(status_code=403, detail="Forbidden")
        assert should_failover(exc) is True

    def test_should_failover_404(self):
        """Test 404 Not Found triggers failover"""
        exc = HTTPException(status_code=404, detail="Not Found")
        assert should_failover(exc) is True

    def test_should_failover_429(self):
        """Test 429 Rate Limit does NOT trigger failover - client should retry"""
        exc = HTTPException(status_code=429, detail="Rate Limited")
        # 429 should be returned to client with Retry-After header, not trigger failover
        assert should_failover(exc) is False

    def test_should_failover_502(self):
        """Test 502 Bad Gateway triggers failover"""
        exc = HTTPException(status_code=502, detail="Bad Gateway")
        assert should_failover(exc) is True

    def test_should_failover_503(self):
        """Test 503 Service Unavailable triggers failover"""
        exc = HTTPException(status_code=503, detail="Service Unavailable")
        assert should_failover(exc) is True

    def test_should_failover_504(self):
        """Test 504 Gateway Timeout triggers failover"""
        exc = HTTPException(status_code=504, detail="Gateway Timeout")
        assert should_failover(exc) is True

    def test_should_not_failover_200(self):
        """Test 200 OK does not trigger failover"""
        exc = HTTPException(status_code=200, detail="OK")
        assert should_failover(exc) is False

    def test_should_not_failover_400(self):
        """Test 400 Bad Request does not trigger failover"""
        exc = HTTPException(status_code=400, detail="Bad Request")
        assert should_failover(exc) is False

    def test_should_not_failover_500(self):
        """Test 500 Internal Server Error does not trigger failover"""
        exc = HTTPException(status_code=500, detail="Internal Server Error")
        assert should_failover(exc) is False

    def test_failover_status_codes_constant(self):
        """Test FAILOVER_STATUS_CODES contains expected codes"""
        assert 401 in FAILOVER_STATUS_CODES
        assert 403 in FAILOVER_STATUS_CODES
        assert 404 in FAILOVER_STATUS_CODES
        assert 502 in FAILOVER_STATUS_CODES
        assert 503 in FAILOVER_STATUS_CODES
        assert 504 in FAILOVER_STATUS_CODES

        # Verify codes that should NOT trigger failover
        assert 400 not in FAILOVER_STATUS_CODES
        assert 429 not in FAILOVER_STATUS_CODES  # 429 should be returned to client
        assert 500 not in FAILOVER_STATUS_CODES


# ============================================================
# TEST CLASS: Error Mapping - HTTPException
# ============================================================

class TestMapProviderErrorHTTPException:
    """Test mapping existing HTTPException instances"""

    def test_map_http_exception_passthrough(self):
        """Test HTTPException is passed through unchanged"""
        original = HTTPException(status_code=404, detail="Not found")
        mapped = map_provider_error("openrouter", "gpt-4", original)

        assert mapped is original
        assert mapped.status_code == 404
        assert mapped.detail == "Not found"

    def test_map_value_error(self):
        """Test ValueError is mapped to 400"""
        error = ValueError("Invalid parameter")
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 400
        assert "Invalid parameter" in mapped.detail


# ============================================================
# TEST CLASS: Error Mapping - HTTPX Exceptions
# ============================================================

class TestMapProviderErrorHTTPX:
    """Test mapping httpx exceptions"""

    def test_map_httpx_timeout_exception(self):
        """Test httpx.TimeoutException maps to 504"""
        error = httpx.TimeoutException("Request timeout")
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 504
        assert "timeout" in mapped.detail.lower()

    def test_map_asyncio_timeout_error(self):
        """Test asyncio.TimeoutError maps to 504"""
        error = asyncio.TimeoutError()
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 504
        assert "timeout" in mapped.detail.lower()

    def test_map_httpx_request_error(self):
        """Test httpx.RequestError maps to 503"""
        error = httpx.RequestError("Connection failed")
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 503
        assert "unavailable" in mapped.detail.lower()

    def test_map_httpx_status_error_429_with_retry_after(self):
        """Test httpx 429 error preserves Retry-After header"""
        response = Mock()
        response.status_code = 429
        response.headers = {"retry-after": "60"}

        error = httpx.HTTPStatusError("Rate limited", request=Mock(), response=response)
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 429
        assert "rate limit" in mapped.detail.lower()
        assert mapped.headers is not None
        assert mapped.headers.get("Retry-After") == "60"

    def test_map_httpx_status_error_429_without_retry_after(self):
        """Test httpx 429 error without Retry-After header"""
        response = Mock()
        response.status_code = 429
        response.headers = {}

        error = httpx.HTTPStatusError("Rate limited", request=Mock(), response=response)
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 429
        assert "rate limit" in mapped.detail.lower()

    def test_map_httpx_status_error_401(self):
        """Test httpx 401 error maps to 500 (internal auth issue)"""
        response = Mock()
        response.status_code = 401
        response.headers = {}

        error = httpx.HTTPStatusError("Unauthorized", request=Mock(), response=response)
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 500
        assert "authentication" in mapped.detail.lower()

    def test_map_httpx_status_error_404(self):
        """Test httpx 404 error indicates model not found"""
        response = Mock()
        response.status_code = 404
        response.headers = {}

        error = httpx.HTTPStatusError("Not found", request=Mock(), response=response)
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 404
        assert "not found" in mapped.detail.lower()
        assert "gpt-4" in mapped.detail

    def test_map_httpx_status_error_4xx(self):
        """Test httpx 4xx errors map to 400"""
        for status in [400, 422]:
            response = Mock()
            response.status_code = status
            response.headers = {}

            error = httpx.HTTPStatusError("Client error", request=Mock(), response=response)
            mapped = map_provider_error("openrouter", "gpt-4", error)

            assert mapped.status_code == 400
            assert "rejected" in mapped.detail.lower()

    def test_map_httpx_status_error_5xx(self):
        """Test httpx 5xx errors map to 502"""
        for status in [500, 502, 503]:
            response = Mock()
            response.status_code = status
            response.headers = {}

            error = httpx.HTTPStatusError("Server error", request=Mock(), response=response)
            mapped = map_provider_error("openrouter", "gpt-4", error)

            assert mapped.status_code == 502
            assert "error" in mapped.detail.lower()


# ============================================================
# TEST CLASS: Error Mapping - OpenAI SDK Exceptions
# ============================================================

@pytest.mark.skipif(not OPENAI_SDK_AVAILABLE, reason="OpenAI SDK not installed")
class TestMapProviderErrorOpenAI:
    """Test mapping OpenAI SDK exceptions"""

    def test_map_api_connection_error(self):
        """Test APIConnectionError maps to 503"""
        # APIConnectionError requires a request parameter in newer OpenAI SDK versions
        mock_request = Mock()
        error = APIConnectionError(request=mock_request)
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 503
        assert "unavailable" in mapped.detail.lower()

    def test_map_api_timeout_error(self):
        """Test APITimeoutError maps to 504"""
        # APITimeoutError requires a request parameter in newer OpenAI SDK versions
        mock_request = Mock()
        error = APITimeoutError(request=mock_request)
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 504
        assert "timeout" in mapped.detail.lower()

    def test_map_rate_limit_error_with_retry_after_header(self):
        """Test RateLimitError with Retry-After in response headers"""
        response = Mock()
        response.headers = {"retry-after": "120"}

        error = RateLimitError("Rate limited", response=response, body=None)
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 429
        assert "rate limit" in mapped.detail.lower()
        assert mapped.headers is not None
        assert mapped.headers.get("Retry-After") == "120"

    def test_map_rate_limit_error_with_retry_after_body(self):
        """Test RateLimitError with retry_after in body"""
        # Create a mock response with no retry-after header
        response = Mock()
        response.headers = {}
        # RateLimitError requires message, response, and body parameters
        error = RateLimitError(message="Rate limited", response=response, body={"retry_after": 90})
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 429
        assert mapped.headers is not None
        assert mapped.headers.get("Retry-After") == "90"

    def test_map_authentication_error(self):
        """Test AuthenticationError maps to 401"""
        response = Mock()
        response.status_code = 401
        error = AuthenticationError("Invalid API key", response=response, body=None)
        error.status_code = 401
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 401
        assert "authentication" in mapped.detail.lower()

    def test_map_permission_denied_error(self):
        """Test PermissionDeniedError maps to 401"""
        response = Mock()
        response.status_code = 403
        error = PermissionDeniedError("Permission denied", response=response, body=None)
        error.status_code = 403
        mapped = map_provider_error("openrouter", "gpt-4", error)

        # Should map to 401 (authentication issue)
        assert mapped.status_code == 401
        assert "authentication" in mapped.detail.lower()

    def test_map_not_found_error(self):
        """Test NotFoundError indicates model not available"""
        response = Mock()
        response.status_code = 404
        error = NotFoundError("Model not found", response=response, body=None)
        error.status_code = 404
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 404
        assert "not found" in mapped.detail.lower()
        assert "gpt-4" in mapped.detail
        assert "openrouter" in mapped.detail.lower()

    def test_map_bad_request_error(self):
        """Test BadRequestError maps to 400"""
        response = Mock()
        response.status_code = 400
        error = BadRequestError("Invalid request", response=response, body=None)
        error.status_code = 400
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 400
        assert "rejected" in mapped.detail.lower()

    def test_map_generic_openai_error(self):
        """Test generic OpenAIError maps to 502"""
        error = OpenAIError("Unknown error")
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 502

    def test_map_api_status_error_with_custom_status(self):
        """Test APIStatusError with custom status code"""
        response = Mock()
        response.status_code = 418  # I'm a teapot
        error = APIStatusError("Custom error", response=response, body=None)
        error.status_code = 418
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 418

    def test_map_api_status_error_invalid_status(self):
        """Test APIStatusError with invalid status code defaults to 500"""
        response = Mock()
        response.status_code = "invalid"
        error = APIStatusError("Error", response=response, body=None)
        error.status_code = "invalid"
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 500

    def test_map_api_status_error_404_generic(self):
        """Test generic APIStatusError with 404 status provides proper error message"""
        response = Mock()
        response.status_code = 404
        error = APIStatusError("Not Found", response=response, body=None)
        error.status_code = 404
        error.message = "Not Found"
        mapped = map_provider_error("openrouter", "test-model", error)

        assert mapped.status_code == 404
        assert "test-model" in mapped.detail
        assert "openrouter" in mapped.detail.lower()
        assert "not found" in mapped.detail.lower()
        # Should NOT be just "Not Found" - should include model and provider
        assert mapped.detail != "Not Found"


# ============================================================
# TEST CLASS: Error Mapping - Generic Exceptions
# ============================================================

class TestMapProviderErrorGeneric:
    """Test mapping generic exceptions"""

    def test_map_generic_exception(self):
        """Test generic Exception maps to 502"""
        error = Exception("Unknown error")
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 502
        assert "error" in mapped.detail.lower()

    def test_map_runtime_error(self):
        """Test RuntimeError maps to 502"""
        error = RuntimeError("Runtime error")
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 502

    def test_map_key_error(self):
        """Test KeyError maps to 502"""
        error = KeyError("missing_key")
        mapped = map_provider_error("openrouter", "gpt-4", error)

        assert mapped.status_code == 502


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestProviderFailoverIntegration:
    """Test provider failover integration scenarios"""

    def test_complete_failover_chain_all_providers(self):
        """Test complete failover chain with all providers"""
        for provider in FALLBACK_ELIGIBLE_PROVIDERS:
            chain = build_provider_failover_chain(provider)

            # First should be the requested provider
            assert chain[0] == provider

            # Should include all fallback providers
            for fallback in FALLBACK_PROVIDER_PRIORITY:
                assert fallback in chain

            # Should have no duplicates
            assert len(chain) == len(set(chain))

    def test_failover_decision_matrix(self):
        """Test failover decisions for various error scenarios"""
        test_cases = [
            # (status_code, should_failover)
            (401, True),   # Auth error - try another provider
            (403, True),   # Permission denied - try another provider
            (404, True),   # Model not found - try another provider
            (429, False),  # Rate limited - return to client (don't failover)
            (502, True),   # Bad gateway - try another provider
            (503, True),   # Service unavailable - try another provider
            (504, True),   # Gateway timeout - try another provider
            (400, False),  # Bad request - don't failover
            (422, False),  # Validation error - don't failover
            (500, False),  # Internal server error - don't failover
        ]

        for status_code, expected_should_failover in test_cases:
            exc = HTTPException(status_code=status_code, detail="Test")
            result = should_failover(exc)
            assert result == expected_should_failover, \
                f"Status {status_code} should {' ' if expected_should_failover else 'not '}failover"

    def test_error_mapping_preserves_provider_context(self):
        """Test error messages include provider and model context"""
        test_cases = [
            (httpx.HTTPStatusError("", request=Mock(), response=Mock(status_code=404, headers={})),
             "openrouter", "gpt-4", 404),
            (httpx.HTTPStatusError("", request=Mock(), response=Mock(status_code=401, headers={})),
             "fireworks", "llama-2", 500),
        ]

        for error, provider, model, expected_status in test_cases:
            mapped = map_provider_error(provider, model, error)
            assert mapped.status_code == expected_status

            # Verify context is preserved in detail
            if expected_status == 404:
                assert model in mapped.detail
                assert provider in mapped.detail.lower()
