"""
Activity Tracking Routes
Endpoints for retrieving user activity statistics and logs
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from src.db.activity import get_user_activity_stats, get_user_activity_log
from src.security.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user/activity", tags=["Activity"])


@router.get("/stats")
async def get_activity_stats(
    days: int = Query(30, description="Number of days to look back", ge=1, le=365),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get aggregated activity statistics for the authenticated user

    Returns activity stats including:
    - Total requests, tokens, and cost
    - Data aggregated by date
    - Breakdown by model
    - Breakdown by provider

    Args:
        days: Number of days to look back (1-365, default 30)
        current_user: Authenticated user

    Returns:
        Activity statistics

    Example response:
    {
        "total_requests": 150,
        "total_tokens": 45000,
        "total_cost": 2.35,
        "by_date": [
            {
                "date": "2025-01-01",
                "requests": 10,
                "tokens": 3000,
                "cost": 0.15
            },
            ...
        ],
        "by_model": {
            "gpt-4": {"requests": 50, "tokens": 20000, "cost": 1.00},
            "claude-3-sonnet": {"requests": 100, "tokens": 25000, "cost": 1.35}
        },
        "by_provider": {
            "OpenAI": {"requests": 50, "tokens": 20000, "cost": 1.00},
            "Anthropic": {"requests": 100, "tokens": 25000, "cost": 1.35}
        },
        "period_days": 30
    }
    """
    try:
        user_id = current_user['id']
        logger.info(f"Fetching activity stats for user {user_id}, {days} days")

        stats = get_user_activity_stats(user_id, days)

        logger.info(f"Retrieved stats for user {user_id}: {stats['total_requests']} requests")

        return stats

    except Exception as e:
        logger.error(f"Error getting activity stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve activity statistics: {str(e)}"
        )


@router.get("/log")
async def get_activity_log(
    limit: int = Query(50, description="Maximum number of records", ge=1, le=1000),
    offset: int = Query(0, description="Number of records to skip", ge=0),
    model: Optional[str] = Query(None, description="Filter by model name"),
    provider: Optional[str] = Query(None, description="Filter by provider name"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get paginated activity log for the authenticated user

    Returns detailed activity records with:
    - Timestamp
    - Model and provider
    - Tokens used and cost
    - Speed (tokens/second)
    - Finish reason
    - Application name

    Args:
        limit: Maximum records to return (1-1000, default 50)
        offset: Records to skip for pagination (default 0)
        model: Optional model name filter
        provider: Optional provider name filter
        current_user: Authenticated user

    Returns:
        List of activity records

    Example response:
    {
        "activities": [
            {
                "id": 123,
                "user_id": 1,
                "timestamp": "2025-01-06T13:00:00Z",
                "model": "gpt-4",
                "provider": "OpenAI",
                "tokens": 1234,
                "cost": 0.0123,
                "speed": 45.67,
                "finish_reason": "stop",
                "app": "API",
                "metadata": {
                    "prompt_tokens": 234,
                    "completion_tokens": 1000
                }
            },
            ...
        ],
        "total": 150,
        "limit": 50,
        "offset": 0
    }
    """
    try:
        user_id = current_user['id']
        logger.info(f"Fetching activity log for user {user_id}, limit={limit}, offset={offset}")

        activities = get_user_activity_log(
            user_id=user_id,
            limit=limit,
            offset=offset,
            model_filter=model,
            provider_filter=provider
        )

        logger.info(f"Retrieved {len(activities)} activity records for user {user_id}")

        return {
            "activities": activities,
            "total": len(activities),  # TODO: Add count query for accurate total
            "limit": limit,
            "offset": offset,
            "filters": {
                "model": model,
                "provider": provider
            }
        }

    except Exception as e:
        logger.error(f"Error getting activity log: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve activity log: {str(e)}"
        )
