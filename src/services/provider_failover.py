from __future__ import annotations

import asyncio
from typing import List

import httpx
from fastapi import HTTPException

FALLBACK_PROVIDER_PRIORITY: tuple[str, ...] = (
    "huggingface",
    "featherless",
    "fireworks",
    "together",
    "openrouter",
)
FALLBACK_ELIGIBLE_PROVIDERS = set(FALLBACK_PROVIDER_PRIORITY)
FAILOVER_STATUS_CODES = {404, 502, 503, 504}


def build_provider_failover_chain(initial_provider: str | None) -> List[str]:
    """Return the provider attempt order starting with the initial provider."""
    provider = (initial_provider or "").lower()

    if provider not in FALLBACK_ELIGIBLE_PROVIDERS:
        return [provider] if provider else ["openrouter"]

    chain: List[str] = []
    if provider:
        chain.append(provider)

    for candidate in FALLBACK_PROVIDER_PRIORITY:
        if candidate not in chain:
            chain.append(candidate)

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
    if isinstance(exc, HTTPException):
        return exc

    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))

    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
        return HTTPException(status_code=504, detail="Upstream timeout")

    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        retry_after = exc.response.headers.get("retry-after")

        if status == 429:
            headers = {"Retry-After": retry_after} if retry_after else None
            return HTTPException(status_code=429, detail="Upstream rate limit exceeded", headers=headers)
        if status in (401, 403):
            return HTTPException(status_code=500, detail=f"{provider} authentication error")
        if status == 404:
            return HTTPException(
                status_code=404,
                detail=f"Model {model} not found or unavailable on {provider}",
            )
        if 400 <= status < 500:
            return HTTPException(status_code=400, detail="Upstream rejected the request")
        return HTTPException(status_code=502, detail="Upstream service error")

    if isinstance(exc, httpx.RequestError):
        return HTTPException(status_code=503, detail="Upstream service unavailable")

    return HTTPException(status_code=502, detail="Upstream error")
