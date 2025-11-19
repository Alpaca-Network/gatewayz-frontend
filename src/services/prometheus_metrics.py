"""
Prometheus metrics collection and management for Gatewayz API Gateway.

This module initializes and exposes Prometheus metrics for monitoring:
- HTTP request metrics (count, duration, status codes)
- Model inference metrics (requests, tokens, latency by provider/model)
- Database metrics (queries, latency)
- Cache metrics (hits, misses, operations)
- Rate limiting metrics (blocked requests, current limits)
- Provider health metrics (availability, error rates)
- Business metrics (credits used, token consumption)
"""

import logging
import os
import time
from contextlib import contextmanager
from typing import Optional

from prometheus_client import Counter, Gauge, Histogram, Summary, Info, REGISTRY

logger = logging.getLogger(__name__)

# Get app name from environment or use default
APP_NAME = os.environ.get("APP_NAME", "gatewayz")

# Clear any existing metrics from the registry to avoid duplication issues
# This is necessary because Prometheus uses a global registry that persists across imports
try:
    collectors = list(REGISTRY._collector_to_names.keys())
    for collector in collectors:
        try:
            REGISTRY.unregister(collector)
        except Exception:
            pass  # Ignore errors from default collectors
    logger.debug("Cleared Prometheus registry")
except Exception as e:
    logger.warning(f"Could not clear Prometheus registry: {e}")

# Helper function to handle metric registration with --reload support
def get_or_create_metric(metric_class, name, *args, **kwargs):
    """
    Get existing metric or create new one.
    Handles duplicate registration errors when using uvicorn --reload
    """
    # IMPORTANT: Check for existing metric FIRST (before trying to create)
    # This prevents duplication errors during reload
    for collector in list(REGISTRY._collector_to_names.keys()):
        if hasattr(collector, '_name') and collector._name == name:
            logger.debug(f"Reusing existing metric: {name}")
            return collector

    # Metric doesn't exist, create it
    try:
        return metric_class(name, *args, **kwargs)
    except ValueError as e:
        # This shouldn't happen now that we check first, but keep as safety
        logger.warning(f"Unexpected duplicate metric error for {name}: {e}")
        raise

# ==================== Application Info ====================
# This metric helps Grafana dashboard populate the app_name variable dropdown
fastapi_app_info = get_or_create_metric(
    Info,
    "fastapi_app_info",
    "FastAPI application information"
)
# Set the app_name label value after creation (idempotent operation)
try:
    fastapi_app_info.info({"app_name": APP_NAME})
except Exception:
    pass  # Already set

# ==================== HTTP Request Metrics (Grafana Dashboard Compatible) ====================
# These metrics are compatible with Grafana FastAPI Observability Dashboard (ID: 16110)
fastapi_requests_total = get_or_create_metric(
    Counter,
    "fastapi_requests_total",
    "Total FastAPI requests",
    ["app_name", "method", "path", "status_code"],
)

fastapi_requests_duration_seconds = get_or_create_metric(Histogram,
    "fastapi_requests_duration_seconds",
    "FastAPI request duration in seconds",
    ["app_name", "method", "path"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)

fastapi_requests_in_progress = get_or_create_metric(Gauge,
    "fastapi_requests_in_progress",
    "Number of HTTP requests currently being processed",
    ["app_name", "method", "path"],
)

# Legacy metrics for backward compatibility
http_request_count = get_or_create_metric(Counter,
    "http_requests_total",
    "Total HTTP requests by method, endpoint and status code",
    ["method", "endpoint", "status_code"],
)

http_request_duration = get_or_create_metric(Histogram,
    "http_request_duration_seconds",
    "HTTP request duration in seconds by method and endpoint",
    ["method", "endpoint"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)

# Additional metrics for request/response size tracking
fastapi_request_size_bytes = get_or_create_metric(Histogram,
    "fastapi_request_size_bytes",
    "HTTP request body size in bytes",
    ["app_name", "method", "path"],
    buckets=(100, 1000, 10000, 100000, 1000000),
)

fastapi_response_size_bytes = get_or_create_metric(Histogram,
    "fastapi_response_size_bytes",
    "HTTP response body size in bytes",
    ["app_name", "method", "path"],
    buckets=(100, 1000, 10000, 100000, 1000000),
)

# Exception tracking for Grafana dashboard
fastapi_exceptions_total = get_or_create_metric(Counter,
    "fastapi_exceptions_total",
    "Total FastAPI exceptions",
    ["app_name", "exception_type"],
)

# ==================== Model Inference Metrics ====================
model_inference_requests = get_or_create_metric(Counter,
    "model_inference_requests_total",
    "Total model inference requests",
    ["provider", "model", "status"],
)

model_inference_duration = get_or_create_metric(Histogram,
    "model_inference_duration_seconds",
    "Model inference duration in seconds",
    ["provider", "model"],
    buckets=(0.1, 0.5, 1, 2.5, 5, 10, 25, 60),
)

tokens_used = get_or_create_metric(Counter,
    "tokens_used_total",
    "Total tokens used (input + output)",
    ["provider", "model", "token_type"],
)

credits_used = get_or_create_metric(Counter,
    "credits_used_total",
    "Total credits consumed",
    ["provider", "model"],
)

# ==================== Database Metrics ====================
database_query_count = get_or_create_metric(Counter,
    "database_queries_total",
    "Total database queries",
    ["table", "operation"],
)

database_query_duration = get_or_create_metric(Summary,
    "database_query_duration_seconds",
    "Database query duration in seconds",
    ["table"],
)

# ==================== Cache Metrics ====================
cache_hits = get_or_create_metric(Counter,
    "cache_hits_total",
    "Total cache hits",
    ["cache_name"],
)

cache_misses = get_or_create_metric(Counter,
    "cache_misses_total",
    "Total cache misses",
    ["cache_name"],
)

cache_size = get_or_create_metric(Gauge,
    "cache_size_bytes",
    "Cache size in bytes",
    ["cache_name"],
)

# ==================== Rate Limiting Metrics ====================
rate_limited_requests = get_or_create_metric(Counter,
    "rate_limited_requests_total",
    "Total rate-limited requests",
    ["limit_type"],
)

current_rate_limit = get_or_create_metric(Gauge,
    "current_rate_limit",
    "Current rate limit status",
    ["limit_type"],
)

# ==================== Provider Health Metrics ====================
provider_availability = get_or_create_metric(Gauge,
    "provider_availability",
    "Provider availability status (1=available, 0=unavailable)",
    ["provider"],
)

provider_error_rate = get_or_create_metric(Gauge,
    "provider_error_rate",
    "Provider error rate (0-1)",
    ["provider"],
)

provider_response_time = get_or_create_metric(Histogram,
    "provider_response_time_seconds",
    "Provider response time in seconds",
    ["provider"],
    buckets=(0.1, 0.5, 1, 2.5, 5, 10),
)

# ==================== Authentication & API Key Metrics ====================
api_key_usage = get_or_create_metric(Counter,
    "api_key_usage_total",
    "Total API key usage",
    ["status"],
)

active_api_keys = get_or_create_metric(Gauge,
    "active_api_keys",
    "Number of active API keys",
    ["status"],
)

# ==================== Business Metrics ====================
user_credit_balance = get_or_create_metric(Gauge,
    "user_credit_balance",
    "Total user credit balance aggregated by plan type",
    ["plan_type"],
)

trial_status = get_or_create_metric(Gauge,
    "trial_active",
    "Active trials count",
    ["status"],
)

subscription_count = get_or_create_metric(Gauge,
    "subscription_count",
    "Active subscriptions",
    ["plan_type", "billing_cycle"],
)

# ==================== System Metrics ====================
active_connections = get_or_create_metric(Gauge,
    "active_connections",
    "Number of active connections",
    ["connection_type"],
)

queue_size = get_or_create_metric(Gauge,
    "queue_size",
    "Queue size for prioritization",
    ["queue_name"],
)

# ==================== Performance Stage Metrics ====================
# Detailed stage breakdown metrics for performance profiling
backend_ttfb_seconds = get_or_create_metric(Histogram,
    "backend_ttfb_seconds",
    "Backend API time to first byte (TTFB) in seconds",
    ["provider", "model", "endpoint"],
    buckets=(0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 5.0, 10.0),
)

streaming_duration_seconds = get_or_create_metric(Histogram,
    "streaming_duration_seconds",
    "Time spent streaming response to client in seconds",
    ["provider", "model", "endpoint"],
    buckets=(0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 5.0, 10.0),
)

frontend_processing_seconds = get_or_create_metric(Histogram,
    "frontend_processing_seconds",
    "Frontend processing time (request parsing, auth, preparation) in seconds",
    ["endpoint"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5),
)

request_stage_duration_seconds = get_or_create_metric(Histogram,
    "request_stage_duration_seconds",
    "Duration of specific request processing stages in seconds",
    ["stage", "endpoint"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0),
)

# Stage breakdown percentages
stage_percentage = get_or_create_metric(Gauge,
    "stage_percentage",
    "Percentage of total request time spent in each stage",
    ["stage", "endpoint"],
)

# ==================== Context Managers & Helpers ====================


@contextmanager
def track_http_request(method: str, endpoint: str):
    """Context manager to track HTTP request metrics."""
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        http_request_duration.labels(method=method, endpoint=endpoint).observe(duration)


def record_http_response(method: str, endpoint: str, status_code: int, app_name: Optional[str] = None):
    """Record HTTP response metrics."""
    # Use provided app_name or fall back to environment variable
    app = app_name or APP_NAME

    # Record in new Grafana-compatible metrics
    fastapi_requests_total.labels(
        app_name=app, method=method, path=endpoint, status_code=status_code
    ).inc()

    # Also record in legacy metrics for backward compatibility
    http_request_count.labels(
        method=method, endpoint=endpoint, status_code=status_code
    ).inc()


@contextmanager
def track_model_inference(provider: str, model: str):
    """Context manager to track model inference metrics."""
    start_time = time.time()
    status = "success"
    try:
        yield
    except (Exception,):  # Intentionally catch all exceptions from yield block
        status = "error"
        logger.debug(f"Model inference completed with status: {status} for {provider}/{model}")
    finally:
        duration = time.time() - start_time
        model_inference_duration.labels(provider=provider, model=model).observe(
            duration
        )
        model_inference_requests.labels(
            provider=provider, model=model, status=status
        ).inc()


def record_tokens_used(
    provider: str, model: str, input_tokens: int, output_tokens: int
):
    """Record token consumption metrics."""
    tokens_used.labels(provider=provider, model=model, token_type="input").inc(
        input_tokens
    )
    tokens_used.labels(provider=provider, model=model, token_type="output").inc(
        output_tokens
    )


def record_credits_used(
    provider: str, model: str, user_id: str, credits: float
):
    """Record credit consumption metrics."""
    # Note: user_id parameter kept for backwards compatibility but not used in labels
    # (avoid exposing PII in metric labels)
    credits_used.labels(provider=provider, model=model).inc(credits)


@contextmanager
def track_database_query(table: str, operation: str):
    """Context manager to track database query metrics."""
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        database_query_count.labels(table=table, operation=operation).inc()
        database_query_duration.labels(table=table).observe(duration)


def record_cache_hit(cache_name: str):
    """Record cache hit metric."""
    cache_hits.labels(cache_name=cache_name).inc()


def record_cache_miss(cache_name: str):
    """Record cache miss metric."""
    cache_misses.labels(cache_name=cache_name).inc()


def set_cache_size(cache_name: str, size_bytes: int):
    """Set cache size metric."""
    cache_size.labels(cache_name=cache_name).set(size_bytes)


def record_rate_limited_request(api_key: str, limit_type: str):
    """Record rate-limited request metric."""
    # Note: api_key parameter kept for backwards compatibility but not used in labels
    # (avoid exposing PII in metric labels)
    rate_limited_requests.labels(limit_type=limit_type).inc()


def set_provider_availability(provider: str, available: bool):
    """Set provider availability metric."""
    provider_availability.labels(provider=provider).set(1 if available else 0)


def set_provider_error_rate(provider: str, error_rate: float):
    """Set provider error rate metric."""
    provider_error_rate.labels(provider=provider).set(min(1.0, max(0.0, error_rate)))


def track_provider_response_time(provider: str, duration: float):
    """Track provider response time."""
    provider_response_time.labels(provider=provider).observe(duration)


def record_api_key_usage(api_key_id: str, status: str = "success"):
    """Record API key usage."""
    # Note: api_key_id parameter kept for backwards compatibility but not used in labels
    # (avoid exposing PII in metric labels)
    api_key_usage.labels(status=status).inc()


def set_active_api_keys(status: str, count: int):
    """Set active API keys count."""
    active_api_keys.labels(status=status).set(count)


def set_user_credit_balance(user_id: str, plan_type: str, balance: float):
    """Set total user credit balance aggregated by plan type."""
    # Note: user_id parameter kept for backwards compatibility but not used in labels
    # This aggregates total credit balance by plan type (avoid exposing PII in metric labels)
    user_credit_balance.labels(plan_type=plan_type).set(balance)


def set_trial_count(status: str, count: int):
    """Set trial count by status."""
    trial_status.labels(status=status).set(count)


def set_subscription_count(plan_type: str, billing_cycle: str, count: int):
    """Set subscription count."""
    subscription_count.labels(
        plan_type=plan_type, billing_cycle=billing_cycle
    ).set(count)


def set_active_connections(connection_type: str, count: int):
    """Set active connections count."""
    active_connections.labels(connection_type=connection_type).set(count)


def set_queue_size(queue_name: str, size: int):
    """Set queue size."""
    queue_size.labels(queue_name=queue_name).set(size)


# ==================== Performance Stage Tracking Functions ====================

def track_backend_ttfb(provider: str, model: str, endpoint: str, duration: float):
    """Track backend API time to first byte (TTFB)."""
    backend_ttfb_seconds.labels(provider=provider, model=model, endpoint=endpoint).observe(
        duration
    )


def track_streaming_duration(provider: str, model: str, endpoint: str, duration: float):
    """Track streaming response duration."""
    streaming_duration_seconds.labels(provider=provider, model=model, endpoint=endpoint).observe(
        duration
    )


def track_frontend_processing(endpoint: str, duration: float):
    """Track frontend processing time (parsing, auth, preparation)."""
    frontend_processing_seconds.labels(endpoint=endpoint).observe(duration)


def track_request_stage(stage: str, endpoint: str, duration: float):
    """Track duration of a specific request processing stage.
    
    Stages:
    - request_parsing: Time to parse and validate request
    - auth_validation: Time to validate authentication
    - request_preparation: Time to prepare request for backend
    - backend_fetch: Time waiting for backend API response (TTFB)
    - stream_processing: Time spent streaming response to client
    """
    request_stage_duration_seconds.labels(stage=stage, endpoint=endpoint).observe(duration)


def record_stage_percentage(stage: str, endpoint: str, percentage: float):
    """Record percentage of total request time spent in a stage."""
    stage_percentage.labels(stage=stage, endpoint=endpoint).set(percentage)


def get_metrics_summary() -> dict:
    """Get a summary of key metrics for monitoring."""
    # This function returns a summary of metrics collected.
    # In production, use the /metrics endpoint which exports all metrics in Prometheus format.
    # This summary is for diagnostic purposes only.
    try:
        from prometheus_client import REGISTRY

        summary = {
            "enabled": True,
            "metrics_endpoint": "/metrics",
            "message": "Use /metrics endpoint for Prometheus format metrics"
        }
        return summary
    except Exception as e:
        logger.warning(f"Could not retrieve metrics summary: {type(e).__name__}")
        return {"enabled": False}
