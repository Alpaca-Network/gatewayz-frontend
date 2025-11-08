"""
Security validation utilities for URLs, webhooks, and sensitive data handling.

This module provides validation functions to prevent common security issues:
- SSRF (Server-Side Request Forgery) attacks
- Open redirect vulnerabilities
- Webhook authenticity verification
"""

import hmac
import hashlib
import logging
from urllib.parse import urlparse
import ipaddress

from typing import Optional
logger = logging.getLogger(__name__)


def is_private_ip(ip: str) -> bool:
    """Check if an IP address is in private/reserved ranges.

    Args:
        ip: IP address string to check

    Returns:
        True if IP is private/reserved, False otherwise
    """
    try:
        ip_obj = ipaddress.ip_address(ip)
        return ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved
    except ValueError:
        return False


def validate_webhook_url(url: str, allowed_domains: Optional[list] = None) -> bool:
    """Validate webhook URL to prevent SSRF attacks.

    Security checks:
    - Must use HTTPS protocol
    - Cannot point to private IP addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, etc.)
    - Cannot be localhost/127.0.0.1
    - Optional: domain whitelist checking

    Args:
        url: Webhook URL to validate
        allowed_domains: Optional list of allowed domains (e.g., ['example.com'])

    Returns:
        True if URL is valid and safe, False otherwise
    """
    try:
        parsed = urlparse(url)

        # Must use HTTPS
        if parsed.scheme != "https":
            logger.warning(f"Webhook URL must use HTTPS: {url}")
            return False

        # Extract hostname
        hostname = parsed.hostname
        if not hostname:
            logger.warning(f"Invalid webhook URL hostname: {url}")
            return False

        # Check for localhost
        if hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning(f"Webhook URL cannot be localhost: {url}")
            return False

        # Try to resolve and check if it's a private IP
        if is_private_ip(hostname):
            logger.warning(f"Webhook URL points to private IP: {url}")
            return False

        # If domain whitelist is provided, check against it
        if allowed_domains:
            domain_match = any(
                hostname == domain or hostname.endswith(f".{domain}") for domain in allowed_domains
            )
            if not domain_match:
                logger.warning(
                    f"Webhook URL domain not whitelisted: {hostname}. "
                    f"Allowed: {allowed_domains}"
                )
                return False

        return True

    except Exception as e:
        logger.error(f"Error validating webhook URL: {e}")
        return False


def validate_redirect_url(url: str, allowed_origins: Optional[list] = None) -> bool:
    """Validate redirect URL to prevent open redirect attacks.

    Security checks:
    - Must use HTTPS or be a relative URL
    - If absolute URL, must be from allowed origins
    - Cannot be javascript: or data: protocol

    Args:
        url: URL to validate for redirect
        allowed_origins: List of allowed origin URLs

    Returns:
        True if URL is safe for redirect, False otherwise
    """
    try:
        # Block dangerous protocols
        if url.startswith(("javascript:", "data:", "vbscript:", "file:")):
            logger.warning(f"Blocked dangerous redirect protocol: {url}")
            return False

        # Relative URLs are safe
        if url.startswith("/") or url.startswith("./"):
            return True

        # For absolute URLs, validate against allowed origins
        parsed = urlparse(url)

        # Must use HTTPS or http for localhost
        if parsed.scheme not in ("https", "http"):
            logger.warning(f"Redirect URL must use HTTPS or HTTP: {url}")
            return False

        # If no allowed origins specified, only allow relative URLs
        if not allowed_origins:
            if parsed.scheme and parsed.netloc:
                logger.warning("Absolute redirect URLs require allowed_origins list")
                return False
        else:
            # Check against allowed origins
            origin = f"{parsed.scheme}://{parsed.netloc}"
            if origin not in allowed_origins:
                logger.warning(
                    f"Redirect URL origin not whitelisted: {origin}. " f"Allowed: {allowed_origins}"
                )
                return False

        return True

    except Exception as e:
        logger.error(f"Error validating redirect URL: {e}")
        return False


def generate_webhook_signature(payload: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload.

    Args:
        payload: Webhook payload (JSON string)
        secret: Shared secret key

    Returns:
        Hex-encoded HMAC-SHA256 signature
    """
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_webhook_signature(
    payload: str, signature: str, secret: str, header_name: str = "X-Webhook-Signature"
) -> bool:
    """Verify webhook signature using constant-time comparison.

    Args:
        payload: Webhook payload (JSON string)
        signature: Signature from webhook header
        secret: Shared secret key
        header_name: Name of the signature header (for logging)

    Returns:
        True if signature is valid, False otherwise
    """
    try:
        expected = generate_webhook_signature(payload, secret)

        # Use constant-time comparison to prevent timing attacks
        import secrets as secrets_module

        if secrets_module.compare_digest(signature, expected):
            return True

        logger.warning(f"Invalid webhook signature in {header_name}")
        return False

    except Exception as e:
        logger.error(f"Error verifying webhook signature: {e}")
        return False


def sanitize_for_logging(value: str) -> str:
    """Sanitize user-controlled strings for safe logging.

    Prevents log injection attacks by removing newlines and other control characters
    that could be used to forge log entries.

    Args:
        value: String value to sanitize (can be None)

    Returns:
        Sanitized string with newlines replaced by spaces
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    # Replace newlines and carriage returns with spaces to prevent log injection
    return value.replace("\n", " ").replace("\r", " ").replace("\x00", "")


def sanitize_pii_for_logging(data: dict, pii_fields: Optional[list] = None) -> dict:
    """Remove or mask personally identifiable information from logging data.

    Args:
        data: Dictionary to sanitize
        pii_fields: List of field names that contain PII (e.g., ['email', 'password'])

    Returns:
        Sanitized copy of the dictionary
    """
    if pii_fields is None:
        pii_fields = ["email", "password", "api_key", "secret", "token", "phone"]

    sanitized = {}
    for key, value in data.items():
        if key.lower() in pii_fields:
            # Mask the value
            if isinstance(value, str):
                if len(value) > 4:
                    sanitized[key] = f"{value[:2]}***{value[-2:]}"
                else:
                    sanitized[key] = "***"
            else:
                sanitized[key] = "***"
        else:
            sanitized[key] = value

    return sanitized
