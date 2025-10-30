"""
Monitoring endpoints for backend API optimizations.

This module provides endpoints to monitor connection pools, caching, and request prioritization.
"""

import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from src.services.connection_pool import get_pool_stats
from src.services.response_cache import get_cache_stats
from src.services.request_prioritization import get_priority_stats

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health/optimizations")
async def get_optimization_health() -> Dict[str, Any]:
    """
    Get health and statistics for all optimization systems.

    Returns:
        Dictionary containing stats for connection pools, cache, and prioritization
    """
    try:
        return {
            "status": "healthy",
            "connection_pools": get_pool_stats(),
            "response_cache": get_cache_stats(),
            "request_prioritization": get_priority_stats(),
        }
    except Exception as e:
        logger.error(f"Failed to get optimization health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health/optimizations/connection-pools")
async def get_connection_pool_stats() -> Dict[str, Any]:
    """
    Get detailed connection pool statistics.

    Returns:
        Dictionary with connection pool metrics
    """
    try:
        return get_pool_stats()
    except Exception as e:
        logger.error(f"Failed to get connection pool stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health/optimizations/cache")
async def get_cache_health() -> Dict[str, Any]:
    """
    Get response cache statistics.

    Returns:
        Dictionary with cache metrics including hit rate
    """
    try:
        return get_cache_stats()
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health/optimizations/prioritization")
async def get_prioritization_stats() -> Dict[str, Any]:
    """
    Get request prioritization statistics.

    Returns:
        Dictionary with priority distribution and metrics
    """
    try:
        return get_priority_stats()
    except Exception as e:
        logger.error(f"Failed to get prioritization stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/health/optimizations/cache/clear")
async def clear_cache() -> Dict[str, str]:
    """
    Clear the response cache.

    Returns:
        Success message
    """
    try:
        from src.services.response_cache import clear_response_cache
        clear_response_cache()
        logger.info("Response cache cleared via API")
        return {"status": "success", "message": "Cache cleared"}
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))
