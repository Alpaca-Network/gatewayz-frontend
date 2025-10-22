"""
Statsig Service (Optional)
=========================

Simple fallback for analytics when Statsig is not available.
"""

import logging

logger = logging.getLogger(__name__)

class StatsigService:
    """Simple fallback for Statsig analytics"""
    
    def __init__(self):
        self.enabled = False
        logger.warning("Statsig service not available - using fallback")
    
    def log_event(self, event_name: str, user_id: str = None, properties: dict = None):
        """Log event (fallback implementation)"""
        logger.info(f"Analytics event: {event_name} (user: {user_id})")
        return True
    
    def get_feature_flag(self, flag_name: str, user_id: str = None, default_value: bool = False):
        """Get feature flag (fallback implementation)"""
        return default_value

# Global instance
statsig_service = StatsigService()