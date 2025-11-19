#!/usr/bin/env python3
"""
Webhook Event Tracking Database Module
Handles storage and retrieval of processed Stripe webhook events for idempotency
"""

import logging
from datetime import datetime, timezone
from typing import Any

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def is_event_processed(event_id: str) -> bool:
    """
    Check if a webhook event has already been processed

    Args:
        event_id: Stripe event ID (evt_xxx)

    Returns:
        True if event was already processed, False otherwise
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("stripe_webhook_events")
            .select("event_id")
            .eq("event_id", event_id)
            .execute()
        )

        exists = bool(result.data)
        if exists:
            logger.warning(f"Duplicate webhook event detected: {event_id}")

        return exists

    except Exception as e:
        logger.error(f"Error checking if event is processed: {e}", exc_info=True)
        # On error, default to False to allow processing
        # (Better to process twice than not at all)
        return False


def record_processed_event(
    event_id: str,
    event_type: str,
    user_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> bool:
    """
    Record that a webhook event has been processed

    Args:
        event_id: Stripe event ID (evt_xxx)
        event_type: Stripe event type (e.g., invoice.paid)
        user_id: User ID associated with the event (if applicable)
        metadata: Additional event metadata for debugging

    Returns:
        True if recorded successfully, False otherwise
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("stripe_webhook_events")
            .insert(
                {
                    "event_id": event_id,
                    "event_type": event_type,
                    "user_id": user_id,
                    "metadata": metadata or {},
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )

        if result.data:
            logger.info(f"Recorded processed webhook event: {event_id} ({event_type})")
            return True
        else:
            logger.error(f"Failed to record webhook event: {event_id}")
            return False

    except Exception as e:
        logger.error(f"Error recording processed event: {e}", exc_info=True)
        return False


def get_processed_event(event_id: str) -> dict[str, Any] | None:
    """
    Get details of a processed webhook event

    Args:
        event_id: Stripe event ID (evt_xxx)

    Returns:
        Event details if found, None otherwise
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("stripe_webhook_events").select("*").eq("event_id", event_id).execute()
        )

        if result.data:
            return result.data[0]
        return None

    except Exception as e:
        logger.error(f"Error getting processed event: {e}", exc_info=True)
        return None


def cleanup_old_events(days: int = 90) -> int:
    """
    Clean up old webhook events (older than specified days)

    Args:
        days: Number of days to keep events (default 90)

    Returns:
        Number of events deleted
    """
    try:
        client = get_supabase_client()

        # Calculate cutoff timestamp
        cutoff = datetime.now(timezone.utc).timestamp() - (days * 24 * 60 * 60)
        cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()

        # Delete old events
        result = (
            client.table("stripe_webhook_events").delete().lt("created_at", cutoff_dt).execute()
        )

        count = len(result.data) if result.data else 0
        logger.info(f"Cleaned up {count} old webhook events (older than {days} days)")

        return count

    except Exception as e:
        logger.error(f"Error cleaning up old events: {e}", exc_info=True)
        return 0
