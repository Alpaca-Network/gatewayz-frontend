"""
Simple input validators for lightweight, explicit checks.

Design goals:
- Keep code minimal and easy to read
- No changes to endpoint params or response types
- Use standard exceptions (ValueError) for call sites to handle
"""

import re
from typing import Any, Iterable


def ensure_non_empty_string(value: Any, field_name: str) -> None:
    """Validate that a value is a non-empty string (after stripping)."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string")


def ensure_min_length(value: str, min_length: int, field_name: str) -> None:
    """Validate that a string has at least min_length characters."""
    if not isinstance(value, str) or len(value) < min_length:
        raise ValueError(f"{field_name} must be at least {min_length} characters long")


def ensure_max_length(value: str, max_length: int, field_name: str) -> None:
    """Validate that a string does not exceed max_length characters."""
    if not isinstance(value, str) or len(value) > max_length:
        raise ValueError(f"{field_name} must be at most {max_length} characters long")


def ensure_positive_number(value: Any, field_name: str, allow_zero: bool = True) -> None:
    """Validate that a numeric value is positive (optionally allowing zero)."""
    try:
        num = float(value)
    except Exception:
        raise ValueError(f"{field_name} must be a number")
    if allow_zero:
        if num < 0:
            raise ValueError(f"{field_name} must be >= 0")
    else:
        if num <= 0:
            raise ValueError(f"{field_name} must be > 0")


def ensure_in_choices(value: Any, choices: Iterable[Any], field_name: str) -> None:
    """Validate that a value belongs to an allowed set."""
    if value not in choices:
        raise ValueError(f"{field_name} must be one of {list(choices)}")


_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def ensure_valid_email(value: str, field_name: str = "email") -> None:
    """Validate a basic email format (simple regex, lightweight)."""
    if not isinstance(value, str) or not _EMAIL_RE.match(value):
        raise ValueError(f"{field_name} is not a valid email")


def ensure_api_key_like(value: str, field_name: str = "api key", min_length: int = 10) -> None:
    """Lightweight check that a key looks like an API key (length + no spaces)."""
    if not isinstance(value, str) or len(value) < min_length or (" " in value):
        raise ValueError(f"{field_name} is invalid")


