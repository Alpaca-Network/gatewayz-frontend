"""
FastAPI middleware for automatic observability instrumentation.

This middleware automatically tracks HTTP request metrics for all endpoints
without requiring manual instrumentation. It exposes metrics compatible with
the Grafana FastAPI Observability Dashboard (ID: 16110).

Metrics exposed:
- fastapi_requests_in_progress: Gauge of concurrent requests by method and endpoint
- fastapi_request_size_bytes: Histogram of request body sizes by method and endpoint
- fastapi_response_size_bytes: Histogram of response body sizes by method and endpoint
- http_requests_total: Counter of total requests by method, endpoint, and status code
- http_request_duration_seconds: Histogram of request duration by method and endpoint
"""

import logging
import time
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from src.services.prometheus_metrics import (
    http_request_duration,
    fastapi_requests_duration_seconds,
    record_http_response,
    fastapi_requests_in_progress,
    fastapi_request_size_bytes,
    fastapi_response_size_bytes,
    APP_NAME,
)

logger = logging.getLogger(__name__)


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """
    Middleware for automatic request/response observability.

    Automatically tracks:
    - Request duration and size
    - Response size and status code
    - Concurrent request count
    - All metrics with method and endpoint labels

    This middleware should be added early in the middleware stack to capture
    accurate timing for all requests.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and track observability metrics.

        Args:
            request: The incoming HTTP request
            call_next: The next middleware/handler in the chain

        Returns:
            The HTTP response from downstream handlers
        """
        # Extract method and path
        method = request.method
        path = request.url.path

        # Normalize path for metrics (group dynamic segments)
        endpoint = self._normalize_path(path)

        # Track request body size using Content-Length header
        # We use the header instead of reading the body to avoid consuming the stream,
        # which would prevent downstream handlers from accessing the request body
        try:
            request_content_length = request.headers.get("content-length")
            request_size = int(request_content_length) if request_content_length else 0
            fastapi_request_size_bytes.labels(
                app_name=APP_NAME, method=method, path=endpoint
            ).observe(request_size)
        except (ValueError, TypeError) as e:
            logger.debug(f"Could not determine request size from headers: {e}")
            request_size = 0

        # Increment in-progress requests gauge
        fastapi_requests_in_progress.labels(
            app_name=APP_NAME, method=method, path=endpoint
        ).inc()

        # Record start time
        start_time = time.time()

        try:
            # Call the next middleware/handler
            response = await call_next(request)

            # Track response body size from Content-Length header if available
            try:
                # Try to get content length from response headers
                response_content_length = response.headers.get("content-length")
                if response_content_length:
                    response_size = int(response_content_length)
                else:
                    # For responses with a body_iterator (streaming responses),
                    # we can only estimate size as 0 since we can't measure it
                    if hasattr(response, "body_iterator"):
                        response_size = 0
                    else:
                        # Fallback: try to get body size if directly accessible
                        response_size = len(response.body) if hasattr(response, "body") else 0

                fastapi_response_size_bytes.labels(
                    app_name=APP_NAME, method=method, path=endpoint
                ).observe(response_size)
            except (ValueError, TypeError, AttributeError) as e:
                logger.debug(f"Could not determine response size: {e}")
                # Record 0 if we can't determine size
                fastapi_response_size_bytes.labels(
                    app_name=APP_NAME, method=method, path=endpoint
                ).observe(0)

            # Record metrics
            duration = time.time() - start_time
            status_code = response.status_code

            # Record HTTP metrics (both new and legacy)
            fastapi_requests_duration_seconds.labels(
                app_name=APP_NAME, method=method, path=endpoint
            ).observe(duration)
            http_request_duration.labels(method=method, endpoint=endpoint).observe(
                duration
            )
            record_http_response(
                method=method, endpoint=endpoint, status_code=status_code, app_name=APP_NAME
            )

            return response

        except Exception as e:  # noqa: BLE001 - Broad exception catch needed for metrics
            # Record error metrics for any unhandled exception
            logger.error(f"Error processing request {method} {endpoint}: {e}")
            duration = time.time() - start_time

            # Record error response with 500 status
            fastapi_requests_duration_seconds.labels(
                app_name=APP_NAME, method=method, path=endpoint
            ).observe(duration)
            http_request_duration.labels(method=method, endpoint=endpoint).observe(
                duration
            )
            record_http_response(
                method=method, endpoint=endpoint, status_code=500, app_name=APP_NAME
            )

            # Re-raise the exception to be handled by FastAPI exception handlers
            raise

        finally:
            # Always decrement in-progress requests gauge
            fastapi_requests_in_progress.labels(
                app_name=APP_NAME, method=method, path=endpoint
            ).dec()

    @staticmethod
    def _normalize_path(path: str) -> str:
        """
        Normalize URL path for metrics labeling.

        This prevents high cardinality metrics by grouping dynamic path segments.
        For example:
        - /v1/chat/completions -> /v1/chat/completions
        - /users/123 -> /users/{id}
        - /api/models/gpt-4 -> /api/models/{name}

        Args:
            path: The URL path to normalize

        Returns:
            Normalized path suitable for metric labels
        """
        if not path:
            return "/"

        parts = path.split("/")
        normalized_parts = []

        for part in parts:
            if not part:  # Skip empty parts from leading/trailing slashes
                continue

            # Remove query string from path segment if present
            # (middleware receives path without query string, but just in case)
            part = part.split("?")[0] if "?" in part else part

            # Check if this looks like a numeric ID (all digits)
            if part.isdigit():
                # Replace numeric segments with {id}
                normalized_parts.append("{id}")
            # Check if this looks like a UUID (36 chars: 8-4-4-4-12 hex with hyphens)
            elif len(part) == 36 and all(c in "0123456789abcdef-" for c in part.lower()):
                # UUID format detected, replace with {id}
                normalized_parts.append("{id}")
            # Check if this looks like a hex string ID (hex characters without hyphens)
            # This includes hash-like IDs but must be reasonably long
            elif len(part) > 8 and all(c in "0123456789abcdef" for c in part.lower()):
                # Replace hex ID segments with {id}
                normalized_parts.append("{id}")
            # Check if it looks like a model name or similar (contains hyphens but not all digits)
            elif "-" in part and not part.isdigit():
                # Likely a model name or identifier, keep as is
                # e.g., "gpt-4-turbo" -> "gpt-4-turbo"
                normalized_parts.append(part)
            else:
                # Keep regular path segments
                normalized_parts.append(part)

        # Limit path length to prevent unbounded cardinality
        # Take first 6 segments max (typical API paths won't exceed this)
        # For extremely deep paths (>6 segments), this provides cardinality protection
        normalized_parts = normalized_parts[:6]

        return "/" + "/".join(normalized_parts)
