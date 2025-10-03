#!/usr/bin/env python3
"""
Ping Database Layer
Handles storage and retrieval of ping counts using PostgreSQL
"""

import logging
from typing import Optional
from datetime import datetime

from src.db_config import get_db_connection

logger = logging.getLogger(__name__)


def increment_ping_count() -> Optional[int]:
    """
    Increment the ping counter in PostgreSQL database

    Returns:
        Optional[int]: The new count after incrementing, or None if operation fails
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Increment count and update last_ping_at atomically
            cursor.execute("""
                UPDATE ping_stats 
                SET count = count + 1, 
                    last_ping_at = CURRENT_TIMESTAMP
                WHERE id = 1
                RETURNING count
            """)

            result = cursor.fetchone()
            cursor.close()

            if result:
                count = result[0]
                logger.info(f"Ping count incremented to: {count}")
                return count
            else:
                logger.error("Failed to increment ping count - no rows affected")
                return None

    except Exception as e:
        logger.error(f"Error incrementing ping count: {e}")
        return None


def get_ping_count() -> Optional[int]:
    """
    Get the current ping counter value from database

    Returns:
        Optional[int]: Current ping count, or None if operation fails
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT count FROM ping_stats WHERE id = 1
            """)

            result = cursor.fetchone()
            cursor.close()

            if result:
                return result[0]
            else:
                logger.warning("No ping count found in database")
                return 0

    except Exception as e:
        logger.error(f"Error getting ping count: {e}")
        return None


def get_ping_stats() -> Optional[dict]:
    """
    Get detailed ping statistics from database

    Returns:
        Optional[dict]: Statistics including count, last ping time, etc.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT count, last_ping_at, created_at, updated_at
                FROM ping_stats 
                WHERE id = 1
            """)

            result = cursor.fetchone()
            cursor.close()

            if result:
                return {
                    "count": result[0],
                    "last_ping_at": result[1].isoformat() if result[1] else None,
                    "created_at": result[2].isoformat() if result[2] else None,
                    "updated_at": result[3].isoformat() if result[3] else None
                }
            else:
                return None

    except Exception as e:
        logger.error(f"Error getting ping stats: {e}")
        return None


def reset_ping_count() -> bool:
    """
    Reset the ping counter to 0

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                UPDATE ping_stats 
                SET count = 0, 
                    last_ping_at = CURRENT_TIMESTAMP
                WHERE id = 1
            """)

            cursor.close()
            logger.info("Ping count reset to 0")
            return True

    except Exception as e:
        logger.error(f"Error resetting ping count: {e}")
        return False