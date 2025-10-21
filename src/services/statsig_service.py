"""
Statsig Analytics Service
Server-side Statsig integration to avoid ad-blocker issues
"""

import os
import logging
from typing import Optional, Dict, Any
from statsig_python_core import Statsig, StatsigOptions, StatsigUser

logger = logging.getLogger(__name__)

class StatsigService:
    """Singleton service for Statsig analytics"""

    _instance: Optional['StatsigService'] = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.statsig = None
            self._initialized = True

    async def initialize(self):
        """Initialize Statsig with server secret key"""
        try:
            secret_key = os.getenv('STATSIG_SERVER_SECRET_KEY')

            if not secret_key:
                logger.warning("STATSIG_SERVER_SECRET_KEY not found in environment variables. Analytics will be disabled.")
                return

            options = StatsigOptions()
            options.environment = os.getenv('ENVIRONMENT', 'development')

            self.statsig = Statsig(secret_key, options)
            await self.statsig.initialize()

            logger.info(f"Statsig initialized successfully in {options.environment} environment")

        except Exception as e:
            logger.error(f"Failed to initialize Statsig: {e}")
            self.statsig = None

    async def shutdown(self):
        """Shutdown Statsig gracefully"""
        if self.statsig:
            try:
                await self.statsig.shutdown()
                logger.info("Statsig shutdown successfully")
            except Exception as e:
                logger.error(f"Error shutting down Statsig: {e}")

    def log_event(
        self,
        user_id: str,
        event_name: str,
        value: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log an analytics event to Statsig

        Args:
            user_id: The user identifier (can be Privy ID, user_id, or 'anonymous')
            event_name: Name of the event (e.g., 'chat_message_sent')
            value: Optional event value
            metadata: Optional metadata dict
        """
        if not self.statsig:
            logger.debug(f"Statsig not initialized, skipping event: {event_name}")
            return

        try:
            user = StatsigUser(user_id=user_id)
            self.statsig.log_event(
                user=user,
                event_name=event_name,
                value=value,
                metadata=metadata
            )
            logger.debug(f"Logged event '{event_name}' for user '{user_id}'")

        except Exception as e:
            logger.error(f"Failed to log Statsig event '{event_name}': {e}")

    def flush(self):
        """Flush pending events to Statsig (useful for testing)"""
        if self.statsig:
            try:
                self.statsig.flush()
            except Exception as e:
                logger.error(f"Failed to flush Statsig events: {e}")


# Global instance
statsig_service = StatsigService()
