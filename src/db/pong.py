#!/usr/bin/env python3
"""
Ping Database Layer
Handles database operations for ping tracking
"""

import logging
from typing import Optional
from datetime import datetime

from src.supabase_config import get_db_client

logger = logging.getLogger(__name__)


def increment_ping_count() -> Optional[int]:
    """
    Increments the ping count in the database and returns the total count.
    Creates the ping_stats table if it doesn't exist.

    Returns:
        Optional[int]: Total ping count, or None if operation fails
    """
    try:
        supabase = get_db_client()

        # First, try to get the current count
        result = supabase.table("ping_stats").select("id, count").eq("id", 1).execute()

        if result.data and len(result.data) > 0:
            # Update existing record
            current_count = result.data[0]["count"]
            new_count = current_count + 1

            update_result = supabase.table("ping_stats").update({
                "count": new_count,
                "last_ping_at": datetime.utcnow().isoformat()
            }).eq("id", 1).execute()

            return new_count
        else:
            # Create initial record
            insert_result = supabase.table("ping_stats").insert({
                "id": 1,
                "count": 1,
                "last_ping_at": datetime.utcnow().isoformat()
            }).execute()

            return 1

    except Exception as e:
        logger.error(f"Failed to increment ping count: {e}")
        return None


def get_ping_count() -> Optional[int]:
    """
    Get the current ping count from the database.

    Returns:
        Optional[int]: Current ping count, or None if operation fails
    """
    try:
        supabase = get_db_client()
        result = supabase.table("ping_stats").select("count").eq("id", 1).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["count"]
        return 0

    except Exception as e:
        logger.error(f"Failed to get ping count: {e}")
        return None


def reset_ping_count() -> bool:
    """
    Reset the ping count to zero.

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        supabase = get_db_client()
        result = supabase.table("ping_stats").update({
            "count": 0,
            "last_ping_at": datetime.utcnow().isoformat()
        }).eq("id", 1).execute()

        return True

    except Exception as e:
        logger.error(f"Failed to reset ping count: {e}")
        return False