"""
Middleware for adding trace context to request logs.

This middleware enriches all request logs with OpenTelemetry trace and span IDs,
enabling seamless navigation from logs to traces in Grafana.
"""

import logging
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from src.config.opentelemetry_config import get_current_trace_id, get_current_span_id

logger = logging.getLogger(__name__)


class TraceContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds trace context to request logs.

    For each incoming request:
    1. Extracts the current trace ID and span ID from OpenTelemetry
    2. Logs the request with trace context for correlation
    3. Adds trace headers to the response

    This enables:
    - Clicking from logs to traces in Grafana
    - Distributed tracing across services
    - Request correlation in observability tools
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and add trace context to logs.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/handler in the chain

        Returns:
            HTTP response with trace headers
        """
        # Skip tracing for high-frequency non-critical endpoints (performance optimization)
        # This saves ~3-5ms per request for these endpoints
        path = request.url.path
        if path in ("/health", "/metrics", "/"):
            return await call_next(request)

        # Get trace context
        trace_id = get_current_trace_id()
        span_id = get_current_span_id()

        # Create log context with trace IDs
        log_extra = {
            "path": request.url.path,
            "method": request.method,
            "client_host": request.client.host if request.client else None,
        }

        if trace_id:
            log_extra["trace_id"] = trace_id
        if span_id:
            log_extra["span_id"] = span_id

        # Log request with trace context
        logger.info(
            f"{request.method} {request.url.path}",
            extra=log_extra
        )

        # Process request
        try:
            response = await call_next(request)

            # Add trace headers to response for client-side tracing
            if trace_id:
                response.headers["X-Trace-Id"] = trace_id
            if span_id:
                response.headers["X-Span-Id"] = span_id

            # Log response with trace context
            logger.info(
                f"{request.method} {request.url.path} - {response.status_code}",
                extra={
                    **log_extra,
                    "status_code": response.status_code,
                }
            )

            return response

        except Exception as e:
            # Log error with trace context
            logger.error(
                f"{request.method} {request.url.path} - Error: {str(e)}",
                extra=log_extra,
                exc_info=True
            )
            raise
