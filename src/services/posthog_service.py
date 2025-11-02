"""
PostHog Analytics Service
Server-side PostHog integration to avoid ad-blocker issues
"""

import logging
import os
from typing import Any, Optional

from posthog import Posthog

logger = logging.getLogger(__name__)


class PostHogService:
    """Singleton service for PostHog analytics"""

    _instance: Optional["PostHogService"] = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.client: Posthog | None = None
            self._initialized = True

    def initialize(self):
        """Initialize PostHog with API key and host"""
        try:
            api_key = os.getenv("POSTHOG_API_KEY")
            host = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")

            if not api_key:
                logger.warning(
                    "POSTHOG_API_KEY not found in environment variables. PostHog analytics will be disabled."
                )
                return

            # Initialize PostHog client
            self.client = Posthog(
                api_key,
                host=host,
                debug=os.getenv("POSTHOG_DEBUG", "false").lower() == "true",
                sync_mode=False,  # Use async mode for better performance
            )

            logger.info(f"PostHog initialized successfully (host: {host})")

        except Exception as e:
            logger.error(f"Failed to initialize PostHog: {e}")
            self.client = None

    def shutdown(self):
        """Shutdown PostHog gracefully"""
        if self.client:
            try:
                self.client.shutdown()
                logger.info("PostHog shutdown successfully")
            except Exception as e:
                logger.error(f"Error shutting down PostHog: {e}")

    def capture(
        self,
        distinct_id: str,
        event: str,
        properties: dict[str, Any] | None = None,
        groups: dict[str, str] | None = None,
    ):
        """
        Capture an analytics event in PostHog

        Args:
            distinct_id: Unique identifier for the user (can be Privy ID, user_id, or 'anonymous')
            event: Name of the event (e.g., 'chat_message_sent')
            properties: Optional event properties dict
            groups: Optional group associations dict
        """
        if not self.client:
            logger.debug(f"PostHog not initialized, skipping event: {event}")
            return

        try:
            self.client.capture(
                distinct_id=distinct_id, event=event, properties=properties or {}, groups=groups
            )
            logger.debug(f"Captured event '{event}' for user '{distinct_id}'")

        except Exception as e:
            logger.error(f"Failed to capture PostHog event '{event}': {e}")

    def identify(self, distinct_id: str, properties: dict[str, Any] | None = None):
        """
        Identify a user and set their properties in PostHog

        Args:
            distinct_id: Unique identifier for the user
            properties: User properties to set
        """
        if not self.client:
            logger.debug(f"PostHog not initialized, skipping identify: {distinct_id}")
            return

        try:
            self.client.identify(distinct_id=distinct_id, properties=properties or {})
            logger.debug(f"Identified user '{distinct_id}'")

        except Exception as e:
            logger.error(f"Failed to identify user '{distinct_id}': {e}")

    def flush(self):
        """Flush pending events to PostHog (useful for testing)"""
        if self.client:
            try:
                self.client.flush()
                logger.debug("PostHog events flushed")
            except Exception as e:
                logger.error(f"Failed to flush PostHog events: {e}")


# Global instance
posthog_service = PostHogService()
