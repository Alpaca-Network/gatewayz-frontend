"""
Modelz API client for fetching model token data and filtering models.
"""

import httpx
import logging
import time
from typing import Dict, List, Optional, Any
from fastapi import HTTPException
from src.cache import get_modelz_cache, clear_modelz_cache

logger = logging.getLogger(__name__)

MODELZ_BASE_URL = "https://backend.alpacanetwork.ai"

async def get_modelz_client() -> httpx.AsyncClient:
    """Get an HTTP client for Modelz API requests."""
    return httpx.AsyncClient(
        timeout=30.0,
        headers={
            "User-Agent": "Gatewayz-Modelz-Client/1.0",
            "Accept": "application/json",
        }
    )

async def fetch_modelz_tokens(is_graduated: Optional[bool] = None, use_cache: bool = True) -> List[Dict[str, Any]]:
    """
    Fetch model tokens from Modelz API with optional graduation filter and caching.
    
    Args:
        is_graduated: Filter for graduated (singularity) models:
                     - True: Only graduated/singularity models
                     - False: Only non-graduated models  
                     - None: All models
        use_cache: Whether to use cached data if available
    
    Returns:
        List of model token data from Modelz
    """
    # Check cache first if requested
    if use_cache:
        cache = get_modelz_cache()
        current_time = time.time()
        
        # Check if cache is valid
        if (cache["data"] is not None and 
            cache["timestamp"] is not None and 
            (current_time - cache["timestamp"]) < cache["ttl"]):
            
            logger.info(f"Using cached Modelz data (age: {current_time - cache['timestamp']:.1f}s)")
            cached_tokens = cache["data"]
            
            # Apply graduation filter to cached data if needed
            if is_graduated is not None:
                filtered_tokens = [
                    token for token in cached_tokens 
                    if token.get("isGraduated") == is_graduated
                ]
                logger.info(f"Filtered cached data: {len(filtered_tokens)} tokens (is_graduated={is_graduated})")
                return filtered_tokens
            
            return cached_tokens
    
    try:
        async with await get_modelz_client() as client:
            # Build URL with optional filter
            url = f"{MODELZ_BASE_URL}/api/tokens"
            params = {}
            
            if is_graduated is not None:
                params["isGraduated"] = str(is_graduated).lower()
            
            logger.info(f"Fetching Modelz tokens from API: {url} with params: {params}")
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Handle different response formats
            if isinstance(data, list):
                tokens = data
            elif isinstance(data, dict) and "data" in data:
                tokens = data["data"]
            elif isinstance(data, dict) and "tokens" in data:
                tokens = data["tokens"]
            else:
                tokens = [data] if data else []
            
            # Cache the full dataset (without filters) for future use
            # Always cache when fetching from API, regardless of use_cache parameter
            cache = get_modelz_cache()
            cache["data"] = tokens
            cache["timestamp"] = time.time()
            logger.info(f"Cached {len(tokens)} Modelz tokens for {cache['ttl']}s")
            
            logger.info(f"Successfully fetched {len(tokens)} tokens from Modelz API")
            return tokens
            
    except httpx.TimeoutException:
        logger.error("Timeout while fetching Modelz tokens")
        raise HTTPException(
            status_code=504,
            detail="Timeout while fetching data from Modelz API"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error from Modelz API: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Error fetching data from Modelz API: {e.response.text}"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching Modelz tokens: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch data from Modelz API: {str(e)}"
        )

async def get_modelz_model_ids(is_graduated: Optional[bool] = None, use_cache: bool = True) -> List[str]:
    """
    Get a list of model IDs that exist on Modelz.
    
    Args:
        is_graduated: Filter for graduated models (True/False/None)
        use_cache: Whether to use cached data if available
    
    Returns:
        List of model IDs from Modelz
    """
    tokens = await fetch_modelz_tokens(is_graduated, use_cache)
    
    model_ids = []
    for token in tokens:
        # Extract model ID from various possible fields
        # Based on the API response, the field is likely "Token"
        model_id = (
            token.get("Token") or
            token.get("model_id") or 
            token.get("modelId") or 
            token.get("id") or 
            token.get("name") or
            token.get("model")
        )
        
        if model_id and isinstance(model_id, str):
            model_ids.append(model_id.strip())
    
    # Remove duplicates while preserving order
    unique_model_ids = list(dict.fromkeys(model_ids))
    logger.info(f"Extracted {len(unique_model_ids)} unique model IDs from Modelz")
    
    return unique_model_ids

async def check_model_exists_on_modelz(model_id: str, is_graduated: Optional[bool] = None, use_cache: bool = True) -> bool:
    """
    Check if a specific model exists on Modelz.
    
    Args:
        model_id: The model ID to check
        is_graduated: Filter for graduated models (True/False/None)
        use_cache: Whether to use cached data if available
    
    Returns:
        True if model exists on Modelz, False otherwise
    """
    model_ids = await get_modelz_model_ids(is_graduated, use_cache)
    return model_id in model_ids

async def get_modelz_model_details(model_id: str, use_cache: bool = True) -> Optional[Dict[str, Any]]:
    """
    Get detailed information about a specific model from Modelz.
    
    Args:
        model_id: The model ID to fetch details for
        use_cache: Whether to use cached data if available
    
    Returns:
        Model details from Modelz or None if not found
    """
    tokens = await fetch_modelz_tokens(use_cache=use_cache)
    
    for token in tokens:
        token_model_id = (
            token.get("Token") or
            token.get("model_id") or 
            token.get("modelId") or 
            token.get("id") or 
            token.get("name") or
            token.get("model")
        )
        
        if token_model_id and token_model_id.strip() == model_id.strip():
            return token
    
    return None


async def refresh_modelz_cache() -> Dict[str, Any]:
    """
    Force refresh the Modelz cache by fetching fresh data from the API.
    
    Returns:
        Cache status information
    """
    try:
        logger.info("Force refreshing Modelz cache")
        
        # Clear existing cache
        clear_modelz_cache()
        
        # Fetch fresh data (this will populate the cache)
        tokens = await fetch_modelz_tokens(use_cache=False)
        
        # Get cache after refresh to verify it was populated
        cache = get_modelz_cache()
        
        # Verify cache was populated
        if cache["data"] is None or cache["timestamp"] is None:
            logger.error("Cache was not properly populated after refresh")
            return {
                "status": "error",
                "message": "Cache was not properly populated after refresh",
                "cache_size": 0,
                "timestamp": None,
                "ttl": cache["ttl"]
            }
        
        return {
            "status": "success",
            "message": f"Modelz cache refreshed with {len(tokens)} tokens",
            "cache_size": len(tokens),
            "timestamp": cache["timestamp"],
            "ttl": cache["ttl"]
        }
        
    except Exception as e:
        logger.error(f"Failed to refresh Modelz cache: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to refresh Modelz cache: {str(e)}"
        }


def get_modelz_cache_status() -> Dict[str, Any]:
    """
    Get the current status of the Modelz cache.
    
    Returns:
        Cache status information
    """
    cache = get_modelz_cache()
    current_time = time.time()
    
    if cache["data"] is None or cache["timestamp"] is None:
        return {
            "status": "empty",
            "message": "Modelz cache is empty",
            "cache_size": 0,
            "timestamp": None,
            "ttl": cache["ttl"],
            "age_seconds": None,
            "is_valid": False
        }
    
    age_seconds = current_time - cache["timestamp"]
    is_valid = age_seconds < cache["ttl"]
    
    return {
        "status": "valid" if is_valid else "expired",
        "message": f"Modelz cache is {'valid' if is_valid else 'expired'}",
        "cache_size": len(cache["data"]) if cache["data"] else 0,
        "timestamp": cache["timestamp"],
        "ttl": cache["ttl"],
        "age_seconds": round(age_seconds, 1),
        "is_valid": is_valid
    }
