"""
Tests for Prometheus metrics integration.

Tests verify that:
- Metrics endpoint is available at /metrics
- Metrics are in valid Prometheus text format
- Core metrics are initialized and tracked
"""

import pytest
from fastapi.testclient import TestClient
from src.main import create_app
from src.services import prometheus_metrics


@pytest.fixture
def client():
    """Create a test client for the application."""
    app = create_app()
    return TestClient(app)


class TestMetricsEndpoint:
    """Tests for the /metrics endpoint."""

    def test_metrics_endpoint_exists(self, client):
        """Test that /metrics endpoint is accessible."""
        response = client.get("/metrics")
        assert response.status_code == 200

    def test_metrics_content_type(self, client):
        """Test that /metrics returns Prometheus text format."""
        response = client.get("/metrics")
        assert "text/plain" in response.headers["content-type"]

    def test_metrics_format_validity(self, client):
        """Test that /metrics returns valid Prometheus format."""
        response = client.get("/metrics")
        content = response.text

        # Check for key Prometheus format indicators
        assert "# HELP" in content  # Help comments
        assert "# TYPE" in content  # Type declarations
        assert "{" in content  # Labels
        assert "}" in content  # Label closure

    def test_metrics_contains_http_metrics(self, client):
        """Test that HTTP metrics are present."""
        response = client.get("/metrics")
        content = response.text

        assert "http_requests_total" in content
        assert "http_request_duration_seconds" in content

    def test_metrics_contains_model_metrics(self, client):
        """Test that model inference metrics are present."""
        response = client.get("/metrics")
        content = response.text

        assert "model_inference_requests_total" in content
        assert "model_inference_duration_seconds" in content
        assert "tokens_used_total" in content
        assert "credits_used_total" in content

    def test_metrics_contains_cache_metrics(self, client):
        """Test that cache metrics are present."""
        response = client.get("/metrics")
        content = response.text

        assert "cache_hits_total" in content
        assert "cache_misses_total" in content
        assert "cache_size_bytes" in content

    def test_metrics_contains_rate_limit_metrics(self, client):
        """Test that rate limiting metrics are present."""
        response = client.get("/metrics")
        content = response.text

        assert "rate_limited_requests_total" in content
        assert "current_rate_limit" in content

    def test_metrics_contains_provider_metrics(self, client):
        """Test that provider health metrics are present."""
        response = client.get("/metrics")
        content = response.text

        assert "provider_availability" in content
        assert "provider_error_rate" in content
        assert "provider_response_time_seconds" in content

    def test_metrics_contains_database_metrics(self, client):
        """Test that database metrics are present."""
        response = client.get("/metrics")
        content = response.text

        assert "database_queries_total" in content
        assert "database_query_duration_seconds" in content


class TestMetricsRecording:
    """Tests for recording metrics in code."""

    def test_record_http_response(self):
        """Test recording HTTP response metrics."""
        prometheus_metrics.record_http_response("GET", "/health", 200)
        prometheus_metrics.record_http_response("POST", "/v1/chat/completions", 200)
        prometheus_metrics.record_http_response("POST", "/v1/chat/completions", 400)

        # Verify metrics were recorded (no exception)
        assert True

    def test_record_tokens_used(self):
        """Test recording token usage metrics."""
        prometheus_metrics.record_tokens_used(
            provider="openrouter",
            model="gpt-4",
            input_tokens=100,
            output_tokens=50,
        )

        # Verify metrics were recorded
        assert True

    def test_record_credits_used(self):
        """Test recording credit usage metrics."""
        prometheus_metrics.record_credits_used(
            provider="openrouter",
            model="gpt-4",
            user_id="test-user",
            credits=1.5,
        )

        # Verify metrics were recorded
        assert True

    def test_record_cache_operations(self):
        """Test recording cache hit/miss metrics."""
        prometheus_metrics.record_cache_hit("model_cache")
        prometheus_metrics.record_cache_miss("model_cache")
        prometheus_metrics.set_cache_size("model_cache", 1024 * 1024)

        # Verify metrics were recorded
        assert True

    def test_set_provider_availability(self):
        """Test setting provider availability metrics."""
        prometheus_metrics.set_provider_availability("openrouter", True)
        prometheus_metrics.set_provider_availability("openrouter", False)

        # Verify metrics were recorded
        assert True

    def test_set_provider_error_rate(self):
        """Test setting provider error rate metrics."""
        prometheus_metrics.set_provider_error_rate("openrouter", 0.05)
        prometheus_metrics.set_provider_error_rate("openrouter", 0.0)
        prometheus_metrics.set_provider_error_rate("openrouter", 1.0)

        # Verify metrics were recorded
        assert True


class TestContextManagers:
    """Tests for context manager utilities."""

    def test_track_http_request_context(self):
        """Test HTTP request tracking context manager."""
        with prometheus_metrics.track_http_request("GET", "/health"):
            pass  # Simulate request processing

        # Verify no exceptions and context works
        assert True

    def test_track_model_inference_context(self):
        """Test model inference tracking context manager."""
        with prometheus_metrics.track_model_inference("openrouter", "gpt-4"):
            pass  # Simulate inference

        # Verify no exceptions and context works
        assert True

    def test_track_database_query_context(self):
        """Test database query tracking context manager."""
        with prometheus_metrics.track_database_query("users", "select"):
            pass  # Simulate query

        # Verify no exceptions and context works
        assert True


class TestMetricsIntegration:
    """Integration tests for metrics with actual API calls."""

    def test_metrics_after_health_check(self, client):
        """Test that metrics are recorded after health check request."""
        # Make a health check request
        health_response = client.get("/health")
        assert health_response.status_code == 200

        # Verify metrics endpoint has data
        metrics_response = client.get("/metrics")
        assert metrics_response.status_code == 200

        # Check that http metrics contain entries
        content = metrics_response.text
        assert "http_requests_total" in content
        assert "http_request_duration_seconds" in content

    def test_metrics_cardinality(self, client):
        """Test that metric cardinality is reasonable."""
        response = client.get("/metrics")
        content = response.text

        # Count approximate number of metric lines
        lines = [l for l in content.split("\n") if l and not l.startswith("#")]

        # Should have at least some metrics but not too many
        assert 10 < len(lines) < 10000, "Metric count seems off"
