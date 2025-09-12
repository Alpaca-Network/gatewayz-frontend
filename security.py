#!/usr/bin/env python3
"""
Advanced Security Module
Implements secure key hashing, audit logging, and advanced security features.
"""

import hashlib
import hmac
import secrets
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from cryptography.fernet import Fernet
import base64

logger = logging.getLogger(__name__)

class SecurityManager:
    """Advanced security manager for API keys and audit logging"""
    
    def __init__(self, encryption_key: Optional[str] = None):
        """Initialize security manager with optional encryption key"""
        self.encryption_key = encryption_key or self._generate_encryption_key()
        self.cipher_suite = Fernet(self.encryption_key.encode())
    
    def _generate_encryption_key(self) -> str:
        """Generate a new encryption key"""
        return Fernet.generate_key().decode()
    
    def hash_api_key(self, api_key: str) -> str:
        """Create a secure hash of an API key using HMAC-SHA256"""
        try:
            # Use a secret salt for additional security
            salt = os.environ.get("API_GATEWAY_SALT", "api_gateway_salt_2024").encode()
            hash_obj = hmac.new(salt, api_key.encode("utf-8"), hashlib.sha256)
            return hash_obj.hexdigest()
        except Exception as e:
            logger.error(f"Error hashing API key: {e}")
            raise
    
    def encrypt_api_key(self, api_key: str) -> str:
        """Encrypt an API key for secure storage"""
        try:
            encrypted_key = self.cipher_suite.encrypt(api_key.encode())
            return base64.b64encode(encrypted_key).decode()
        except Exception as e:
            logger.error(f"Error encrypting API key: {e}")
            raise
    
    def decrypt_api_key(self, encrypted_key: str) -> str:
        """Decrypt an API key from storage"""
        try:
            encrypted_bytes = base64.b64decode(encrypted_key.encode())
            decrypted_key = self.cipher_suite.decrypt(encrypted_bytes)
            return decrypted_key.decode()
        except Exception as e:
            logger.error(f"Error decrypting API key: {e}")
            raise
    
    def generate_secure_api_key(self, environment_tag: str = 'live', key_length: int = 32) -> str:
        """Generate a cryptographically secure API key"""
        try:
            # Generate secure random part
            random_part = secrets.token_urlsafe(key_length)
            
            # Add environment prefix
            if environment_tag == 'test':
                prefix = 'gw_test_'
            elif environment_tag == 'staging':
                prefix = 'gw_staging_'
            elif environment_tag == 'development':
                prefix = 'gw_dev_'
            else:
                prefix = 'gw_live_'
            
            return prefix + random_part
        except Exception as e:
            logger.error(f"Error generating secure API key: {e}")
            raise
    
    def validate_ip_allowlist(self, client_ip: str, allowed_ips: List[str]) -> bool:
        """Validate if client IP is in the allowlist"""
        if not allowed_ips:
            return True  # No restrictions
        
        try:
            # Check exact match first
            if client_ip in allowed_ips:
                return True
            
            # Check CIDR ranges (basic implementation)
            for allowed_ip in allowed_ips:
                if '/' in allowed_ip:
                    # Handle CIDR notation (simplified)
                    if self._ip_in_cidr(client_ip, allowed_ip):
                        return True
            
            return False
        except Exception as e:
            logger.error(f"Error validating IP allowlist: {e}")
            return False
    
    def _ip_in_cidr(self, ip: str, cidr: str) -> bool:
        """Check if IP is in CIDR range (simplified implementation)"""
        try:
            # This is a simplified implementation
            # In production, use a proper IP address library like ipaddress
            if '/' not in cidr:
                return ip == cidr
            
            # For now, just do exact match
            # TODO: Implement proper CIDR checking
            return ip == cidr.split('/')[0]
        except Exception as e:
            logger.error(f"Error checking CIDR: {e}")
            return False
    
    def validate_domain_referrers(self, referer: str, allowed_domains: List[str]) -> bool:
        """Validate if referer domain is in the allowlist"""
        if not allowed_domains or not referer:
            return True  # No restrictions
        
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

class AuditLogger:
    """Comprehensive audit logging system"""
    
    def __init__(self):
        self.logger = logging.getLogger('audit')
        # Set up audit-specific logging
        audit_handler = logging.StreamHandler()
        audit_formatter = logging.Formatter(
            '%(asctime)s - AUDIT - %(levelname)s - %(message)s'
        )
        audit_handler.setFormatter(audit_formatter)
        self.logger.addHandler(audit_handler)
        self.logger.setLevel(logging.INFO)
    
    def log_api_key_creation(self, user_id: int, key_id: int, key_name: str, environment_tag: str, created_by: str = "system"):
        """Log API key creation"""
        self.logger.info(f"API_KEY_CREATED - User: {user_id}, KeyID: {key_id}, Name: {key_name}, Environment: {environment_tag}, CreatedBy: {created_by}")
    
    def log_api_key_deletion(self, user_id: int, key_id: int, key_name: str, deleted_by: str = "system"):
        """Log API key deletion"""
        self.logger.info(f"API_KEY_DELETED - User: {user_id}, KeyID: {key_id}, Name: {key_name}, DeletedBy: {deleted_by}")
    
    def log_api_key_usage(self, user_id: int, key_id: int, endpoint: str, ip_address: str, user_agent: str = None):
        """Log API key usage"""
        self.logger.info(f"API_KEY_USED - User: {user_id}, KeyID: {key_id}, Endpoint: {endpoint}, IP: {ip_address}, UA: {user_agent}")
    
    def log_security_violation(self, violation_type: str, user_id: int = None, key_id: int = None, details: str = "", ip_address: str = None):
        """Log security violations"""
        self.logger.warning(f"SECURITY_VIOLATION - Type: {violation_type}, User: {user_id}, KeyID: {key_id}, Details: {details}, IP: {ip_address}")
    
    def log_plan_assignment(self, user_id: int, plan_id: int, assigned_by: str = "admin"):
        """Log plan assignments"""
        self.logger.info(f"PLAN_ASSIGNED - User: {user_id}, PlanID: {plan_id}, AssignedBy: {assigned_by}")
    
    def log_rate_limit_exceeded(self, user_id: int, key_id: int, limit_type: str, current_usage: int, limit: int):
        """Log rate limit violations"""
        self.logger.warning(f"RATE_LIMIT_EXCEEDED - User: {user_id}, KeyID: {key_id}, Type: {limit_type}, Usage: {current_usage}/{limit}")

# Global instances
security_manager = SecurityManager()
audit_logger = AuditLogger()

def get_security_manager() -> SecurityManager:
    """Get the global security manager instance"""
    return security_manager

def get_audit_logger() -> AuditLogger:
    """Get the global audit logger instance"""
    return audit_logger
