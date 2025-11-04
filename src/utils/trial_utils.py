#!/usr/bin/env python3
"""
Trial Utilities
Shared utilities for trial access validation and tracking
"""

from typing import Any

# Import the actual trial module to avoid duplication
from src.services import trial_validation as trial_module


def validate_trial_access(*args, **kwargs) -> Any:
    """
    Validate trial access for a user.

    This is a shared wrapper around the trial validation service
    to avoid code duplication across multiple route modules.

    Args:
        *args: Positional arguments passed to the trial validation service
        **kwargs: Keyword arguments passed to the trial validation service

    Returns:
        Result from the trial validation service
    """
    return trial_module.validate_trial_access(*args, **kwargs)


def track_trial_usage(*args, **kwargs) -> Any:
    """
    Track trial usage for a user.

    This is a shared wrapper around the trial tracking service
    to avoid code duplication across multiple route modules.

    Args:
        *args: Positional arguments passed to the trial tracking service
        **kwargs: Keyword arguments passed to the trial tracking service

    Returns:
        Result from the trial tracking service
    """
    return trial_module.track_trial_usage(*args, **kwargs)
