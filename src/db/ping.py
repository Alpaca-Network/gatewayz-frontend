#!/usr/bin/env python3
"""
Ping Database Layer
Handles storage and retrieval of ping counts using Supabase
"""

import logging
from datetime import datetime

from src.config.supabase_config import get_supabase_client

from typing import Optional
logger = logging.getLogger(__name__)


def increment_ping_count() -> Optional[int]:
    """
    Increment the ping counter in Supabase database

    Returns:
        Optional[int]: The new count after incrementing, or None if operation fails
    """
    try:
        client = get_supabase_client()

        # Get current count
        result = client.table("ping_stats").select("count").eq("id", 1).execute()

        logger.debug(f"SELECT result: {result.data}")

        if result.data and len(result.data) > 0:
            current_count = result.data[0]["count"]
            new_count = current_count + 1

            # Update count
            update_result = (
                client.table("ping_stats")
                .update({"count": new_count, "last_ping_at": datetime.utcnow().isoformat()})
                .eq("id", 1)
                .execute()
            )

            logger.debug(f"UPDATE result: {update_result.data}")

            if update_result.data:
                logger.info(f"Ping count incremented to: {new_count}")
                return new_count
            else:
                logger.error(f"Update returned no data. Full response: {update_result}")
                return None
        else:
            logger.error(f"No row found with id=1. Result: {result.data}")
            # Try to initialize if row doesn't exist
            logger.info("Attempting to initialize ping_stats row...")
            init_ping_stats_table()
            return 0

    except Exception as e:
        logger.error(f"Error incrementing ping count: {e}", exc_info=True)
        return None


def get_ping_count() -> Optional[int]:
    """
    Get the current ping counter value from database

    Returns:
        Optional[int]: Current ping count, or None if operation fails
    """
    try:
        client = get_supabase_client()

        result = client.table("ping_stats").select("count").eq("id", 1).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["count"]
        else:
            logger.warning("No ping count found in database")
            return 0

    except Exception as e:
        logger.error(f"Error getting ping count: {e}", exc_info=True)
        return None


def get_ping_stats() -> Optional[dict]:
    """
    Get detailed ping statistics from database

    Returns:
        Optional[dict]: Statistics including count, last ping time, etc.
    """
    try:
        client = get_supabase_client()

        result = client.table("ping_stats").select("*").eq("id", 1).execute()

        if result.data and len(result.data) > 0:
            stats = result.data[0]
            return {
                "count": stats.get("count", 0),
                "last_ping_at": stats.get("last_ping_at"),
                "created_at": stats.get("created_at"),
                "updated_at": stats.get("updated_at"),
            }
        else:
            logger.warning("No ping stats found in database")
            return None

    except Exception as e:
        logger.error(f"Error getting ping stats: {e}", exc_info=True)
        return None


def reset_ping_count() -> bool:
    """
    Reset the ping counter to 0

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("ping_stats")
            .update({"count": 0, "last_ping_at": datetime.utcnow().isoformat()})
            .eq("id", 1)
            .execute()
        )

        if result.data:
            logger.info("Ping count reset to 0")
            return True
        return False

    except Exception as e:
        logger.error(f"Error resetting ping count: {e}", exc_info=True)
        return False


def init_ping_stats_table() -> bool:
    """
    Initialize ping_stats table in Supabase if needed

    Returns:
        bool: True if successful or already exists, False otherwise
    """
    try:
        client = get_supabase_client()

        # Check if row exists
        result = client.table("ping_stats").select("id").eq("id", 1).execute()

        logger.debug(f"Init check result: {result.data}")

        if not result.data or len(result.data) == 0:
            # Insert initial row
            insert_result = (
                client.table("ping_stats")
                .insert({"id": 1, "count": 0, "last_ping_at": datetime.utcnow().isoformat()})
                .execute()
            )

            logger.info(f"Ping stats initialized in Supabase. Result: {insert_result.data}")
            return True
        else:
            logger.info("Ping stats row already exists")
            return True

    except Exception as e:
        logger.error(f"Could not initialize ping stats: {e}", exc_info=True)
        return False
