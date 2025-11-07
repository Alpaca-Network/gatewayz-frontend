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
import time
from contextlib import contextmanager
from typing import Optional

from prometheus_client import Counter, Gauge, Histogram, Summary

logger = logging.getLogger(__name__)

# ==================== HTTP Request Metrics ====================
http_request_count = Counter(
    "http_requests_total",
    "Total HTTP requests by method, endpoint and status code",
    ["method", "endpoint", "status_code"],
)

http_request_duration = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds by method and endpoint",
    ["method", "endpoint"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)

# Additional metrics for Grafana FastAPI Observability Dashboard compatibility
# These are exposed by the observability middleware
fastapi_requests_in_progress = Gauge(
    "fastapi_requests_in_progress",
    "Number of HTTP requests currently being processed",
    ["method", "endpoint"],
)

fastapi_request_size_bytes = Histogram(
    "fastapi_request_size_bytes",
    "HTTP request body size in bytes",
    ["method", "endpoint"],
    buckets=(100, 1000, 10000, 100000, 1000000),
)

fastapi_response_size_bytes = Histogram(
    "fastapi_response_size_bytes",
    "HTTP response body size in bytes",
    ["method", "endpoint"],
    buckets=(100, 1000, 10000, 100000, 1000000),
)

# ==================== Model Inference Metrics ====================
model_inference_requests = Counter(
    "model_inference_requests_total",
    "Total model inference requests",
    ["provider", "model", "status"],
)

model_inference_duration = Histogram(
    "model_inference_duration_seconds",
    "Model inference duration in seconds",
    ["provider", "model"],
    buckets=(0.1, 0.5, 1, 2.5, 5, 10, 25, 60),
)

tokens_used = Counter(
    "tokens_used_total",
    "Total tokens used (input + output)",
    ["provider", "model", "token_type"],
)

credits_used = Counter(
    "credits_used_total",
    "Total credits consumed",
    ["provider", "model"],
)

# ==================== Database Metrics ====================
database_query_count = Counter(
    "database_queries_total",
    "Total database queries",
    ["table", "operation"],
)

database_query_duration = Summary(
    "database_query_duration_seconds",
    "Database query duration in seconds",
    ["table"],
)

# ==================== Cache Metrics ====================
cache_hits = Counter(
    "cache_hits_total",
    "Total cache hits",
    ["cache_name"],
)

cache_misses = Counter(
    "cache_misses_total",
    "Total cache misses",
    ["cache_name"],
)

cache_size = Gauge(
    "cache_size_bytes",
    "Cache size in bytes",
    ["cache_name"],
)

# ==================== Rate Limiting Metrics ====================
rate_limited_requests = Counter(
    "rate_limited_requests_total",
    "Total rate-limited requests",
    ["limit_type"],
)

current_rate_limit = Gauge(
    "current_rate_limit",
    "Current rate limit status",
    ["limit_type"],
)

# ==================== Provider Health Metrics ====================
provider_availability = Gauge(
    "provider_availability",
    "Provider availability status (1=available, 0=unavailable)",
    ["provider"],
)

provider_error_rate = Gauge(
    "provider_error_rate",
    "Provider error rate (0-1)",
    ["provider"],
)

provider_response_time = Histogram(
    "provider_response_time_seconds",
    "Provider response time in seconds",
    ["provider"],
    buckets=(0.1, 0.5, 1, 2.5, 5, 10),
)

# ==================== Authentication & API Key Metrics ====================
api_key_usage = Counter(
    "api_key_usage_total",
    "Total API key usage",
    ["status"],
)

active_api_keys = Gauge(
    "active_api_keys",
    "Number of active API keys",
    ["status"],
)

# ==================== Business Metrics ====================
user_credit_balance = Gauge(
    "user_credit_balance",
    "Total user credit balance aggregated by plan type",
    ["plan_type"],
)

trial_status = Gauge(
    "trial_active",
    "Active trials count",
    ["status"],
)

subscription_count = Gauge(
    "subscription_count",
    "Active subscriptions",
    ["plan_type", "billing_cycle"],
)

# ==================== System Metrics ====================
active_connections = Gauge(
    "active_connections",
    "Number of active connections",
    ["connection_type"],
)

queue_size = Gauge(
    "queue_size",
    "Queue size for prioritization",
    ["queue_name"],
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


def record_http_response(method: str, endpoint: str, status_code: int):
    """Record HTTP response metrics."""
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
