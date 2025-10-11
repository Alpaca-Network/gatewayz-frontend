"""
Transaction Analytics Routes
Endpoints for fetching transaction analytics from OpenRouter
"""

import logging
import httpx
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from src.config import Config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/transactions")
async def get_transaction_analytics(
    window: str = Query("1d", description="Time window: '1hr', '1d', '1mo', or '1y'")
):
    """
    Get daily summary of model inference per model from OpenRouter
    
    This endpoint fetches transaction analytics data from OpenRouter API
    and returns it publicly (no authentication required).
    
    Args:
        window: Time window for analytics (default: '1d')
                Valid options: '1hr', '1d', '1mo', '1y'
    
    Returns:
        Transaction analytics data from OpenRouter
        
    Example:
        GET /analytics/transactions?window=1d
    """
    try:
        # OpenRouter transaction analytics endpoint
        url = f"https://openrouter.ai/api/frontend/user/transaction-analytics?window={window}"
        
        # Get cookie from environment variable with fallback to hardcoded value
        # NOTE: This cookie should be refreshed periodically as session cookies expire
        # Add OPENROUTER_COOKIE to your .env file
        default_cookie = "_ga=GA1.1.955610978.1758181216; __client_uat=1760013251; __client_uat_NO6jtgZM=1760013251; __refresh_NO6jtgZM=02VAx9G5rkw6h8UiRH4R; ph_phc_yQgAEdJJkVpI24NdSRID2mor1x1leRpDoC9yZ9mfXal_posthog=%7B%22distinct_id%22%3A%220199962a-6751-75ee-bafe-e01fe277629a%22%2C%22%24sesid%22%3A%5B1760032314911%2C%220199ca0f-9f93-7708-b994-6ec01291eeff%22%2C1760031645587%5D%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22https%3A%2F%2Fopenrouter.ai%2Fdocs%2Fquickstart%22%2C%22u%22%3A%22https%3A%2F%2Fopenrouter.ai%2Fdocs%2Ffeatures%2Fweb-search%22%7D%7D; clerk_active_context=sess_33pTw0lg7sfGaQiR5DWGcI7k5ls:org_30p9tVvCCD60jyYschdRPSIUzz0; __session=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18yUGlRcWt2UlFlZXB3R3ZrVjFZRDhBb3Q1elIiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwczovL29wZW5yb3V0ZXIuYWkiLCJleHAiOjE3NjAwMzI5NTIsImZ2YSI6WzMyNywtMV0sImlhdCI6MTc2MDAzMjg5MiwiaXNzIjoiaHR0cHM6Ly9jbGVyay5vcGVucm91dGVyLmFpIiwibmJmIjoxNzYwMDMyODgyLCJvcmdfaWQiOiJvcmdfMzBwOXRWdkNDRDYwanlZc2NoZFJQU0lVenowIiwib3JnX3Blcm1pc3Npb25zIjpbXSwib3JnX3JvbGUiOiJvcmc6bWVtYmVyIiwib3JnX3NsdWciOiJhbHBhY2EtbmV0d29yay0xNzU0MzEzODYxIiwic2lkIjoic2Vzc18zM3BUdzBsZzdzZkdhUWlSNURXR2NJN2s1bHMiLCJzdHMiOiJhY3RpdmUiLCJzdWIiOiJ1c2VyXzMzcFR3NFQ0UkxWRUZWZmxaWkszRm5YeDFTQiJ9.JkAYXyB4x0RUzWE5v5WnXwLMlAyOna8EufTynYFyHeV0krsqrAM4YkA3JVulcFs-B1GjpbF98bOYkyOBVGvdJ5btTFnc50MZ-wgqymJ7mK2ttn891a70xo3yo0sdJpA7bqIvGKBLdx87hzPkq6p_CJMbyHpnHQglMjcS76UFWPWCZWQevH3iTtQtgBYeFNZ_V1EiRVBn_AncnECGVztxbrIcEJgePy4gpDPgnu5uT33YRNr6VEgYcHKvm-SPYqjx9RC46trQk3qyEFGaZ6zEopfGIb7O5fQAYUN6bpkamHvu9JekvjcvzPwpLgMzgUF7AW8BHRggC2fsr3S28KIA7A; __session_NO6jtgZM=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18yUGlRcWt2UlFlZXB3R3ZrVjFZRDhBb3Q1elIiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwczovL29wZW5yb3V0ZXIuYWkiLCJleHAiOjE3NjAwMzI5NTIsImZ2YSI6WzMyNywtMV0sImlhdCI6MTc2MDAzMjg5MiwiaXNzIjoiaHR0cHM6Ly9jbGVyay5vcGVucm91dGVyLmFpIiwibmJmIjoxNzYwMDMyODgyLCJvcmdfaWQiOiJvcmdfMzBwOXRWdkNDRDYwanlZc2NoZFJQU0lVenowIiwib3JnX3Blcm1pc3Npb25zIjpbXSwib3JnX3JvbGUiOiJvcmc6bWVtYmVyIiwib3JnX3NsdWciOiJhbHBhY2EtbmV0d29yay0xNzU0MzEzODYxIiwic2lkIjoic2Vzc18zM3BUdzBsZzdzZkdhUWlSNURXR2NJN2s1bHMiLCJzdHMiOiJhY3RpdmUiLCJzdWIiOiJ1c2VyXzMzcFR3NFQ0UkxWRUZWZmxaWkszRm5YeDFTQiJ9.JkAYXyB4x0RUzWE5v5WnXwLMlAyOna8EufTynYFyHeV0krsqrAM4YkA3JVulcFs-B1GjpbF98bOYkyOBVGvdJ5btTFnc50MZ-wgqymJ7mK2ttn891a70xo3yo0sdJpA7bqIvGKBLdx87hzPkq6p_CJMbyHpnHQglMjcS76UFWPWCZWQevH3iTtQtgBYeFNZ_V1EiRVBn_AncnECGVztxbrIcEJgePy4gpDPgnu5uT33YRNr6VEgYcHKvm-SPYqjx9RC46trQk3qyEFGaZ6zEopfGIb7O5fQAYUN6bpkamHvu9JekvjcvzPwpLgMzgUF7AW8BHRggC2fsr3S28KIA7A; _ga_R8YZRJS2XN=GS2.1.s1760031469$o36$g1$t1760032906$j60$l0$h0"
        
        cookie = Config.OPENROUTER_COOKIE or default_cookie
        
        headers = {
            "Cookie": cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9"
        }
        
        logger.info(f"Fetching transaction analytics with window={window}")
        
        # Make request to OpenRouter API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            
            # Check if request was successful
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully fetched transaction analytics")
                
                return {
                    "success": True,
                    "window": window,
                    "data": data
                }
            
            elif response.status_code == 401:
                logger.error("OpenRouter authentication failed - cookie may be expired")
                raise HTTPException(
                    status_code=502,
                    detail="Failed to authenticate with OpenRouter. Session may be expired."
                )
            
            else:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail=f"OpenRouter API returned error: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        logger.error("Timeout while fetching transaction analytics")
        raise HTTPException(
            status_code=504,
            detail="Request to OpenRouter API timed out"
        )
        
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to OpenRouter API: {str(e)}"
        )
        
    except Exception as e:
        logger.error(f"Unexpected error fetching transaction analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/transactions/summary")
async def get_transaction_summary(
    window: str = Query("1d", description="Time window: '1hr', '1d', '1mo', or '1y'")
):
    """
    Get a processed summary of transaction analytics
    
    This endpoint fetches data from OpenRouter and processes it to provide
    a cleaner summary format. No authentication required.
    
    Args:
        window: Time window for analytics (default: '1d')
                Valid options: '1hr', '1d', '1mo', '1y'
        
    Returns:
        Processed summary of transaction analytics
    """
    try:
        # Get the raw data first
        analytics_data = await get_transaction_analytics(window)
        
        # Process and summarize the data
        # analytics_data has structure: {"success": true, "window": "1mo", "data": {...}}
        raw_data = analytics_data.get("data", {})
        
        # Extract the actual data array from nested structure
        data_items = raw_data.get("data", {}).get("data", [])
        
        # Compute per-model statistics (matching the JS logic)
        model_stats = {}
        
        for item in data_items:
            model = item.get("model_permaslug", "unknown")
            
            if model not in model_stats:
                model_stats[model] = {
                    "requests": 0,
                    "tokens": {
                        "prompt": {"sum": 0, "min": float('inf'), "max": float('-inf'), "count": 0},
                        "completion": {"sum": 0, "min": float('inf'), "max": float('-inf'), "count": 0},
                        "reasoning": {"sum": 0, "min": float('inf'), "max": float('-inf'), "count": 0},
                        "total": {"sum": 0, "min": float('inf'), "max": float('-inf'), "count": 0},
                    },
                    "usage": {"sum": 0, "min": float('inf'), "max": float('-inf'), "count": 0}
                }
            
            m = model_stats[model]
            
            # Get token values
            prompt = max(0, item.get("prompt_tokens", 0))
            completion = max(0, item.get("completion_tokens", 0))
            reasoning = max(0, item.get("reasoning_tokens", 0))
            total_tokens = prompt + completion  # Total = prompt + completion (exclude reasoning)
            usage = max(0, item.get("usage", 0))
            requests = max(0, int(item.get("requests", 0)))
            
            # Requests
            m["requests"] += requests
            
            # Prompt tokens
            m["tokens"]["prompt"]["sum"] += prompt
            m["tokens"]["prompt"]["count"] += 1
            m["tokens"]["prompt"]["min"] = min(m["tokens"]["prompt"]["min"], prompt)
            m["tokens"]["prompt"]["max"] = max(m["tokens"]["prompt"]["max"], prompt)
            
            # Completion tokens
            m["tokens"]["completion"]["sum"] += completion
            m["tokens"]["completion"]["count"] += 1
            m["tokens"]["completion"]["min"] = min(m["tokens"]["completion"]["min"], completion)
            m["tokens"]["completion"]["max"] = max(m["tokens"]["completion"]["max"], completion)
            
            # Reasoning tokens
            m["tokens"]["reasoning"]["sum"] += reasoning
            m["tokens"]["reasoning"]["count"] += 1
            m["tokens"]["reasoning"]["min"] = min(m["tokens"]["reasoning"]["min"], reasoning)
            m["tokens"]["reasoning"]["max"] = max(m["tokens"]["reasoning"]["max"], reasoning)
            
            # Total tokens
            m["tokens"]["total"]["sum"] += total_tokens
            m["tokens"]["total"]["count"] += 1
            m["tokens"]["total"]["min"] = min(m["tokens"]["total"]["min"], total_tokens)
            m["tokens"]["total"]["max"] = max(m["tokens"]["total"]["max"], total_tokens)
            
            # Usage
            m["usage"]["sum"] += usage
            m["usage"]["count"] += 1
            m["usage"]["min"] = min(m["usage"]["min"], usage)
            m["usage"]["max"] = max(m["usage"]["max"], usage)
        
        # Finalize stats: calculate avg and normalize infinity values
        for model in model_stats:
            m = model_stats[model]
            
            # Helper to normalize stats
            def normalize_stat(stat):
                if stat["count"] == 0:
                    return {"sum": 0, "min": 0, "max": 0, "avg": 0, "count": 0}
                return {
                    "sum": round(stat["sum"], 2),
                    "min": round(stat["min"], 2) if stat["min"] != float('inf') else 0,
                    "max": round(stat["max"], 2) if stat["max"] != float('-inf') else 0,
                    "avg": round(stat["sum"] / stat["count"], 2),
                    "count": stat["count"]
                }
            
            m["tokens"]["prompt"] = normalize_stat(m["tokens"]["prompt"])
            m["tokens"]["completion"] = normalize_stat(m["tokens"]["completion"])
            m["tokens"]["reasoning"] = normalize_stat(m["tokens"]["reasoning"])
            m["tokens"]["total"] = normalize_stat(m["tokens"]["total"])
            
            # Usage with more precision
            if m["usage"]["count"] == 0:
                m["usage"] = {"sum": 0, "min": 0, "max": 0, "avg": 0, "count": 0}
            else:
                m["usage"] = {
                    "sum": round(m["usage"]["sum"], 6),
                    "min": round(m["usage"]["min"], 6) if m["usage"]["min"] != float('inf') else 0,
                    "max": round(m["usage"]["max"], 6) if m["usage"]["max"] != float('-inf') else 0,
                    "avg": round(m["usage"]["sum"] / m["usage"]["count"], 6),
                    "count": m["usage"]["count"]
                }
        
        # Calculate overall totals
        total_requests = sum(m["requests"] for m in model_stats.values())
        total_cost = sum(m["usage"]["sum"] for m in model_stats.values())
        
        # Extract and format the summary
        summary = {
            "window": window,
            "total_requests": total_requests,
            "total_cost": round(total_cost, 6),
            "models_count": len(model_stats),
            "models_stats": model_stats
        }
        
        return {
            "success": True,
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Error creating transaction summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create summary: {str(e)}"
        )

