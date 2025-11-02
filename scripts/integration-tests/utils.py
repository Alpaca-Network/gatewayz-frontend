"""
Common utilities for integration test scripts.

This module provides shared functionality for manual integration testing scripts.
"""

import os
import sys
from dotenv import load_dotenv


def load_env_file() -> None:
    """Load environment variables from .env file if it exists."""
    if os.path.exists('.env'):
        load_dotenv()
    else:
        # Fallback: manually parse .env if dotenv not available
        if os.path.exists('.env'):
            with open('.env', 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key] = value


def get_env_or_exit(key: str, description: str = "") -> str:
    """Get environment variable or exit with an error message.

    Args:
        key: The environment variable name
        description: Optional description for the error message

    Returns:
        The environment variable value

    Raises:
        SystemExit: If the environment variable is not set
    """
    value = os.environ.get(key)
    if not value:
        error_msg = f"✗ {key} is not set"
        if description:
            error_msg = f"{error_msg} ({description})"
        print(f"ERROR: {error_msg}")
        sys.exit(1)
    return value


def print_section(title: str, width: int = 70) -> None:
    """Print a formatted section header.

    Args:
        title: The section title
        width: The width of the separator line
    """
    print("\n" + "=" * width)
    print(title)
    print("=" * width)


def print_test_result(test_name: str, passed: bool, message: str = "") -> None:
    """Print a formatted test result.

    Args:
        test_name: Name of the test
        passed: Whether the test passed
        message: Optional additional message
    """
    symbol = "✓" if passed else "✗"
    status = "PASSED" if passed else "FAILED"
    print(f"{symbol} {test_name}: {status}")
    if message:
        print(f"  {message}")
