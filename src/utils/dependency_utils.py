#!/usr/bin/env python3
"""
Dependency Utilities
Shared utilities for dependency injection and override execution
"""

import inspect
from collections.abc import Callable
from typing import Any

from fastapi import Request


async def execute_override(override: Callable[..., Any], request: Request | None = None) -> Any:
    """
    Execute a patched override function, handling optional request parameter and awaiting results.

    This utility consolidates the common pattern of executing override functions
    that may or may not accept a request parameter and may or may not be async.

    Args:
        override: The override function to execute
        request: Optional FastAPI request object

    Returns:
        The result of the override function execution
    """
    try:
        # Try to call with request parameter first
        if request is not None:
            result = override(request)
        else:
            result = override()
    except TypeError:
        # Support overrides that don't accept the request object
        result = override()

    # Handle async results
    if inspect.isawaitable(result):
        return await result
    return result
