#!/usr/bin/.env python3
"""
Ping Routes
HTTP endpoints for ping operations
"""

import logging
from fastapi import APIRouter, HTTPException

from src.services.ping import get_ping_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/ping")
async def ping():
    """
    Ping endpoint that returns 'pong' and the number of times it has been called.

    Returns:
        dict: Response with message 'pong' and the total count of pings

    Example response:
        {
            "message": "pong",
            "count": 42,
            "timestamp": "2025-10-02T10:30:00.000000"
        }
    """
    try:
        ping_service = get_ping_service()
        response = ping_service.handle_ping()

        return response

    except Exception as e:
        logger.error(f"Error in ping endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while processing ping"
        )


@router.get("/ping/stats")
async def ping_stats():
    """
    Get ping statistics.

    Returns:
        dict: Statistics about ping usage

    Example response:
        {
            "total_pings": 42,
            "timestamp": "2025-10-02T10:30:00.000000"
        }
    """
    try:
        ping_service = get_ping_service()
        stats = ping_service.get_statistics()

        return stats

    except Exception as e:
        logger.error(f"Error getting ping stats: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving statistics"
        )