"""
PostHog Analytics Service
Server-side PostHog integration to avoid ad-blocker issues
"""

import logging
import os
from typing import Any, Dict, Optional

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
            self.client: Optional[Posthog] = None
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

            # Initialize PostHog client with exception autocapture enabled
            self.client = Posthog(
                api_key,
                host=host,
                debug=os.getenv("POSTHOG_DEBUG", "false").lower() == "true",
                sync_mode=False,  # Use async mode for better performance
                enable_exception_autocapture=True,  # Enable automatic exception tracking
            )

            logger.info(f"PostHog initialized successfully with exception autocapture (host: {host})")

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
        properties: Optional[Dict[str, Any]] = None,
        groups: Optional[Dict[str, str]] = None,
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

    def identify(self, distinct_id: str, properties: Optional[Dict[str, Any]] = None):
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

    def capture_exception(
        self,
        exception: Exception,
        distinct_id: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
    ):
        """
        Manually capture an exception in PostHog

        Args:
            exception: The exception object to capture
            distinct_id: Optional unique identifier for the user
            properties: Optional additional properties to include
        """
        if not self.client:
            logger.debug(f"PostHog not initialized, skipping exception: {exception}")
            return

        try:
            # Use 'system' as default distinct_id if not provided
            user_id = distinct_id or "system"

            # Capture the exception
            self.client.capture_exception(
                exception, distinct_id=user_id, properties=properties or {}
            )
            logger.debug(f"Captured exception '{type(exception).__name__}' for user '{user_id}'")

        except Exception as e:
            logger.error(f"Failed to capture exception in PostHog: {e}")

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
