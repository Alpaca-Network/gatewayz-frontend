"""
Portkey SDK wrapper service for accessing individual AI providers through Portkey's gateway.

This service uses the Portkey Python SDK to access each provider (Google, Cerebras, Nebius, Xai, Novita, Hug)
instead of using the unified Portkey models endpoint.

Each provider is accessed individually to:
1. Get their full model catalog (no 500-model limit)
2. Track provider attribution accurately
3. Leverage Portkey SDK features (tracing, metadata, etc.)
"""

import logging
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

try:
    from portkey_ai import Portkey
except ImportError:
    Portkey = None

from src.config import Config

logger = logging.getLogger(__name__)

# Provider configurations
PROVIDERS = {
    'google': {
        'name': 'Google',
        'provider_slug': 'google',
        'models_endpoint': 'https://generativelanguage.googleapis.com/v1beta/models',
        'description': 'Google AI models via Portkey'
    },
    'cerebras': {
        'name': 'Cerebras',
        'provider_slug': 'cerebras',
        'description': 'Cerebras models via Portkey'
    },
    'nebius': {
        'name': 'Nebius',
        'provider_slug': 'nebius',
        'description': 'Nebius models via Portkey'
    },
    'xai': {
        'name': 'Xai',
        'provider_slug': 'xai',
        'description': 'Xai models via Portkey'
    },
    'novita': {
        'name': 'Novita',
        'provider_slug': 'novita',
        'description': 'Novita models via Portkey'
    },
    'hug': {
        'name': 'Hugging Face',
        'provider_slug': 'huggingface',
        'description': 'Hugging Face models via Portkey'
    },
}


class PortkeySDKService:
    """Service for accessing AI providers through Portkey SDK"""

    def __init__(self):
        """Initialize Portkey SDK service"""
        if not Portkey:
            logger.error("Portkey SDK not installed. Install with: pip install portkey-ai")
            raise ImportError("portkey-ai SDK required but not installed")

        self.api_key = Config.PORTKEY_API_KEY
        if not self.api_key:
            logger.error("PORTKEY_API_KEY not configured")
            raise ValueError("PORTKEY_API_KEY environment variable not set")

        logger.info("Portkey SDK service initialized")

    def get_client(self, provider: str) -> Optional[Portkey]:
        """
        Get a Portkey client configured for a specific provider.

        Args:
            provider: Provider name (e.g., 'google', 'cerebras', 'openrouter', 'deepinfra')

        Returns:
            Configured Portkey client or None if provider config not found
        """
        try:
            # Map provider names to Portkey provider slugs
            provider_config = {
                'google': 'google',
                'cerebras': 'cerebras',
                'nebius': 'nebius',
                'xai': 'xai',
                'novita': 'novita',
                'hug': 'huggingface',
                'openrouter': 'openrouter',
                'deepinfra': 'deepinfra',
            }

            portkey_provider = provider_config.get(provider.lower())
            if not portkey_provider:
                logger.warning(f"Unknown provider: {provider}")
                return None

            # Create Portkey client for this provider
            client = Portkey(
                api_key=self.api_key,
                provider=portkey_provider,
                # Add tracing for observability
                trace_id=f"gatewayz-{provider}-{datetime.now(timezone.utc).timestamp()}",
            )

            logger.debug(f"Created Portkey client for provider: {provider}")
            return client

        except Exception as e:
            logger.error(f"Error creating Portkey client for provider {provider}: {e}")
            return None

    async def list_models(self, provider: str) -> List[Dict[str, Any]]:
        """
        List available models for a provider via Portkey SDK.

        Args:
            provider: Provider name

        Returns:
            List of model objects from the provider
        """
        try:
            client = self.get_client(provider)
            if not client:
                logger.error(f"Could not get Portkey client for provider: {provider}")
                return []

            # Use Portkey SDK to list models
            # Note: This calls through Portkey's gateway to the provider's API
            models = client.models.list()

            if hasattr(models, 'data'):
                model_list = models.data
            else:
                model_list = models if isinstance(models, list) else []

            logger.info(f"Retrieved {len(model_list)} models from {provider} via Portkey SDK")
            return model_list

        except Exception as e:
            logger.error(f"Error listing models from {provider}: {e}", exc_info=True)
            return []

    async def test_provider_connection(self, provider: str) -> bool:
        """
        Test if a provider is accessible via Portkey SDK.

        Args:
            provider: Provider name

        Returns:
            True if connection successful, False otherwise
        """
        try:
            client = self.get_client(provider)
            if not client:
                logger.warning(f"Could not create client for provider: {provider}")
                return False

            # Try to list models as a connection test
            models = await self.list_models(provider)
            is_accessible = len(models) > 0

            status = "accessible" if is_accessible else "no models returned"
            logger.info(f"Provider {provider} is {status}")

            return is_accessible

        except Exception as e:
            logger.warning(f"Error testing connection to {provider}: {e}")
            return False


# Singleton instance
_portkey_service: Optional[PortkeySDKService] = None


def get_portkey_service() -> PortkeySDKService:
    """Get or create the Portkey SDK service singleton"""
    global _portkey_service
    if _portkey_service is None:
        try:
            _portkey_service = PortkeySDKService()
        except Exception as e:
            logger.error(f"Failed to initialize Portkey SDK service: {e}")
            raise
    return _portkey_service
