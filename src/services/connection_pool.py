"""
Connection pooling manager for model provider clients.

This module provides persistent HTTP client connections with connection pooling,
keepalive, and optimized timeout settings to improve chat streaming performance.
"""

import logging
from typing import Optional, Dict
import httpx
from openai import OpenAI, AsyncOpenAI
from threading import Lock

from src.config import Config

logger = logging.getLogger(__name__)

# Global connection pool instances
_client_pool: Dict[str, OpenAI] = {}
_async_client_pool: Dict[str, AsyncOpenAI] = {}
_pool_lock = Lock()

# Connection pool configuration
DEFAULT_LIMITS = httpx.Limits(
    max_connections=100,  # Maximum total connections
    max_keepalive_connections=20,  # Keep these many connections alive
    keepalive_expiry=30.0,  # Seconds to keep idle connections alive
)

DEFAULT_TIMEOUT = httpx.Timeout(
    connect=5.0,  # Connection timeout
    read=60.0,  # Read timeout for streaming
    write=10.0,  # Write timeout
    pool=5.0,  # Pool acquisition timeout
)

HUGGINGFACE_TIMEOUT = httpx.Timeout(
    connect=10.0,
    read=120.0,  # HuggingFace models can be slow
    write=10.0,
    pool=5.0,
)


def _get_http_client(
    timeout: httpx.Timeout = DEFAULT_TIMEOUT,
    limits: httpx.Limits = DEFAULT_LIMITS,
) -> httpx.Client:
    """Create an HTTP client with connection pooling and keepalive."""
    return httpx.Client(
        timeout=timeout,
        limits=limits,
        http2=True,  # Enable HTTP/2 for multiplexing
        follow_redirects=True,
    )


def _get_async_http_client(
    timeout: httpx.Timeout = DEFAULT_TIMEOUT,
    limits: httpx.Limits = DEFAULT_LIMITS,
) -> httpx.AsyncClient:
    """Create an async HTTP client with connection pooling and keepalive."""
    return httpx.AsyncClient(
        timeout=timeout,
        limits=limits,
        http2=True,
        follow_redirects=True,
    )


def get_pooled_client(
    provider: str,
    base_url: str,
    api_key: str,
    default_headers: Optional[Dict[str, str]] = None,
    timeout: Optional[httpx.Timeout] = None,
) -> OpenAI:
    """
    Get or create a pooled OpenAI client for a specific provider.

    Args:
        provider: Provider name (e.g., 'openrouter', 'portkey')
        base_url: API base URL
        api_key: API key for authentication
        default_headers: Optional headers to include in all requests
        timeout: Optional custom timeout configuration

    Returns:
        OpenAI client with connection pooling enabled
    """
    cache_key = f"{provider}_{base_url}"

    with _pool_lock:
        if cache_key not in _client_pool:
            http_client = _get_http_client(
                timeout=timeout or DEFAULT_TIMEOUT,
                limits=DEFAULT_LIMITS,
            )

            client = OpenAI(
                base_url=base_url,
                api_key=api_key,
                default_headers=default_headers or {},
                http_client=http_client,
                max_retries=2,  # Enable automatic retries
            )

            _client_pool[cache_key] = client
            logger.info(f"Created pooled client for {provider}")

        return _client_pool[cache_key]


def get_pooled_async_client(
    provider: str,
    base_url: str,
    api_key: str,
    default_headers: Optional[Dict[str, str]] = None,
    timeout: Optional[httpx.Timeout] = None,
) -> AsyncOpenAI:
    """
    Get or create a pooled AsyncOpenAI client for a specific provider.

    Args:
        provider: Provider name (e.g., 'openrouter', 'portkey')
        base_url: API base URL
        api_key: API key for authentication
        default_headers: Optional headers to include in all requests
        timeout: Optional custom timeout configuration

    Returns:
        AsyncOpenAI client with connection pooling enabled
    """
    cache_key = f"{provider}_{base_url}_async"

    with _pool_lock:
        if cache_key not in _async_client_pool:
            http_client = _get_async_http_client(
                timeout=timeout or DEFAULT_TIMEOUT,
                limits=DEFAULT_LIMITS,
            )

            client = AsyncOpenAI(
                base_url=base_url,
                api_key=api_key,
                default_headers=default_headers or {},
                http_client=http_client,
                max_retries=2,
            )

            _async_client_pool[cache_key] = client
            logger.info(f"Created pooled async client for {provider}")

        return _async_client_pool[cache_key]


def clear_connection_pools():
    """Clear all connection pools. Useful for testing or graceful shutdown."""
    with _pool_lock:
        # Close all sync clients
        for client in _client_pool.values():
            try:
                client.close()
            except Exception as e:
                logger.warning(f"Error closing client: {e}")
        _client_pool.clear()

        # Close all async clients
        for client in _async_client_pool.values():
            try:
                # AsyncOpenAI clients need to be closed in an async context
                # For now, just clear the reference
                pass
            except Exception as e:
                logger.warning(f"Error closing async client: {e}")
        _async_client_pool.clear()

        logger.info("Cleared all connection pools")


def get_pool_stats() -> Dict[str, int]:
    """Get statistics about current connection pools."""
    with _pool_lock:
        return {
            "sync_clients": len(_client_pool),
            "async_clients": len(_async_client_pool),
            "total_clients": len(_client_pool) + len(_async_client_pool),
        }


# Provider-specific helper functions
def get_openrouter_pooled_client() -> OpenAI:
    """Get pooled client for OpenRouter."""
    if not Config.OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not configured")

    return get_pooled_client(
        provider="openrouter",
        base_url="https://openrouter.ai/api/v1",
        api_key=Config.OPENROUTER_API_KEY,
        default_headers={
            "HTTP-Referer": Config.OPENROUTER_SITE_URL,
            "X-TitleSection": Config.OPENROUTER_SITE_NAME,
        },
    )


def get_portkey_pooled_client(
    provider: Optional[str] = None,
    virtual_key: Optional[str] = None,
) -> OpenAI:
    """Get pooled client for Portkey."""
    if not Config.PORTKEY_API_KEY:
        raise ValueError("Portkey API key not configured")

    headers = {
        "x-portkey-api-key": Config.PORTKEY_API_KEY,
    }

    resolved_virtual_key = virtual_key or Config.get_portkey_virtual_key(provider)
    if resolved_virtual_key:
        headers["x-portkey-virtual-key"] = resolved_virtual_key

    if provider:
        headers["x-portkey-provider"] = provider

    # Create unique cache key based on provider/virtual_key combination
    cache_suffix = f"_{provider}_{virtual_key}" if provider or virtual_key else ""

    return get_pooled_client(
        provider=f"portkey{cache_suffix}",
        base_url="https://api.portkey.ai/v1",
        api_key=Config.PORTKEY_API_KEY,
        default_headers=headers,
    )


def get_featherless_pooled_client() -> OpenAI:
    """Get pooled client for Featherless.ai."""
    if not Config.FEATHERLESS_API_KEY:
        raise ValueError("Featherless API key not configured")

    return get_pooled_client(
        provider="featherless",
        base_url="https://api.featherless.ai/v1",
        api_key=Config.FEATHERLESS_API_KEY,
    )


def get_fireworks_pooled_client() -> OpenAI:
    """Get pooled client for Fireworks.ai."""
    if not Config.FIREWORKS_API_KEY:
        raise ValueError("Fireworks API key not configured")

    return get_pooled_client(
        provider="fireworks",
        base_url="https://api.fireworks.ai/inference/v1",
        api_key=Config.FIREWORKS_API_KEY,
    )


def get_together_pooled_client() -> OpenAI:
    """Get pooled client for Together.ai."""
    if not Config.TOGETHER_API_KEY:
        raise ValueError("Together API key not configured")

    return get_pooled_client(
        provider="together",
        base_url="https://api.together.xyz/v1",
        api_key=Config.TOGETHER_API_KEY,
    )


def get_huggingface_pooled_client() -> OpenAI:
    """Get pooled client for HuggingFace (with extended timeout)."""
    if not Config.HUGGINGFACE_API_KEY:
        raise ValueError("HuggingFace API key not configured")

    return get_pooled_client(
        provider="huggingface",
        base_url="https://api-inference.huggingface.co/v1",
        api_key=Config.HUGGINGFACE_API_KEY,
        timeout=HUGGINGFACE_TIMEOUT,
    )


def get_xai_pooled_client() -> OpenAI:
    """Get pooled client for X.AI."""
    if not Config.XAI_API_KEY:
        raise ValueError("X.AI API key not configured")

    return get_pooled_client(
        provider="xai",
        base_url="https://api.x.ai/v1",
        api_key=Config.XAI_API_KEY,
    )


def get_deepinfra_pooled_client() -> OpenAI:
    """Get pooled client for DeepInfra."""
    if not Config.DEEPINFRA_API_KEY:
        raise ValueError("DeepInfra API key not configured")

    return get_pooled_client(
        provider="deepinfra",
        base_url="https://api.deepinfra.com/v1/openai",
        api_key=Config.DEEPINFRA_API_KEY,
    )


def get_chutes_pooled_client() -> OpenAI:
    """Get pooled client for Chutes.ai."""
    if not Config.CHUTES_API_KEY:
        raise ValueError("Chutes API key not configured")

    return get_pooled_client(
        provider="chutes",
        base_url="https://llm.chutes.ai/v1",
        api_key=Config.CHUTES_API_KEY,
    )
