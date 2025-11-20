"""Nebius AI client for API integration.

This module provides integration with Nebius AI models.
"""

import logging

# Initialize logging
logger = logging.getLogger(__name__)


def fetch_models_from_nebius():
    """Fetch models from Nebius API

    Nebius does not provide a public API to list available models.
    Returns None to indicate no dynamic model listing is available.
    """
    logger.info("Nebius does not provide a public model listing API")
    return None
