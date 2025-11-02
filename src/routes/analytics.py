"""
Analytics API Routes
Server-side endpoint for logging analytics events to Statsig and PostHog
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.security.deps import get_current_user
from src.services.posthog_service import posthog_service
from src.services.statsig_service import statsig_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/analytics", tags=["analytics"])


class AnalyticsEvent(BaseModel):
    """Analytics event model"""

    event_name: str = Field(..., description="Event name (e.g., 'chat_message_sent')")
    user_id: str | None = Field(
        None, description="User ID (optional, will use authenticated user if not provided)"
    )
    value: str | None = Field(None, description="Optional event value")
    metadata: dict[str, Any] | None = Field(None, description="Optional event metadata")


@router.post("/events")
async def log_event(event: AnalyticsEvent, current_user: dict | None = Depends(get_current_user)):
    """
    Log an analytics event to both Statsig and PostHog via backend

    This endpoint allows the frontend to send analytics events to the backend,
    which then forwards them to both analytics platforms. This avoids ad-blocker issues.

    Args:
        event: The analytics event to log
        current_user: Authenticated user (from auth middleware)

    Returns:
        Success message
    """
    try:
        # Determine user ID (prefer authenticated user, fallback to provided user_id or 'anonymous')
        user_id = "anonymous"

        if current_user:
            user_id = str(current_user.get("user_id", "anonymous"))
        elif event.user_id:
            user_id = event.user_id

        # Log event to Statsig
        statsig_service.log_event(
            user_id=user_id, event_name=event.event_name, value=event.value, metadata=event.metadata
        )

        # Log event to PostHog
        posthog_service.capture(
            distinct_id=user_id, event=event.event_name, properties=event.metadata
        )

        return {"success": True, "message": f"Event '{event.event_name}' logged successfully"}

    except Exception as e:
        logger.error(f"Failed to log analytics event: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to log analytics event: {str(e)}"
        ) from e


@router.post("/batch")
async def log_batch_events(
    events: list[AnalyticsEvent], current_user: dict | None = Depends(get_current_user)
):
    """
    Log multiple analytics events in batch to both Statsig and PostHog

    Args:
        events: List of analytics events to log
        current_user: Authenticated user (from auth middleware)

    Returns:
        Success message with count
    """
    try:
        # Determine user ID
        user_id = "anonymous"
        if current_user:
            user_id = str(current_user.get("user_id", "anonymous"))

        # Log each event to both platforms
        for event in events:
            event_user_id = event.user_id or user_id

            # Log to Statsig
            statsig_service.log_event(
                user_id=event_user_id,
                event_name=event.event_name,
                value=event.value,
                metadata=event.metadata,
            )

            # Log to PostHog
            posthog_service.capture(
                distinct_id=event_user_id, event=event.event_name, properties=event.metadata
            )

        return {"success": True, "message": f"{len(events)} events logged successfully"}

    except Exception as e:
        logger.error(f"Failed to log batch analytics events: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to log batch analytics events: {str(e)}"
        ) from e
