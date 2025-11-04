"""
Activity Tracking Routes
Endpoints for retrieving user activity statistics and logs
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.db.activity import get_user_activity_log, get_user_activity_stats
from src.security.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user/activity", tags=["Activity"])


@router.get("/stats")
async def get_activity_stats(
    days: int | None = Query(None, description="Number of days to look back", ge=1, le=365),
    from_date: str | None = Query(None, alias="from", description="Start date (YYYY-MM-DD)"),
    to_date: str | None = Query(None, alias="to", description="End date (YYYY-MM-DD)"),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    Get aggregated activity statistics for the authenticated user

    Returns activity stats including:
    - Total requests, tokens, and spend
    - Data aggregated by date (daily_stats)
    - Breakdown by model
    - Breakdown by provider

    Args:
        from_date: Start date in YYYY-MM-DD format (optional)
        to_date: End date in YYYY-MM-DD format (optional)
        days: Number of days to look back (alternative to from/to, default 30)
        current_user: Authenticated user

    Returns:
        Activity statistics

    Example response:
    {
        "total_requests": 150,
        "total_tokens": 45000,
        "total_spend": 2.35,
        "daily_stats": [
            {
                "date": "2025-01-01",
                "spend": 0.15,
                "tokens": 3000,
                "requests": 10
            },
            ...
        ]
    }
    """
    try:
        user_id = current_user["id"]
        logger.info(
            f"Fetching activity stats for user {user_id}, from={from_date}, to={to_date}, days={days}"
        )

        stats = get_user_activity_stats(user_id, from_date=from_date, to_date=to_date, days=days)

        logger.info(f"Retrieved stats for user {user_id}: {stats['total_requests']} requests")

        return stats

    except Exception as e:
        logger.error(f"Error getting activity stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve activity statistics: {str(e)}"
        ) from e


@router.get("/log")
async def get_activity_log(
    limit: int = Query(10, description="Maximum number of records", ge=1, le=1000),
    offset: int = Query(0, description="Number of records to skip", ge=0),
    page: int | None = Query(None, description="Page number (alternative to offset)", ge=1),
    from_date: str | None = Query(None, alias="from", description="Start date (YYYY-MM-DD)"),
    to_date: str | None = Query(None, alias="to", description="End date (YYYY-MM-DD)"),
    model: str | None = Query(None, description="Filter by model name"),
    provider: str | None = Query(None, description="Filter by provider name"),
    current_user: dict[str, Any] = Depends(get_current_user),
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
        limit: Maximum records to return (1-1000, default 10)
        offset: Records to skip for pagination (default 0)
        page: Page number (alternative to offset, starts at 1)
        from_date: Start date in YYYY-MM-DD format (optional)
        to_date: End date in YYYY-MM-DD format (optional)
        model: Optional model name filter
        provider: Optional provider name filter
        current_user: Authenticated user

    Returns:
        Object with logs array and metadata

    Example response:
    {
        "logs": [
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
                "app": "API"
            },
            ...
        ],
        "total": 150,
        "page": 1,
        "limit": 10
    }
    """
    try:
        user_id = current_user["id"]

        # Convert page to offset if provided
        if page is not None:
            offset = (page - 1) * limit

        logger.info(
            f"Fetching activity log for user {user_id}, limit={limit}, offset={offset}, from={from_date}, to={to_date}"
        )

        activities = get_user_activity_log(
            user_id=user_id,
            limit=limit,
            offset=offset,
            from_date=from_date,
            to_date=to_date,
            model_filter=model,
            provider_filter=provider,
        )

        logger.info(f"Retrieved {len(activities)} activity records for user {user_id}")

        # Frontend expects 'logs' not 'activities'
        return {
            "logs": activities,
            "total": len(activities),
            "page": page if page else (offset // limit) + 1,
            "limit": limit,
        }

    except Exception as e:
        logger.error(f"Error getting activity log: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve activity log: {str(e)}"
        ) from e
