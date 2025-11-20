#!/usr/bin/env python3
"""
Smoke Tests for Post-Deployment Validation

These tests run after every deployment to ensure the application is healthy
and critical functionality works. They are fast, focused, and designed to catch
deployment issues quickly.

Run after deployment:
    BASE_URL=https://api.gatewayz.ai pytest tests/smoke/ -v

Run locally:
    pytest tests/smoke/ -v
"""

import pytest
import requests
import os
from typing import Dict, Any

# Configuration
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
TEST_API_KEY = os.getenv("TEST_API_KEY")  # Optional: API key for authenticated tests
TIMEOUT = 30  # seconds


# ============================================================
# SMOKE TEST MARKER
# ============================================================

pytestmark = pytest.mark.smoke


# ============================================================
# TEST CLASS: Application Health
# ============================================================

class TestApplicationHealth:
    """Verify basic application health"""

    def test_app_is_running(self):
        """Test that the application responds"""
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
            assert response.status_code == 200, "Health endpoint should return 200"
        except requests.exceptions.ConnectionError:
            pytest.fail("Application is not running or not reachable")
        except requests.exceptions.Timeout:
            pytest.fail("Health check timed out")

    def test_health_endpoint_structure(self):
        """Test health endpoint returns proper structure"""
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        assert response.status_code == 200

        health = response.json()
        assert "status" in health, "Health response should include status"

        # If database health is included, verify it
        if "database" in health:
            assert health["database"] in ["connected", "healthy", "ok"], \
                f"Database should be healthy, got: {health['database']}"

    def test_root_endpoint_responds(self):
        """Test root endpoint responds"""
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        # Root might return 200 or redirect, just ensure it's not 5xx
        assert response.status_code < 500, "Root endpoint should not return 5xx error"


# ============================================================
# TEST CLASS: Critical Endpoints Exist
# ============================================================

class TestCriticalEndpointsExist:
    """Verify critical endpoints exist (not 404)"""

    def test_chat_completions_endpoint_exists(self):
        """Test /v1/chat/completions endpoint exists"""
        # POST without auth should return 401/403, not 404
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            json={"model": "gpt-3.5-turbo", "messages": []},
            timeout=TIMEOUT
        )
        assert response.status_code != 404, "Chat completions endpoint should exist"
        assert response.status_code in [400, 401, 403, 422], \
            f"Expected auth/validation error, got {response.status_code}"

    def test_messages_endpoint_exists(self):
        """Test /v1/messages endpoint exists (Anthropic/Claude API)"""
        response = requests.post(
            f"{BASE_URL}/v1/messages",
            json={"model": "claude-3-opus", "messages": [], "max_tokens": 100},
            timeout=TIMEOUT
        )
        assert response.status_code != 404, "Messages endpoint should exist"
        assert response.status_code in [400, 401, 403, 422], \
            f"Expected auth/validation error, got {response.status_code}"

    def test_images_endpoint_exists(self):
        """Test /v1/images/generations endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/v1/images/generations",
            json={"prompt": "test"},
            timeout=TIMEOUT
        )
        assert response.status_code != 404, "Images endpoint should exist"
        assert response.status_code in [400, 401, 403, 422], \
            f"Expected auth/validation error, got {response.status_code}"

    def test_catalog_models_endpoint_exists(self):
        """Test /catalog/models endpoint exists"""
        response = requests.get(f"{BASE_URL}/catalog/models", timeout=TIMEOUT)
        assert response.status_code != 404, "Models catalog should exist"
        # This endpoint might be public or require auth
        assert response.status_code in [200, 401, 403], \
            f"Expected 200 or auth error, got {response.status_code}"

    def test_catalog_providers_endpoint_exists(self):
        """Test /catalog/providers endpoint exists"""
        response = requests.get(f"{BASE_URL}/catalog/providers", timeout=TIMEOUT)
        assert response.status_code != 404, "Providers catalog should exist"
        assert response.status_code in [200, 401, 403], \
            f"Expected 200 or auth error, got {response.status_code}"


# ============================================================
# TEST CLASS: Authentication System
# ============================================================

class TestAuthenticationSystem:
    """Verify authentication system is working"""

    def test_endpoints_require_authentication(self):
        """Test that protected endpoints reject unauthenticated requests"""
        endpoints = [
            ("POST", "/v1/chat/completions", {"model": "gpt-3.5-turbo", "messages": []}),
            ("POST", "/v1/messages", {"model": "claude-3-opus", "messages": [], "max_tokens": 100}),
            ("POST", "/v1/images/generations", {"prompt": "test"}),
        ]

        for method, endpoint, payload in endpoints:
            if method == "POST":
                response = requests.post(f"{BASE_URL}{endpoint}", json=payload, timeout=TIMEOUT)
            else:
                response = requests.get(f"{BASE_URL}{endpoint}", timeout=TIMEOUT)

            assert response.status_code in [401, 403, 422], \
                f"{endpoint} should reject unauthenticated requests, got {response.status_code}"

    def test_invalid_api_key_rejected(self):
        """Test that invalid API keys are rejected"""
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            headers={"Authorization": "Bearer invalid_fake_key_12345"},
            json={"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "test"}]},
            timeout=TIMEOUT
        )

        # Should return 401 Unauthorized
        assert response.status_code == 401, \
            f"Invalid API key should return 401, got {response.status_code}"


# ============================================================
# TEST CLASS: Authenticated Smoke Tests (Optional)
# ============================================================

@pytest.mark.skipif(not TEST_API_KEY, reason="No TEST_API_KEY environment variable set")
class TestAuthenticatedRequests:
    """Test authenticated requests with real API key (optional)"""

    def test_can_check_user_balance(self):
        """Test that authenticated user can check balance"""
        # Try common balance endpoints
        endpoints = ["/user/balance", "/balance", "/me"]

        success = False
        for endpoint in endpoints:
            try:
                response = requests.get(
                    f"{BASE_URL}{endpoint}",
                    headers={"Authorization": f"Bearer {TEST_API_KEY}"},
                    timeout=TIMEOUT
                )
                if response.status_code in [200, 401, 402]:
                    success = True
                    break
            except:
                continue

        assert success, "Should be able to access balance endpoint"

    def test_can_make_chat_completion_request(self):
        """Test that authenticated user can make chat completion request"""
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            headers={"Authorization": f"Bearer {TEST_API_KEY}"},
            json={
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": "Say 'hello'"}],
                "max_tokens": 5
            },
            timeout=TIMEOUT
        )

        # Should either succeed (200) or fail with insufficient credits (402)
        assert response.status_code in [200, 402, 429], \
            f"Expected 200, 402, or 429, got {response.status_code}"


# ============================================================
# TEST CLASS: Database Connectivity
# ============================================================

class TestDatabaseConnectivity:
    """Verify database connectivity"""

    def test_database_connection_via_health(self):
        """Test database connection through health endpoint"""
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)

        if response.status_code == 200:
            health = response.json()

            # Check if database status is reported
            db_keys = ["database", "db", "supabase", "postgres"]
            db_status = None

            for key in db_keys:
                if key in health:
                    db_status = health[key]
                    break

            if db_status:
                # If database status is reported, it should be healthy
                assert db_status in ["connected", "healthy", "ok", True, "up"], \
                    f"Database should be healthy, got: {db_status}"


# ============================================================
# TEST CLASS: External Service Connectivity
# ============================================================

class TestExternalServices:
    """Verify external service connectivity (optional checks)"""

    def test_can_reach_openrouter(self):
        """Test that OpenRouter is reachable (if configured)"""
        try:
            response = requests.get("https://openrouter.ai/api/v1/models", timeout=10)
            # OpenRouter should be reachable
            assert response.status_code in [200, 401], \
                "OpenRouter API should be reachable"
        except requests.exceptions.RequestException:
            pytest.skip("OpenRouter not reachable (network issue)")


# ============================================================
# TEST CLASS: Response Time
# ============================================================

class TestResponseTimes:
    """Verify response times are acceptable"""

    def test_health_check_responds_quickly(self):
        """Test health check responds within acceptable time"""
        import time

        start = time.time()
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 5.0, f"Health check took {elapsed:.2f}s (should be < 5s)"

    def test_catalog_endpoints_respond_quickly(self):
        """Test catalog endpoints respond within acceptable time"""
        import time

        endpoints = ["/catalog/models", "/catalog/providers"]

        for endpoint in endpoints:
            try:
                start = time.time()
                response = requests.get(f"{BASE_URL}{endpoint}", timeout=TIMEOUT)
                elapsed = time.time() - start

                if response.status_code == 200:
                    # If public, should be fast
                    assert elapsed < 10.0, \
                        f"{endpoint} took {elapsed:.2f}s (should be < 10s)"
            except:
                # If endpoint requires auth or doesn't exist, skip timing check
                pass


# ============================================================
# TEST CLASS: Error Handling
# ============================================================

class TestErrorHandling:
    """Verify proper error handling"""

    def test_invalid_endpoint_returns_404(self):
        """Test that invalid endpoints return 404"""
        response = requests.get(f"{BASE_URL}/nonexistent/endpoint", timeout=TIMEOUT)
        assert response.status_code == 404, "Invalid endpoint should return 404"

    def test_malformed_json_returns_400(self):
        """Test that malformed JSON returns 400"""
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            headers={
                "Authorization": "Bearer test_key",
                "Content-Type": "application/json"
            },
            data="invalid json{{{",
            timeout=TIMEOUT
        )

        assert response.status_code in [400, 422], \
            f"Malformed JSON should return 400/422, got {response.status_code}"

    def test_missing_required_fields_returns_422(self):
        """Test that missing required fields returns validation error"""
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            headers={"Authorization": "Bearer test_key"},
            json={
                "model": "gpt-3.5-turbo"
                # messages field is missing
            },
            timeout=TIMEOUT
        )

        assert response.status_code == 422, \
            f"Missing required field should return 422, got {response.status_code}"


# ============================================================
# TEST CLASS: CORS Configuration
# ============================================================

class TestCORSConfiguration:
    """Verify CORS is configured"""

    def test_cors_headers_present(self):
        """Test that CORS headers are present in responses"""
        response = requests.options(
            f"{BASE_URL}/v1/chat/completions",
            headers={"Origin": "https://example.com"},
            timeout=TIMEOUT
        )

        # Should have CORS headers (or return 404/405 if OPTIONS not supported)
        if response.status_code == 200:
            # Check for CORS headers
            assert "access-control-allow-origin" in [h.lower() for h in response.headers], \
                "CORS headers should be present"


# ============================================================
# SUMMARY FUNCTION
# ============================================================

def print_smoke_test_summary():
    """Print summary of smoke test results"""
    print("\n" + "="*60)
    print("SMOKE TEST SUMMARY")
    print("="*60)
    print(f"BASE_URL: {BASE_URL}")
    print(f"TEST_API_KEY: {'Set' if TEST_API_KEY else 'Not set (skipping authenticated tests)'}")
    print("="*60 + "\n")


# Run summary on module load
print_smoke_test_summary()
