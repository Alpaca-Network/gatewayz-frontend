"""
Modelz API client for fetching model token data and filtering models.
"""

import httpx
import logging
from typing import Dict, List, Optional, Any
from fastapi import HTTPException

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

async def fetch_modelz_tokens(is_graduated: Optional[bool] = None) -> List[Dict[str, Any]]:
    """
    Fetch model tokens from Modelz API with optional graduation filter.
    
    Args:
        is_graduated: Filter for graduated (singularity) models:
                     - True: Only graduated/singularity models
                     - False: Only non-graduated models  
                     - None: All models
    
    Returns:
        List of model token data from Modelz
    """
    try:
        async with await get_modelz_client() as client:
            # Build URL with optional filter
            url = f"{MODELZ_BASE_URL}/api/tokens"
            params = {}
            
            if is_graduated is not None:
                params["isGraduated"] = str(is_graduated).lower()
            
            logger.info(f"Fetching Modelz tokens from: {url} with params: {params}")
            
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
            
            logger.info(f"Successfully fetched {len(tokens)} tokens from Modelz")
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

async def get_modelz_model_ids(is_graduated: Optional[bool] = None) -> List[str]:
    """
    Get a list of model IDs that exist on Modelz.
    
    Args:
        is_graduated: Filter for graduated models (True/False/None)
    
    Returns:
        List of model IDs from Modelz
    """
    tokens = await fetch_modelz_tokens(is_graduated)
    
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

async def check_model_exists_on_modelz(model_id: str, is_graduated: Optional[bool] = None) -> bool:
    """
    Check if a specific model exists on Modelz.
    
    Args:
        model_id: The model ID to check
        is_graduated: Filter for graduated models (True/False/None)
    
    Returns:
        True if model exists on Modelz, False otherwise
    """
    model_ids = await get_modelz_model_ids(is_graduated)
    return model_id in model_ids

async def get_modelz_model_details(model_id: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information about a specific model from Modelz.
    
    Args:
        model_id: The model ID to fetch details for
    
    Returns:
        Model details from Modelz or None if not found
    """
    tokens = await fetch_modelz_tokens()
    
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
