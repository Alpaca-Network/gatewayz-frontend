from __future__ import annotations

import asyncio
import logging
from typing import Dict, List, Optional

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)
# OpenAI Python SDK raises its own exception hierarchy which we need to
# translate into HTTP responses. Make these imports optional so the module
# still loads if the dependency is absent (e.g. in minimal test environments).
try:  # pragma: no cover - import guard
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
except ImportError:  # pragma: no cover - handled gracefully below
    APIConnectionError = APITimeoutError = APIStatusError = AuthenticationError = None
    BadRequestError = NotFoundError = OpenAIError = PermissionDeniedError = RateLimitError = None

FALLBACK_PROVIDER_PRIORITY: tuple[str, ...] = (
    "cerebras",
    "huggingface",
    "featherless",
    "vercel-ai-gateway",
    "aihubmix",
    "anannas",
    "alibaba-cloud",
    "fireworks",
    "together",
    "google-vertex",
    "openrouter",
)
FALLBACK_ELIGIBLE_PROVIDERS = set(FALLBACK_PROVIDER_PRIORITY)
FAILOVER_STATUS_CODES = {401, 403, 404, 502, 503, 504}


def build_provider_failover_chain(initial_provider: Optional[str]) -> List[str]:
    """Return the provider attempt order starting with the initial provider.

    Always includes all eligible providers in the failover chain.
    Provider availability checks happen at request time, not at chain building time.
    """
    provider = (initial_provider or "").lower()

    if provider not in FALLBACK_ELIGIBLE_PROVIDERS:
        return [provider] if provider else ["openrouter"]

    chain: List[str] = []
    if provider:
        chain.append(provider)

    for candidate in FALLBACK_PROVIDER_PRIORITY:
        if candidate not in chain:
            chain.append(candidate)

    # Always include openrouter as ultimate fallback if nothing else is available
    if not chain or (len(chain) == 1 and chain[0] == provider and provider != "openrouter"):
        if "openrouter" not in chain:
            chain.append("openrouter")

    return chain


def should_failover(http_exc: HTTPException) -> bool:
    """Return True if the raised HTTPException qualifies for a failover attempt."""
    return http_exc.status_code in FAILOVER_STATUS_CODES


def map_provider_error(
    provider: str,
    model: str,
    exc: Exception,
) -> HTTPException:
    """
    Map upstream exceptions to HTTPException responses.
    Keeps existing status/detail semantics while allowing centralized handling.
    """
    # Log all upstream errors for debugging
    logger.warning(
        f"Provider error: provider={provider}, model={model}, "
        f"error_type={type(exc).__name__}, error={str(exc)[:200]}"
    )

    if isinstance(exc, HTTPException):
        return exc

    if isinstance(exc, ValueError):
        error_msg = str(exc)
        # Check if this is a credential/authentication error that should trigger failover
        credential_keywords = [
            "access token",
            "credential",
            "authentication",
            "api key",
            "not configured",
            "id_token",
            "service account",
            "GOOGLE_APPLICATION_CREDENTIALS",
            "GOOGLE_VERTEX_CREDENTIALS_JSON",
        ]
        if any(keyword.lower() in error_msg.lower() for keyword in credential_keywords):
            # Map credential errors to 503 to trigger failover to alternative providers
            logger.info(
                f"Detected credential error for provider '{provider}': {error_msg[:200]}. "
                "This will trigger failover to alternative providers."
            )
            return HTTPException(
                status_code=503,
                detail=f"{provider} credentials not configured or invalid. Trying alternative providers.",
            )
        # Other ValueErrors are treated as bad requests
        return HTTPException(status_code=400, detail=str(exc))

    # OpenAI SDK exceptions (used for OpenRouter and other compatible providers)
    # Check APITimeoutError before APIConnectionError as it may be a subclass
    if APITimeoutError and isinstance(exc, APITimeoutError):
        return HTTPException(status_code=504, detail="Upstream timeout")

    if APIConnectionError and isinstance(exc, APIConnectionError):
        return HTTPException(status_code=503, detail="Upstream service unavailable")

    if APIStatusError and isinstance(exc, APIStatusError):
        status = getattr(exc, "status_code", None)
        try:
            status = int(status)
        except (TypeError, ValueError):
            status = 500
        detail = "Upstream error"
        headers: Optional[Dict[str, str]] = None

        if RateLimitError and isinstance(exc, RateLimitError):
            retry_after = None
            if getattr(exc, "response", None):
                retry_after = exc.response.headers.get("retry-after")
            if retry_after is None and isinstance(getattr(exc, "body", None), dict):
                retry_after = exc.body.get("retry_after")
            if retry_after:
                headers = {"Retry-After": str(retry_after)}
            return HTTPException(
                status_code=429, detail="Upstream rate limit exceeded", headers=headers
            )

        auth_error_classes = tuple(
            err for err in (AuthenticationError, PermissionDeniedError) if err is not None
        )
        if auth_error_classes and isinstance(exc, auth_error_classes):
            detail = f"{provider} authentication error"
            # Always map auth errors to 401 for consistency
            status = 401
        elif NotFoundError and isinstance(exc, NotFoundError):
            detail = f"Model {model} not found or unavailable on {provider}"
            status = 404
        elif BadRequestError and isinstance(exc, BadRequestError):
            # Extract actual error message from BadRequestError
            error_msg = getattr(exc, "message", None) or str(exc)
            try:
                # Try to get response body if available
                if hasattr(exc, "response") and exc.response:
                    response_text = getattr(exc.response, "text", None)
                    if response_text:
                        error_msg = f"{error_msg} | Response: {response_text[:200]}"
            except Exception:
                pass
            detail = f"Provider '{provider}' rejected request for model '{model}': {error_msg}"
            status = 400
        elif status == 403:
            detail = f"{provider} authentication error"
        elif status == 404:
            detail = f"Model {model} not found or unavailable on {provider}"
        elif 500 <= status < 600:
            detail = "Upstream service error"

        # Fall back to message body if we still have the generic detail
        if detail == "Upstream error":
            detail = getattr(exc, "message", None) or str(exc)

        return HTTPException(status_code=status, detail=detail, headers=headers)

    if OpenAIError and isinstance(exc, OpenAIError):
        return HTTPException(status_code=502, detail=str(exc))

    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
        return HTTPException(status_code=504, detail="Upstream timeout")

    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        retry_after = exc.response.headers.get("retry-after")

        if status == 429:
            headers = {"Retry-After": retry_after} if retry_after else None
            return HTTPException(
                status_code=429, detail="Upstream rate limit exceeded", headers=headers
            )
        if status in (401, 403):
            return HTTPException(status_code=500, detail=f"{provider} authentication error")
        if status == 404:
            return HTTPException(
                status_code=404,
                detail=f"Model {model} not found or unavailable on {provider}",
            )
        if 400 <= status < 500:
            # Extract error details from response
            error_detail = (
                f"Provider '{provider}' rejected request for model '{model}' (HTTP {status})"
            )
            try:
                response_body = exc.response.text[:500] if exc.response.text else "No response body"
                error_detail += f" | Response: {response_body}"
            except Exception:
                pass
            return HTTPException(status_code=400, detail=error_detail)
        return HTTPException(status_code=502, detail="Upstream service error")

    if isinstance(exc, httpx.RequestError):
        return HTTPException(status_code=503, detail="Upstream service unavailable")

    return HTTPException(status_code=502, detail="Upstream error")
