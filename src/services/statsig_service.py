"""
Statsig Service
===============

Server-side Statsig analytics integration using statsig-python-core SDK.
Handles event logging and feature flag management.

Documentation: https://docs.statsig.com/server/pythonSDK
"""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class StatsigService:
    """
    Statsig analytics service for server-side event logging.

    Uses the Statsig Python Core SDK to log events and manage feature flags.
    Falls back gracefully when STATSIG_SERVER_SECRET_KEY is not configured.

    SDK: statsig-python-core (Python 3.7+)
    Import: from statsig_python_core import Statsig, StatsigUser, StatsigOptions
    """

    def __init__(self):
        self.statsig = None
        self._initialized = False
        self.enabled = False
        self.server_secret_key = os.environ.get("STATSIG_SERVER_SECRET_KEY")

        if not self.server_secret_key:
            logger.warning(
                "⚠️  STATSIG_SERVER_SECRET_KEY not set - Statsig analytics disabled (using fallback)"
            )
            logger.info("   To enable: Set STATSIG_SERVER_SECRET_KEY in your .env file")
            logger.info(
                "   Get key from: https://console.statsig.com -> Project Settings -> API Keys -> Server Secret Key"
            )

    async def initialize(self):
        """
        Initialize the Statsig SDK with server secret key.

        This must be called during application startup (async context).
        Falls back to logging-only mode if SDK is not available or key is missing.

        Uses the Statsig Python Core SDK (statsig-python-core).
        """
        if self._initialized:
            logger.debug("Statsig already initialized")
            return

        if not self.server_secret_key:
            logger.warning("Statsig service not available - using fallback (no server secret key)")
            self._initialized = True
            return

        try:
            # Import Statsig Python Core SDK
            # Note: Package is statsig-python-core, but import uses underscores
            from statsig_python_core import Statsig, StatsigOptions, StatsigUser

            # Store reference to SDK classes
            self._Statsig = Statsig
            self._StatsigUser = StatsigUser
            self._StatsigOptions = StatsigOptions

            # Create Statsig options
            options = StatsigOptions()

            # Set environment tier
            app_env = os.environ.get("APP_ENV", "development")
            if app_env == "production":
                options.environment = "production"
            elif app_env == "staging":
                options.environment = "staging"
            else:
                options.environment = "development"

            # Initialize Statsig with server secret key
            self.statsig = Statsig(self.server_secret_key, options)

            # Wait for initialization to complete
            self.statsig.initialize().wait()

            self.enabled = True
            self._initialized = True

            logger.info("✅ Statsig SDK initialized successfully")
            logger.info(f"   Environment: {options.environment}")
            logger.info(f"   Server Key: {self.server_secret_key[:10]}...")

        except ImportError as e:
            logger.error(f"❌ Statsig SDK not installed: {e}")
            logger.error("   Install with: pip install statsig-python-core")
            logger.error(
                "   Note: Package name is 'statsig-python-core' but import uses 'statsig_python_core'"
            )
            logger.warning("   Falling back to logging-only mode")
            self._initialized = True

        except Exception as e:
            logger.error(f"❌ Failed to initialize Statsig: {e}")
            logger.warning("   Falling back to logging-only mode")
            import traceback

            logger.error(f"   Traceback:\n{traceback.format_exc()}")
            self._initialized = True

    def log_event(
        self,
        user_id: str,
        event_name: str,
        value: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """
        Log an event to Statsig.

        Args:
            user_id: User identifier (required)
            event_name: Name of the event (required)
            value: Optional event value (e.g., SKU, product ID)
            metadata: Optional event metadata/properties (e.g., price, item_name)

        Returns:
            True if logged successfully, False otherwise

        Example:
            statsig_service.log_event(
                user_id="user123",
                event_name="add_to_cart",
                value="SKU_12345",
                metadata={"price": "9.99", "item_name": "diet_coke_48_pack"}
            )
        """
        try:
            if self.enabled and self.statsig:
                # Create Statsig user
                user = self._StatsigUser(user_id)

                # Log event to Statsig
                self.statsig.log_event(
                    user=user, event_name=event_name, value=value, metadata=metadata
                )

                logger.debug(f"📊 Statsig event logged: {event_name} (user: {user_id})")
                return True
            else:
                # Fallback: Just log to console
                logger.info(f"📊 [Fallback] Analytics event: {event_name} (user: {user_id})")
                if value:
                    logger.debug(f"   Value: {value}")
                if metadata:
                    logger.debug(f"   Metadata: {metadata}")
                return True

        except Exception as e:
            logger.error(f"❌ Failed to log Statsig event '{event_name}': {e}")
            import traceback

            logger.error(f"   Traceback:\n{traceback.format_exc()}")
            return False

    def get_feature_flag(self, flag_name: str, user_id: str, default_value: bool = False) -> bool:
        """
        Get a feature flag value for a user.

        Args:
            flag_name: Name of the feature flag (gate)
            user_id: User identifier
            default_value: Default value if flag is not found or SDK is disabled

        Returns:
            Feature flag value (bool)

        Example:
            enabled = statsig_service.get_feature_flag(
                flag_name="new_chat_ui",
                user_id="user123",
                default_value=False
            )
        """
        try:
            if self.enabled and self.statsig:
                user = self._StatsigUser(user_id)
                return self.statsig.check_gate(user, flag_name)
            else:
                logger.debug(f"Feature flag '{flag_name}' -> {default_value} (fallback)")
                return default_value

        except Exception as e:
            logger.error(f"❌ Failed to check feature flag '{flag_name}': {e}")
            return default_value

    async def shutdown(self):
        """
        Gracefully shutdown Statsig SDK.

        Flushes any pending events before shutdown.
        Should be called during application shutdown.
        """
        if self.enabled and self.statsig:
            try:
                logger.info("🛑 Shutting down Statsig SDK...")
                self.statsig.shutdown()
                logger.info("✅ Statsig shutdown complete")
            except Exception as e:
                logger.warning(f"⚠️  Statsig shutdown warning: {e}")

        self._initialized = False
        self.enabled = False


# Global singleton instance
statsig_service = StatsigService()
