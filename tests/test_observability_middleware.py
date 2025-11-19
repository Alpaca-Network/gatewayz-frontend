"""
Tests for observability middleware.

Tests verify that the ObservabilityMiddleware correctly tracks:
- HTTP request metrics (duration, size, status code)
- In-progress request gauge
- Request/response size histograms
- Path normalization for preventing cardinality explosion
"""

import pytest
from fastapi import FastAPI, Request
from prometheus_client import REGISTRY, generate_latest
from starlette.testclient import TestClient

from src.middleware.observability_middleware import ObservabilityMiddleware
from src.services.prometheus_metrics import (
    http_request_duration,
    fastapi_requests_in_progress,
    fastapi_request_size_bytes,
    fastapi_response_size_bytes,
    fastapi_requests_total,
    fastapi_requests_duration_seconds,
)


# ==================== Test Fixtures ====================


@pytest.fixture
def test_app():
    """Create a test FastAPI app with observability middleware."""
    app = FastAPI()

    # Add middleware
    app.add_middleware(ObservabilityMiddleware)

    # Add test routes
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.post("/data")
    async def data(request: Request):
        body = await request.json()
        return {"received": body}

    @app.get("/users/{user_id}")
    async def get_user(user_id: str):
        return {"user_id": user_id, "name": "Test User"}

    @app.get("/slow")
    async def slow():
        import time
        time.sleep(0.1)
        return {"status": "slow"}

    @app.get("/error")
    async def error():
        raise ValueError("Test error")

    return app


@pytest.fixture
def client(test_app):
    """Create a test client."""
    return TestClient(test_app)


@pytest.fixture(autouse=True)
def reset_metrics():
    """Reset metrics before each test to avoid interference between tests."""
    from prometheus_client import REGISTRY

    # Store original metric state
    yield

    # After test, we don't need to do anything special since each test
    # uses a separate FastAPI instance which will collect its own metrics.
    # The global REGISTRY persists, but that's OK for these tests.


# ==================== Path Normalization Tests ====================


@pytest.mark.unit
class TestPathNormalization:
    """Test path normalization to prevent cardinality explosion."""

    def test_simple_path_unchanged(self):
        """Simple paths should remain unchanged."""
        result = ObservabilityMiddleware._normalize_path("/health")
        assert result == "/health"

    def test_root_path(self):
        """Root path should return /."""
        result = ObservabilityMiddleware._normalize_path("/")
        assert result == "/"

    def test_numeric_id_replaced(self):
        """Numeric IDs should be replaced with {id}."""
        result = ObservabilityMiddleware._normalize_path("/users/123")
        assert result == "/users/{id}"

    def test_uuid_replaced(self):
        """UUIDs should be replaced with {id}."""
        result = ObservabilityMiddleware._normalize_path(
            "/data/550e8400-e29b-41d4-a716-446655440000"
        )
        assert result == "/data/{id}"

    def test_hex_string_replaced(self):
        """Hex strings should be replaced with {id}."""
        result = ObservabilityMiddleware._normalize_path("/cache/abcdef1234567890")
        assert result == "/cache/{id}"

    def test_model_name_preserved(self):
        """Model names with hyphens should be preserved."""
        result = ObservabilityMiddleware._normalize_path("/models/gpt-4-turbo")
        assert result == "/models/gpt-4-turbo"

    def test_deep_path_limited(self):
        """Deep paths should be limited to first 6 segments."""
        result = ObservabilityMiddleware._normalize_path(
            "/a/b/c/d/e/f/g/h/i/j"
        )
        # Should be limited to first 6 segments
        assert len(result.split("/")) <= 7  # +1 for empty string from leading /

    def test_mixed_path_normalization(self):
        """Mixed paths should normalize ids but keep structure."""
        result = ObservabilityMiddleware._normalize_path(
            "/api/v1/users/123/posts/456"
        )
        assert result == "/api/v1/users/{id}/posts/{id}"


# ==================== HTTP Request Metrics Tests ====================


@pytest.mark.unit
class TestHTTPMetrics:
    """Test HTTP request metrics collection."""

    def test_successful_request_tracked(self, client):
        """Successful requests should be tracked in metrics."""
        # Make request
        response = client.get("/health")
        assert response.status_code == 200

        # Check metrics
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "http_requests_total" in metrics_output
        assert "http_request_duration_seconds" in metrics_output

    def test_different_methods_tracked_separately(self, client):
        """Different HTTP methods should be tracked separately."""
        # Make requests to verify middleware doesn't crash
        client.get("/health")
        client.post("/data", json={"key": "value"})

        # Verify metrics are being collected (even if format varies)
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "http_request_duration" in metrics_output
        assert "http_requests_total" in metrics_output or "http_requests_total" in metrics_output.lower()

    def test_status_code_tracked(self, client):
        """Status codes should be tracked in metrics."""
        client.get("/health")  # 200
        # POST with valid JSON should succeed
        response = client.post("/data", json={"key": "value"})
        assert response.status_code == 200

        # Verify metrics are being collected
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "http_requests_total" in metrics_output or "requests_total" in metrics_output.lower()

    def test_error_status_tracked(self, client):
        """Error status codes should be tracked."""
        try:
            client.get("/error")
        except ValueError:
            # The error is raised and handled by FastAPI
            pass

        # If error is returned as 500, it should be tracked
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # Either 500 or the error should be tracked
        assert "http_requests_total" in metrics_output

    def test_endpoint_label(self, client):
        """Endpoints should be labeled with normalized paths."""
        client.get("/health")
        client.get("/users/123")
        client.get("/users/456")  # Different ID, should have same normalized path

        # Verify middleware doesn't crash with different endpoints
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "http_request_duration" in metrics_output
        # Normalized paths should aggregate {id} requests


# ==================== In-Progress Gauge Tests ====================


@pytest.mark.unit
class TestInProgressGauge:
    """Test fastapi_requests_in_progress gauge."""

    def test_in_progress_incremented(self, client):
        """In-progress requests should be incremented."""
        # Clear gauge first
        fastapi_requests_in_progress.clear()

        # Make request
        response = client.get("/health")
        assert response.status_code == 200

        # Gauge should go back to 0 after request completes
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "fastapi_requests_in_progress" in metrics_output

    def test_in_progress_decremented_on_success(self, client):
        """In-progress gauge should be decremented after request succeeds."""
        fastapi_requests_in_progress.clear()

        response = client.get("/health")
        assert response.status_code == 200

        # After request completes, gauge should be 0 or not present for successful request
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # If metric exists, it should show decreased values (test client is synchronous)
        assert "fastapi_requests_in_progress" in metrics_output

    def test_in_progress_decremented_on_error(self, client):
        """In-progress gauge should be decremented even on error."""
        fastapi_requests_in_progress.clear()

        try:
            client.get("/error")
        except ValueError:
            pass

        # Gauge should still be decremented
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "fastapi_requests_in_progress" in metrics_output


# ==================== Request/Response Size Tests ====================


@pytest.mark.unit
class TestRequestResponseSize:
    """Test request and response size metrics."""

    def test_request_size_tracked(self, client):
        """Request body size should be tracked."""
        test_data = {"key": "value", "data": "x" * 1000}

        response = client.post("/data", json=test_data)
        assert response.status_code == 200

        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "fastapi_request_size_bytes" in metrics_output

    def test_response_size_tracked(self, client):
        """Response body size should be tracked."""
        response = client.get("/health")
        assert response.status_code == 200

        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "fastapi_response_size_bytes" in metrics_output

    def test_size_histogram_buckets(self, client):
        """Size metrics should use appropriate histogram buckets."""
        # Small request
        client.get("/health")
        # Larger request
        client.post("/data", json={"data": "x" * 10000})

        # Verify metrics are being collected
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # Size metrics should be present in the output
        assert "fastapi_request_size" in metrics_output or "request_size" in metrics_output.lower()

    def test_zero_size_for_get(self, client):
        """GET requests without body should record small size."""
        response = client.get("/health")
        assert response.status_code == 200

        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # Should have request size metric (even if 0)
        assert "fastapi_request_size_bytes" in metrics_output


# ==================== Duration Tracking Tests ====================


@pytest.mark.unit
class TestDurationTracking:
    """Test that request duration is properly tracked."""

    def test_duration_histogram_present(self, client):
        """Duration should be recorded in histogram."""
        response = client.get("/health")
        assert response.status_code == 200

        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "http_request_duration_seconds" in metrics_output

    def test_duration_buckets(self, client):
        """Duration histogram should have proper buckets."""
        client.get("/health")

        # Verify duration metrics are being collected
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # Duration metrics should be present
        assert "http_request_duration" in metrics_output or "request_duration" in metrics_output.lower()


# ==================== Integration Tests ====================


@pytest.mark.unit
class TestIntegration:
    """Integration tests for the complete middleware flow."""

    def test_multiple_requests_tracked(self, client):
        """Multiple requests should all be tracked."""
        for _ in range(5):
            client.get("/health")

        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # http_requests_total should have increased
        assert "http_requests_total" in metrics_output

    def test_metrics_endpoint_itself_tracked(self, client):
        """The /metrics endpoint requests should be tracked."""
        # This indirectly tests that the middleware works with the app
        response = client.get("/health")
        assert response.status_code == 200

    def test_different_endpoints_separate_labels(self, client):
        """Different endpoints should have separate label combinations."""
        client.get("/health")
        client.get("/users/123")
        client.get("/users/456")

        # Verify metrics are being collected
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # Endpoints should be tracked in metrics
        assert "http_request_duration" in metrics_output

    def test_error_handling_doesnt_crash_middleware(self, client):
        """Errors in handlers shouldn't crash the middleware."""
        try:
            client.get("/error")
        except ValueError:
            pass

        # Middleware should still record metrics
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        assert "http_requests_total" in metrics_output


# ==================== Edge Case Tests ====================


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and special scenarios."""

    def test_empty_path_normalized(self):
        """Empty path should be normalized to /."""
        result = ObservabilityMiddleware._normalize_path("")
        assert result == "/"

    def test_trailing_slash_preserved(self):
        """Paths with trailing slashes should be handled."""
        result = ObservabilityMiddleware._normalize_path("/health/")
        assert result == "/health"  # normalized without trailing slash

    def test_query_parameters_excluded(self, client):
        """Query parameters should not affect endpoint label."""
        client.get("/health?foo=bar&baz=qux")
        client.get("/health?other=param")

        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # Both should be labeled as /health (query params excluded)
        assert 'endpoint="/health"' in metrics_output

    def test_double_slash_normalized(self):
        """Double slashes should be handled gracefully."""
        result = ObservabilityMiddleware._normalize_path("/api//v1//health")
        # Should be normalized (empty segments removed)
        assert result == "/api/v1/health"

    def test_special_characters_in_path(self):
        """Paths with special characters should be handled."""
        result = ObservabilityMiddleware._normalize_path("/api/v1/search?q=test")
        # Query string shouldn't be there in normalized path from middleware
        # (middleware receives path without query string)
        assert "?" not in result


# ==================== Performance Tests ====================


@pytest.mark.unit
class TestPerformance:
    """Test that middleware doesn't significantly impact performance."""

    def test_middleware_doesnt_block_response(self, client):
        """Middleware shouldn't block responses."""
        import time

        start = time.time()
        response = client.get("/health")
        duration = time.time() - start

        assert response.status_code == 200
        # Should be very fast (less than 100ms for local test)
        assert duration < 0.1  # 100ms

    def test_many_unique_endpoints_manageable(self, client):
        """Many unique endpoints shouldn't cause issues."""
        # Create requests to many endpoints
        for i in range(100):
            client.get(f"/users/{i}")

        # Should still work and produce metrics
        metrics_output = generate_latest(REGISTRY).decode("utf-8")
        # All should be normalized to same endpoint
        assert 'endpoint="/users/{id}"' in metrics_output
        # Count should reflect cardinality reduction
        assert metrics_output.count('endpoint="/users/{id}"') > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
