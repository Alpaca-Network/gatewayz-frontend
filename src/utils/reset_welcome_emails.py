#!/usr/bin/.env python3
"""
Utility to reset welcome_email_sent field for users who should receive welcome emails
"""

import logging

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def reset_welcome_email_sent(user_id: int = None, all_users: bool = False) -> bool:
    """
    Reset welcome_email_sent field for users

    Args:
        user_id: Specific user ID to reset (optional)
        all_users: Reset for all users (optional)

    Returns:
        bool: Success status
    """
    try:
        client = get_supabase_client()

        if user_id:
            # Reset for specific user
            result = (
                client.table("users")
                .update({"welcome_email_sent": False})
                .eq("id", user_id)
                .execute()
            )

            if result.data:
                logger.info(f"Reset welcome_email_sent for user {user_id}")
                return True
            else:
                logger.error(f"User {user_id} not found")
                return False

        elif all_users:
            # Reset for all users
            result = client.table("users").update({"welcome_email_sent": False}).execute()

            logger.info("Reset welcome_email_sent for all users")
            return True

        else:
            logger.error("Must specify either user_id or all_users=True")
            return False

    except Exception as e:
        logger.error(f"Failed to reset welcome_email_sent: {e}")
        return False


def get_users_without_welcome_emails() -> list:
    """
    Get list of users who haven't received welcome emails

    Returns:
        list: List of user data
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("users")
            .select("id, username, email, welcome_email_sent")
            .eq("welcome_email_sent", False)
            .execute()
        )

        return result.data or []

    except Exception as e:
        logger.error(f"Failed to get users without welcome emails: {e}")
        return []


if __name__ == "__main__":
    # Example usage - configure logging for CLI execution
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger.info("Users without welcome emails:")
    users = get_users_without_welcome_emails()
    for user in users:
        logger.info(f"ID: {user['id']}, Username: {user['username']}, Email: {user['email']}")
