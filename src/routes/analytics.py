"""
Analytics API Routes
Server-side endpoint for logging analytics events to Statsig
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging

from src.services.statsig_service import statsig_service
from src.security.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/v1/analytics",
    tags=["analytics"]
)


class AnalyticsEvent(BaseModel):
    """Analytics event model"""
    event_name: str = Field(..., description="Event name (e.g., 'chat_message_sent')")
    user_id: Optional[str] = Field(None, description="User ID (optional, will use authenticated user if not provided)")
    value: Optional[str] = Field(None, description="Optional event value")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional event metadata")


@router.post("/events")
async def log_event(
    event: AnalyticsEvent,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Log an analytics event to Statsig via backend

    This endpoint allows the frontend to send analytics events to the backend,
    which then forwards them to Statsig. This avoids ad-blocker issues.

    Args:
        event: The analytics event to log
        current_user: Authenticated user (from auth middleware)

    Returns:
        Success message
    """
    try:
        # Determine user ID (prefer authenticated user, fallback to provided user_id or 'anonymous')
        user_id = 'anonymous'

        if current_user:
            user_id = str(current_user.get('user_id', 'anonymous'))
        elif event.user_id:
            user_id = event.user_id

        # Log event to Statsig
        statsig_service.log_event(
            user_id=user_id,
            event_name=event.event_name,
            value=event.value,
            metadata=event.metadata
        )

        return {
            "success": True,
            "message": f"Event '{event.event_name}' logged successfully"
        }

    except Exception as e:
        logger.error(f"Failed to log analytics event: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to log analytics event: {str(e)}"
        )


@router.post("/batch")
async def log_batch_events(
    events: list[AnalyticsEvent],
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Log multiple analytics events in batch

    Args:
        events: List of analytics events to log
        current_user: Authenticated user (from auth middleware)

    Returns:
        Success message with count
    """
    try:
        # Determine user ID
        user_id = 'anonymous'
        if current_user:
            user_id = str(current_user.get('user_id', 'anonymous'))

        # Log each event
        for event in events:
            event_user_id = event.user_id or user_id

            statsig_service.log_event(
                user_id=event_user_id,
                event_name=event.event_name,
                value=event.value,
                metadata=event.metadata
            )

        return {
            "success": True,
            "message": f"{len(events)} events logged successfully"
        }

    except Exception as e:
        logger.error(f"Failed to log batch analytics events: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to log batch analytics events: {str(e)}"
        )
