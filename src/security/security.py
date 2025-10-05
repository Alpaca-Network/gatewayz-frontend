#!/usr/bin/env python3
"""
Advanced Security Module
Implements secure key validation, hashing, IP/domain validation, and audit logging
"""

import hashlib
import hmac
import secrets
import logging
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from cryptography.fernet import Fernet
import base64

logger = logging.getLogger(__name__)


# ==================== Key Generation & Hashing ====================

def _generate_encryption_key() -> str:
    """Generate a new Fernet encryption key"""
    return Fernet.generate_key().decode()


def hash_api_key(api_key: str) -> str:
    """
    Create a secure hash of an API key using HMAC-SHA256

    Args:
        api_key: API key to hash

    Returns:
        Hexadecimal hash string
    """
    try:
        salt = os.environ.get("API_GATEWAY_SALT", "api_gateway_salt_2024").encode()
        hash_obj = hmac.new(salt, api_key.encode("utf-8"), hashlib.sha256)
        return hash_obj.hexdigest()
    except Exception as e:
        logger.error(f"Error hashing API key: {e}")
        raise


def generate_secure_api_key(environment_tag: str = 'live', key_length: int = 32) -> str:
    """
    Generate a cryptographically secure API key with environment prefix

    Args:
        environment_tag: Environment ('live', 'test', 'staging', 'development')
        key_length: Length of random part (default: 32)

    Returns:
        API key string with prefix (e.g., 'gw_live_...')
    """
    try:
        random_part = secrets.token_urlsafe(key_length)

        prefix_map = {
            'test': 'gw_test_',
            'staging': 'gw_staging_',
            'development': 'gw_dev_',
            'live': 'gw_live_'
        }

        prefix = prefix_map.get(environment_tag, 'gw_live_')
        return prefix + random_part

    except Exception as e:
        logger.error(f"Error generating secure API key: {e}")
        raise


# ==================== IP & Domain Validation ====================

def _ip_in_cidr(ip: str, cidr: str) -> bool:
    """
    Check if IP is in CIDR range

    Note: This is a simplified implementation.
    For production, use the `ipaddress` module for proper CIDR checking.
    """
    try:
        if '/' not in cidr:
            return ip == cidr

        # For CIDR ranges, use ipaddress module
        import ipaddress
        ip_obj = ipaddress.ip_address(ip)
        network = ipaddress.ip_network(cidr, strict=False)
        return ip_obj in network

    except Exception as e:
        logger.error(f"Error checking CIDR: {e}")
        return False


def validate_ip_allowlist(client_ip: str, allowed_ips: List[str]) -> bool:
    """
    Validate if client IP is in the allowlist

    Args:
        client_ip: Client's IP address
        allowed_ips: List of allowed IPs or CIDR ranges

    Returns:
        True if IP is allowed, False otherwise
    """
    if not allowed_ips or len(allowed_ips) == 0:
        return True  # No restrictions

    try:
        # Check exact match first
        if client_ip in allowed_ips:
            return True

        # Check CIDR ranges
        for allowed_ip in allowed_ips:
            if '/' in allowed_ip:
                if _ip_in_cidr(client_ip, allowed_ip):
                    return True

        return False

    except Exception as e:
        logger.error(f"Error validating IP allowlist: {e}")
        return False


def validate_domain_referrers(referer: str, allowed_domains: List[str]) -> bool:
    """
    Validate if referer domain is in the allowlist

    Args:
        referer: HTTP Referer header value
        allowed_domains: List of allowed domains

    Returns:
        True if domain is allowed, False otherwise
    """
    if not allowed_domains or len(allowed_domains) == 0:
        return True  # No restrictions

    if not referer:
        return False

    try:
        from urllib.parse import urlparse
        parsed_url = urlparse(referer)
        hostname = parsed_url.hostname

        if not hostname:
            return False

        # Check if hostname matches any allowed domain
        for allowed_domain in allowed_domains:
            if hostname == allowed_domain or hostname.endswith('.' + allowed_domain):
                return True

        return False

    except Exception as e:
        logger.error(f"Error validating domain referrers: {e}")
        return False


# ==================== API Key Validation ====================

def validate_api_key_security(
        api_key: str,
        client_ip: Optional[str] = None,
        referer: Optional[str] = None
) -> str:
    """
    Validate API key with comprehensive security checks

    This function:
    1. Searches for the key in api_keys_new and api_keys tables
    2. Validates key constraints (active, expiration, limits)
    3. Enforces IP allowlist and domain restrictions
    4. Updates last_used_at timestamp
    5. Falls back to legacy user validation

    Args:
        api_key: API key to validate
        client_ip: Client IP address (optional)
        referer: HTTP Referer header (optional)

    Returns:
        API key if valid

    Raises:
        ValueError: With specific reason for rejection
    """
    from src.supabase_config import get_supabase_client
    from src.db.users import get_user

    client = get_supabase_client()

    # Check both new and legacy API key tables
    tables_to_check = ['api_keys_new', 'api_keys']

    for table_name in tables_to_check:
        logger.debug(f"Checking {table_name} table for API key")

        try:
            # Query for the specific API key
            result = client.table(table_name).select('*').eq('api_key', api_key).execute()

            if not result.data:
                continue

            # Found the key
            key_data = result.data[0]

            # Validate key constraints
            _validate_key_constraints(key_data, client_ip, referer, table_name, client)

            logger.info(f"API key validated successfully from {table_name}")
            return api_key

        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Error checking {table_name}: {e}")
            continue

    # Fallback to legacy user table validation
    logger.debug("Attempting legacy user validation")
    user = get_user(api_key)
    if user:
        logger.info("Using legacy API key validation")
        return api_key

    raise ValueError("Invalid API key")


def _validate_key_constraints(
        key_data: Dict[str, Any],
        client_ip: Optional[str],
        referer: Optional[str],
        table_name: str,
        client: Any
) -> None:
    """
    Validate API key constraints and security policies

    Checks:
    - Active status
    - Expiration date
    - Request limits
    - IP allowlist
    - Domain restrictions

    Args:
        key_data: API key record from database
        client_ip: Client IP address
        referer: HTTP Referer header
        table_name: Name of the table (for logging)
        client: Supabase client instance

    Raises:
        ValueError: With specific reason for rejection
    """
    key_id = key_data['id']

    # 1. Check if key is active
    if not key_data.get('is_active', True):
        raise ValueError("API key is inactive")

    # 2. Check expiration date
    if key_data.get('expiration_date'):
        try:
            expiration_str = key_data['expiration_date']
            if expiration_str:
                # Normalize timezone
                if 'Z' in expiration_str:
                    expiration_str = expiration_str.replace('Z', '+00:00')
                elif not expiration_str.endswith('+00:00'):
                    expiration_str = expiration_str + '+00:00'

                expiration = datetime.fromisoformat(expiration_str)
                now = datetime.now(timezone.utc).replace(tzinfo=expiration.tzinfo)

                if expiration < now:
                    raise ValueError("API key has expired")
        except ValueError:
            raise
        except Exception as e:
            logger.warning(f"Error checking expiration for key {key_id}: {e}")

    # 3. Check request limits
    if key_data.get('max_requests') is not None:
        requests_used = key_data.get('requests_used', 0)
        if requests_used >= key_data['max_requests']:
            raise ValueError("API key request limit reached")

    # 4. IP allowlist enforcement
    ip_allowlist = key_data.get('ip_allowlist') or []
    if ip_allowlist and len(ip_allowlist) > 0 and ip_allowlist != ['']:
        if not client_ip:
            raise ValueError("Client IP required but not provided")

        if not validate_ip_allowlist(client_ip, ip_allowlist):
            logger.warning(f"IP {client_ip} not in allowlist {ip_allowlist}")
            raise ValueError("IP address not allowed for this API key")

    # 5. Domain referrer enforcement
    domain_referrers = key_data.get('domain_referrers') or []
    if domain_referrers and len(domain_referrers) > 0 and domain_referrers != ['']:
        if not validate_domain_referrers(referer or '', domain_referrers):
            logger.warning(f"Domain {referer} not in allowlist {domain_referrers}")
            raise ValueError("Domain not allowed for this API key")

    # 6. Update last used timestamp
    try:
        client.table(table_name).update({
            'last_used_at': datetime.now(timezone.utc).isoformat()
        }).eq('id', key_id).execute()
    except Exception as e:
        logger.warning(f"Failed to update last_used_at for key {key_id}: {e}")

    logger.debug(f"API key {key_id} passed all security checks")


# ==================== Encryption & Security Manager ====================

class SecurityManager:
    """Advanced security manager for API keys and encryption"""

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize security manager

        Args:
            encryption_key: Optional Fernet key (generates new if not provided)
        """
        self.encryption_key = encryption_key or _generate_encryption_key()
        self.cipher_suite = Fernet(self.encryption_key.encode())

    def encrypt_api_key(self, api_key: str) -> str:
        """
        Encrypt an API key for secure storage

        Args:
            api_key: Plain text API key

        Returns:
            Base64 encoded encrypted key
        """
        try:
            encrypted_key = self.cipher_suite.encrypt(api_key.encode())
            return base64.b64encode(encrypted_key).decode()
        except Exception as e:
            logger.error(f"Error encrypting API key: {e}")
            raise

    def decrypt_api_key(self, encrypted_key: str) -> str:
        """
        Decrypt an API key from storage

        Args:
            encrypted_key: Base64 encoded encrypted key

        Returns:
            Plain text API key
        """
        try:
            encrypted_bytes = base64.b64decode(encrypted_key.encode())
            decrypted_key = self.cipher_suite.decrypt(encrypted_bytes)
            return decrypted_key.decode()
        except Exception as e:
            logger.error(f"Error decrypting API key: {e}")
            raise


# ==================== Audit Logger ====================

class AuditLogger:
    """Comprehensive audit logging system for security events"""

    def __init__(self):
        self.logger = logging.getLogger('audit')

        # Set up audit-specific logging with custom format
        if not self.logger.handlers:
            audit_handler = logging.StreamHandler()
            audit_formatter = logging.Formatter(
                '%(asctime)s - AUDIT - %(levelname)s - %(message)s'
            )
            audit_handler.setFormatter(audit_formatter)
            self.logger.addHandler(audit_handler)
            self.logger.setLevel(logging.INFO)

    def log_api_key_creation(
            self,
            user_id: int,
            key_id: int,
            key_name: str,
            environment_tag: str,
            created_by: str = "system"
    ):
        """Log API key creation event"""
        self.logger.info(
            f"API_KEY_CREATED - User: {user_id}, KeyID: {key_id}, "
            f"Name: {key_name}, Environment: {environment_tag}, "
            f"CreatedBy: {created_by}"
        )

    def log_api_key_deletion(
            self,
            user_id: int,
            key_id: int,
            key_name: str,
            deleted_by: str = "system"
    ):
        """Log API key deletion event"""
        self.logger.info(
            f"API_KEY_DELETED - User: {user_id}, KeyID: {key_id}, "
            f"Name: {key_name}, DeletedBy: {deleted_by}"
        )

    def log_api_key_usage(
            self,
            user_id: int,
            key_id: int,
            endpoint: str,
            ip_address: str,
            user_agent: str = None
    ):
        """Log API key usage event"""
        self.logger.info(
            f"API_KEY_USED - User: {user_id}, KeyID: {key_id}, "
            f"Endpoint: {endpoint}, IP: {ip_address}, UA: {user_agent}"
        )

    def log_security_violation(
            self,
            violation_type: str,
            user_id: int = None,
            key_id: int = None,
            details: str = "",
            ip_address: str = None
    ):
        """Log security violation event"""
        self.logger.warning(
            f"SECURITY_VIOLATION - Type: {violation_type}, "
            f"User: {user_id}, KeyID: {key_id}, "
            f"Details: {details}, IP: {ip_address}"
        )

    def log_plan_assignment(
            self,
            user_id: int,
            plan_id: int,
            assigned_by: str = "admin"
    ):
        """Log plan assignment event"""
        self.logger.info(
            f"PLAN_ASSIGNED - User: {user_id}, PlanID: {plan_id}, "
            f"AssignedBy: {assigned_by}"
        )

    def log_rate_limit_exceeded(
            self,
            user_id: int,
            key_id: int,
            limit_type: str,
            current_usage: int,
            limit: int
    ):
        """Log rate limit violation"""
        self.logger.warning(
            f"RATE_LIMIT_EXCEEDED - User: {user_id}, KeyID: {key_id}, "
            f"Type: {limit_type}, Usage: {current_usage}/{limit}"
        )

    def log_authentication_failure(
            self,
            reason: str,
            ip_address: str = None,
            api_key_prefix: str = None
    ):
        """Log authentication failure"""
        self.logger.warning(
            f"AUTH_FAILED - Reason: {reason}, IP: {ip_address}, "
            f"KeyPrefix: {api_key_prefix}"
        )

    def log_payment_event(
            self,
            user_id: int,
            payment_id: int,
            amount: float,
            currency: str,
            status: str
    ):
        """Log payment event"""
        self.logger.info(
            f"PAYMENT_EVENT - User: {user_id}, PaymentID: {payment_id}, "
            f"Amount: {amount} {currency}, Status: {status}"
        )


# ==================== Global Instances ====================

security_manager = SecurityManager()
audit_logger = AuditLogger()


def get_security_manager() -> SecurityManager:
    """Get the global security manager instance"""
    return security_manager


def get_audit_logger() -> AuditLogger:
    """Get the global audit logger instance"""
    return audit_logger