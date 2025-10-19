"""
System endpoints for cache management and gateway health monitoring
Phase 2 implementation
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, HTTPException
import httpx

from src.cache import get_models_cache, get_providers_cache, clear_models_cache, clear_providers_cache, get_modelz_cache, clear_modelz_cache
from src.services.models import (
    fetch_models_from_openrouter,
    fetch_models_from_portkey,
    fetch_models_from_featherless,
    fetch_models_from_chutes,
    fetch_models_from_groq,
    fetch_models_from_fireworks,
    fetch_models_from_together
)
from src.services.huggingface_models import fetch_models_from_hug
from src.config import Config
from src.services.modelz_client import refresh_modelz_cache, get_modelz_cache_status as get_modelz_cache_status_func

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Cache Management Endpoints
# ============================================================================

@router.get("/cache/status", tags=["cache"])
async def get_cache_status():
    """
    Get cache status for all gateways.
    
    Returns information about:
    - Number of models cached per gateway
    - Last refresh timestamp
    - TTL (Time To Live)
    - Cache size estimate
    
    **Example Response:**
    ```json
    {
        "openrouter": {
            "models_cached": 250,
            "last_refresh": "2025-01-15T10:30:00Z",
            "ttl_seconds": 3600,
            "status": "healthy"
        },
        ...
    }
    ```
    """
    try:
        cache_status = {}
        gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]
        
        for gateway in gateways:
            cache_info = get_models_cache(gateway)
            
            if cache_info:
                models = cache_info.get("data") or []
                timestamp = cache_info.get("timestamp")
                ttl = cache_info.get("ttl", 3600)
                
                # Calculate cache age
                cache_age_seconds = None
                is_stale = False
                if timestamp:
                    # Handle both float timestamp and datetime object
                    if isinstance(timestamp, datetime):
                        age = (datetime.now(timezone.utc) - timestamp).total_seconds()
                    else:
                        # Assume it's a float (unix timestamp)
                        age = datetime.now(timezone.utc).timestamp() - timestamp
                    cache_age_seconds = int(age)
                    is_stale = age > ttl
                
                # Convert timestamp to ISO format string
                last_refresh = None
                if timestamp:
                    if isinstance(timestamp, datetime):
                        last_refresh = timestamp.isoformat()
                    else:
                        last_refresh = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
                
                cache_status[gateway] = {
                    "models_cached": len(models) if models else 0,
                    "last_refresh": last_refresh,
                    "ttl_seconds": ttl,
                    "cache_age_seconds": cache_age_seconds,
                    "status": "stale" if is_stale else ("healthy" if models else "empty"),
                    "has_data": bool(models)
                }
            else:
                cache_status[gateway] = {
                    "models_cached": 0,
                    "last_refresh": None,
                    "ttl_seconds": 3600,
                    "cache_age_seconds": None,
                    "status": "empty",
                    "has_data": False
                }
        
        # Add providers cache
        providers_cache = get_providers_cache()
        if providers_cache:
            providers = providers_cache.get("data") or []
            timestamp = providers_cache.get("timestamp")
            ttl = providers_cache.get("ttl", 3600)
            
            cache_age_seconds = None
            is_stale = False
            if timestamp:
                # Handle both float timestamp and datetime object
                if isinstance(timestamp, datetime):
                    age = (datetime.now(timezone.utc) - timestamp).total_seconds()
                else:
                    age = datetime.now(timezone.utc).timestamp() - timestamp
                cache_age_seconds = int(age)
                is_stale = age > ttl
            
            # Convert timestamp to ISO format string
            last_refresh = None
            if timestamp:
                if isinstance(timestamp, datetime):
                    last_refresh = timestamp.isoformat()
                else:
                    last_refresh = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
            
            cache_status["providers"] = {
                "providers_cached": len(providers) if providers else 0,
                "last_refresh": last_refresh,
                "ttl_seconds": ttl,
                "cache_age_seconds": cache_age_seconds,
                "status": "stale" if is_stale else ("healthy" if providers else "empty"),
                "has_data": bool(providers)
            }
        else:
            cache_status["providers"] = {
                "providers_cached": 0,
                "last_refresh": None,
                "ttl_seconds": 3600,
                "cache_age_seconds": None,
                "status": "empty",
                "has_data": False
            }
        
        return {
            "success": True,
            "data": cache_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to get cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")


@router.post("/cache/refresh/{gateway}", tags=["cache"])
async def refresh_gateway_cache(
    gateway: str,
    force: bool = Query(False, description="Force refresh even if cache is still valid")
):
    """
    Force refresh cache for a specific gateway.
    
    **Parameters:**
    - `gateway`: The gateway to refresh (openrouter, portkey, featherless, etc.)
    - `force`: If true, refresh even if cache is still valid
    
    **Example:**
    ```bash
    curl -X POST "http://localhost:8000/cache/refresh/openrouter?force=true"
    ```
    """
    try:
        gateway = gateway.lower()
        valid_gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together", "huggingface"]

        if gateway not in valid_gateways:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid gateway. Must be one of: {', '.join(valid_gateways)}"
            )
        
        # Check if refresh is needed
        cache_info = get_models_cache(gateway)
        needs_refresh = force
        
        if not force and cache_info:
            timestamp = cache_info.get("timestamp")
            ttl = cache_info.get("ttl", 3600)
            if timestamp:
                age = datetime.now(timezone.utc).timestamp() - timestamp
                needs_refresh = age > ttl
        
        if not needs_refresh:
            return {
                "success": True,
                "message": f"Cache for {gateway} is still valid. Use force=true to refresh anyway.",
                "gateway": gateway,
                "action": "skipped",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Clear existing cache
        clear_models_cache(gateway)
        
        # Fetch new data based on gateway
        logger.info(f"Refreshing cache for {gateway}...")
        
        fetch_functions = {
            "openrouter": fetch_models_from_openrouter,
            "portkey": fetch_models_from_portkey,
            "featherless": fetch_models_from_featherless,
            "chutes": fetch_models_from_chutes,
            "groq": fetch_models_from_groq,
            "fireworks": fetch_models_from_fireworks,
            "together": fetch_models_from_together,
            "huggingface": fetch_models_from_hug
        }
        
        fetch_func = fetch_functions.get(gateway)
        if fetch_func:
            # Most fetch functions are sync, so we need to handle both
            try:
                result = fetch_func()
                # If it's a coroutine, await it
                if hasattr(result, '__await__'):
                    await result
            except Exception as fetch_error:
                logger.error(f"Error fetching models from {gateway}: {fetch_error}")
                raise HTTPException(status_code=500, detail=f"Failed to fetch models from {gateway}")
        elif gateway == "deepinfra":
            # DeepInfra doesn't have bulk fetching, only individual model fetching
            return {
                "success": False,
                "message": f"DeepInfra does not support bulk cache refresh. Models are fetched on-demand.",
                "gateway": gateway,
                "action": "not_supported",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unknown gateway: {gateway}")
        
        # Get updated cache info
        new_cache_info = get_models_cache(gateway)
        models_count = len(new_cache_info.get("data", [])) if new_cache_info else 0
        
        return {
            "success": True,
            "message": f"Cache refreshed successfully for {gateway}",
            "gateway": gateway,
            "models_cached": models_count,
            "action": "refreshed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to refresh cache for {gateway}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh cache: {str(e)}")


@router.post("/cache/clear", tags=["cache"])
async def clear_all_caches(
    gateway: Optional[str] = Query(None, description="Specific gateway to clear, or all if not specified")
):
    """
    Clear cache for all gateways or a specific gateway.
    
    **Warning:** This will remove all cached data. Use with caution.
    """
    try:
        if gateway:
            gateway = gateway.lower()
            clear_models_cache(gateway)
            return {
                "success": True,
                "message": f"Cache cleared for {gateway}",
                "gateway": gateway,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            # Clear all gateways
            gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]
            for gw in gateways:
                clear_models_cache(gw)
            clear_providers_cache()
            
            return {
                "success": True,
                "message": "All caches cleared",
                "gateways_cleared": gateways + ["providers"],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")


# ============================================================================
# Gateway Health Monitoring Endpoints
# ============================================================================

@router.get("/health/gateways", tags=["health"])
async def check_all_gateways():
    """
    Check health status of all configured gateways.
    
    Performs live health checks by making test requests to each gateway's API.
    
    **Returns:**
    ```json
    {
        "openrouter": {
            "status": "healthy",
            "latency_ms": 150,
            "available": true,
            "last_check": "2025-01-15T10:30:00Z",
            "error": null
        },
        ...
    }
    ```
    """
    try:
        health_status = {}
        
        # Define gateway endpoints for health checks
        gateway_endpoints = {
            "openrouter": {
                "url": "https://openrouter.ai/api/v1/models",
                "api_key": Config.OPENROUTER_API_KEY,
                "headers": {}
            },
            "portkey": {
                "url": "https://api.portkey.ai/v1/models",
                "api_key": Config.PORTKEY_API_KEY,
                "headers": {"x-portkey-api-key": Config.PORTKEY_API_KEY} if Config.PORTKEY_API_KEY else {}
            },
            "featherless": {
                "url": "https://api.featherless.ai/v1/models",
                "api_key": Config.FEATHERLESS_API_KEY,
                "headers": {"Authorization": f"Bearer {Config.FEATHERLESS_API_KEY}"} if Config.FEATHERLESS_API_KEY else {}
            },
            "deepinfra": {
                "url": "https://api.deepinfra.com/v1/openai/models",
                "api_key": Config.DEEPINFRA_API_KEY,
                "headers": {"Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}"} if Config.DEEPINFRA_API_KEY else {}
            },
            "groq": {
                "url": "https://api.groq.com/openai/v1/models",
                "api_key": os.environ.get("GROQ_API_KEY"),
                "headers": {"Authorization": f"Bearer {os.environ.get('GROQ_API_KEY')}"} if os.environ.get("GROQ_API_KEY") else {}
            },
            "fireworks": {
                "url": "https://api.fireworks.ai/inference/v1/models",
                "api_key": os.environ.get("FIREWORKS_API_KEY"),
                "headers": {"Authorization": f"Bearer {os.environ.get('FIREWORKS_API_KEY')}"} if os.environ.get("FIREWORKS_API_KEY") else {}
            },
            "together": {
                "url": "https://api.together.xyz/v1/models",
                "api_key": os.environ.get("TOGETHER_API_KEY"),
                "headers": {"Authorization": f"Bearer {os.environ.get('TOGETHER_API_KEY')}"} if os.environ.get("TOGETHER_API_KEY") else {}
            }
        }
        
        # Check each gateway
        async with httpx.AsyncClient(timeout=10.0) as client:
            for gateway_name, config in gateway_endpoints.items():
                check_time = datetime.now(timezone.utc)
                
                if not config["api_key"]:
                    health_status[gateway_name] = {
                        "status": "unconfigured",
                        "latency_ms": None,
                        "available": False,
                        "last_check": check_time.isoformat(),
                        "error": "API key not configured"
                    }
                    continue
                
                try:
                    start_time = datetime.now(timezone.utc)
                    response = await client.get(
                        config["url"],
                        headers=config["headers"],
                        timeout=5.0
                    )
                    end_time = datetime.now(timezone.utc)
                    latency_ms = int((end_time - start_time).total_seconds() * 1000)
                    
                    if response.status_code == 200:
                        health_status[gateway_name] = {
                            "status": "healthy",
                            "latency_ms": latency_ms,
                            "available": True,
                            "last_check": check_time.isoformat(),
                            "error": None
                        }
                    else:
                        health_status[gateway_name] = {
                            "status": "degraded",
                            "latency_ms": latency_ms,
                            "available": False,
                            "last_check": check_time.isoformat(),
                            "error": f"HTTP {response.status_code}"
                        }
                
                except httpx.TimeoutException:
                    health_status[gateway_name] = {
                        "status": "timeout",
                        "latency_ms": None,
                        "available": False,
                        "last_check": check_time.isoformat(),
                        "error": "Request timed out"
                    }
                
                except Exception as e:
                    health_status[gateway_name] = {
                        "status": "error",
                        "latency_ms": None,
                        "available": False,
                        "last_check": check_time.isoformat(),
                        "error": str(e)
                    }
        
        # Calculate overall health
        healthy_count = sum(1 for g in health_status.values() if g["status"] == "healthy")
        total_configured = sum(1 for g in health_status.values() if g["status"] != "unconfigured")
        
        return {
            "success": True,
            "data": health_status,
            "summary": {
                "total_gateways": len(health_status),
                "healthy": healthy_count,
                "degraded": sum(1 for g in health_status.values() if g["status"] == "degraded"),
                "unhealthy": sum(1 for g in health_status.values() if g["status"] in ["error", "timeout"]),
                "unconfigured": sum(1 for g in health_status.values() if g["status"] == "unconfigured"),
                "overall_health_percentage": (healthy_count / total_configured * 100) if total_configured > 0 else 0
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to check gateway health: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check gateway health: {str(e)}")


@router.get("/health/{gateway}", tags=["health"])
async def check_single_gateway(gateway: str):
    """
    Check health status of a specific gateway with detailed diagnostics.
    
    **Parameters:**
    - `gateway`: Gateway name (openrouter, portkey, featherless, etc.)
    
    **Returns detailed health information including:**
    - API connectivity
    - Response latency
    - Models available
    - Cache status
    """
    try:
        # Get all gateway health first
        all_health = await check_all_gateways()
        gateway_health = all_health["data"].get(gateway.lower())
        
        if not gateway_health:
            raise HTTPException(status_code=404, detail=f"Gateway '{gateway}' not found")
        
        # Add cache information
        cache_info = get_models_cache(gateway.lower())
        if cache_info:
            models = cache_info.get("data") or []
            timestamp = cache_info.get("timestamp")
            
            gateway_health["cache"] = {
                "models_cached": len(models),
                "last_refresh": datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat() if timestamp else None,
                "has_data": bool(models)
            }
        else:
            gateway_health["cache"] = {
                "models_cached": 0,
                "last_refresh": None,
                "has_data": False
            }
        
        return {
            "success": True,
            "gateway": gateway.lower(),
            "data": gateway_health,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check gateway {gateway}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check gateway health: {str(e)}")


# ============================================================================
# Modelz Cache Management Endpoints
# ============================================================================

@router.get("/cache/modelz/status", tags=["cache", "modelz"])
async def get_modelz_cache_status():
    """
    Get the current status of the Modelz cache.
    
    Returns information about:
    - Cache validity status
    - Number of tokens cached
    - Last refresh timestamp
    - Cache age and TTL
    
    **Example Response:**
    ```json
    {
      "status": "valid",
      "message": "Modelz cache is valid",
      "cache_size": 53,
      "timestamp": 1705123456.789,
      "ttl": 1800,
      "age_seconds": 245.3,
      "is_valid": true
    }
    ```
    """
    try:
        cache_status = get_modelz_cache_status_func()
        return {
            "success": True,
            "data": cache_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get Modelz cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get Modelz cache status: {str(e)}")


@router.post("/cache/modelz/refresh", tags=["cache", "modelz"])
async def refresh_modelz_cache_endpoint():
    """
    Force refresh the Modelz cache by fetching fresh data from the API.
    
    This endpoint:
    - Clears the existing Modelz cache
    - Fetches fresh data from the Modelz API
    - Updates the cache with new data
    
    **Example Response:**
    ```json
    {
      "success": true,
      "data": {
        "status": "success",
        "message": "Modelz cache refreshed with 53 tokens",
        "cache_size": 53,
        "timestamp": 1705123456.789,
        "ttl": 1800
      },
      "timestamp": "2024-01-15T10:30:45.123Z"
    }
    ```
    """
    try:
        logger.info("Refreshing Modelz cache via API endpoint")
        refresh_result = await refresh_modelz_cache()
        
        return {
            "success": True,
            "data": refresh_result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to refresh Modelz cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh Modelz cache: {str(e)}")


@router.delete("/cache/modelz/clear", tags=["cache", "modelz"])
async def clear_modelz_cache_endpoint():
    """
    Clear the Modelz cache.
    
    This endpoint:
    - Removes all cached Modelz data
    - Resets cache timestamps
    - Forces next request to fetch fresh data from API
    
    **Example Response:**
    ```json
    {
      "success": true,
      "message": "Modelz cache cleared successfully",
      "timestamp": "2024-01-15T10:30:45.123Z"
    }
    ```
    """
    try:
        logger.info("Clearing Modelz cache via API endpoint")
        clear_modelz_cache()
        
        return {
            "success": True,
            "message": "Modelz cache cleared successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to clear Modelz cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear Modelz cache: {str(e)}")

