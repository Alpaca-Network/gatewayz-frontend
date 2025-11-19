"""
Utilities for converting rate limit results to HTTP headers
"""

from typing import Any, Dict, Optional


def get_rate_limit_headers(rate_limit_result: Any) -> Dict[str, str]:
    """Convert a RateLimitResult into HTTP headers for the response.

    Returns a dictionary of HTTP headers like:
    {
        "X-RateLimit-Limit-Requests": "250",
        "X-RateLimit-Remaining-Requests": "249",
        "X-RateLimit-Reset-Requests": "1700000000",
        "X-RateLimit-Limit-Tokens": "10000",
        "X-RateLimit-Remaining-Tokens": "9900",
        "X-RateLimit-Reset-Tokens": "1700000000",
        "X-RateLimit-Burst-Window": "100 per 60 seconds"
    }
    """
    headers = {}

    if not rate_limit_result:
        return headers

    # Safely get attributes with defaults
    limit_requests = getattr(rate_limit_result, "ratelimit_limit_requests", 0)
    if limit_requests > 0:
        headers["X-RateLimit-Limit-Requests"] = str(limit_requests)

    remaining_requests = getattr(rate_limit_result, "remaining_requests", -1)
    if remaining_requests >= 0:
        headers["X-RateLimit-Remaining-Requests"] = str(remaining_requests)

    reset_requests = getattr(rate_limit_result, "ratelimit_reset_requests", 0)
    if reset_requests > 0:
        headers["X-RateLimit-Reset-Requests"] = str(reset_requests)

    limit_tokens = getattr(rate_limit_result, "ratelimit_limit_tokens", 0)
    if limit_tokens > 0:
        headers["X-RateLimit-Limit-Tokens"] = str(limit_tokens)

    remaining_tokens = getattr(rate_limit_result, "remaining_tokens", -1)
    if remaining_tokens >= 0:
        headers["X-RateLimit-Remaining-Tokens"] = str(remaining_tokens)

    reset_tokens = getattr(rate_limit_result, "ratelimit_reset_tokens", 0)
    if reset_tokens > 0:
        headers["X-RateLimit-Reset-Tokens"] = str(reset_tokens)

    burst_window = getattr(rate_limit_result, "burst_window_description", "")
    if burst_window:
        headers["X-RateLimit-Burst-Window"] = burst_window

    return headers
