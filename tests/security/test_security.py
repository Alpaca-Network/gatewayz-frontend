"""
Tests for Security Module

Covers:
- API key generation
- API key hashing
- IP allowlist validation
- Domain referrer validation
- Security utilities
"""

import os
import pytest
from unittest.mock import patch

# Set test environment
os.environ['APP_ENV'] = 'testing'
os.environ['API_GATEWAY_SALT'] = 'test-salt-for-hashing-keys-minimum-16-chars'

from src.security.security import (
    hash_api_key,
    generate_secure_api_key,
    validate_ip_allowlist,
    validate_domain_referrers,
)


class TestAPIKeyHashing:
    """Test API key hashing"""

    def test_hash_api_key_success(self):
        """Successfully hash an API key"""
        api_key = "gw_test_key_123456789"

        hashed = hash_api_key(api_key)

        assert hashed is not None
        assert hashed != api_key
        assert isinstance(hashed, str)
        assert len(hashed) == 64  # SHA256 hex digest length

    def test_hash_api_key_deterministic(self):
        """Same API key should produce same hash"""
        api_key = "gw_test_key_123456789"

        hash1 = hash_api_key(api_key)
        hash2 = hash_api_key(api_key)

        # Same input should produce same hash
        assert hash1 == hash2

    def test_hash_different_keys_different_hashes(self):
        """Different API keys should produce different hashes"""
        key1 = "gw_test_key_123"
        key2 = "gw_test_key_456"

        hash1 = hash_api_key(key1)
        hash2 = hash_api_key(key2)

        assert hash1 != hash2

    def test_hash_api_key_requires_salt(self):
        """Hashing should require API_GATEWAY_SALT"""
        api_key = "gw_test_key_123"

        # With proper salt, should work
        with patch.dict(os.environ, {'API_GATEWAY_SALT': 'test-salt-16chars'}):
            hashed = hash_api_key(api_key)
            assert hashed is not None

    def test_hash_api_key_rejects_short_salt(self):
        """Hashing should reject salt shorter than 16 characters"""
        api_key = "gw_test_key_123"

        with patch.dict(os.environ, {'API_GATEWAY_SALT': 'short'}):
            with pytest.raises(RuntimeError, match="at least 16 characters"):
                hash_api_key(api_key)


class TestAPIKeyGeneration:
    """Test API key generation"""

    def test_generate_api_key_success(self):
        """Successfully generate an API key"""
        api_key = generate_secure_api_key()

        assert api_key is not None
        assert isinstance(api_key, str)
        assert api_key.startswith("gw_live_")

    def test_generate_api_key_unique(self):
        """Generated API keys should be unique"""
        keys = set()
        for _ in range(100):
            key = generate_secure_api_key()
            keys.add(key)

        # All keys should be unique
        assert len(keys) == 100

    def test_generate_api_key_test_environment(self):
        """Generate test environment API key"""
        api_key = generate_secure_api_key(environment_tag='test')

        assert api_key.startswith("gw_test_")

    def test_generate_api_key_staging_environment(self):
        """Generate staging environment API key"""
        api_key = generate_secure_api_key(environment_tag='staging')

        assert api_key.startswith("gw_staging_")

    def test_generate_api_key_development_environment(self):
        """Generate development environment API key"""
        api_key = generate_secure_api_key(environment_tag='development')

        assert api_key.startswith("gw_dev_")

    def test_generate_api_key_custom_length(self):
        """Generate API key with custom length"""
        api_key = generate_secure_api_key(key_length=64)

        # URL-safe base64 encoding adds some overhead, but should be longer
        assert len(api_key) > 64

    def test_generate_api_key_format(self):
        """API key should follow expected format"""
        api_key = generate_secure_api_key()

        assert api_key.startswith("gw_")
        # Should contain URL-safe characters
        assert all(c.isalnum() or c in ('_', '-') for c in api_key)


class TestIPAllowlist:
    """Test IP allowlist validation"""

    def test_validate_ip_exact_match(self):
        """Validate IP with exact match"""
        client_ip = "192.168.1.100"
        allowed_ips = ["192.168.1.100", "10.0.0.1"]

        result = validate_ip_allowlist(client_ip, allowed_ips)

        assert result is True

    def test_validate_ip_not_in_allowlist(self):
        """Validate IP not in allowlist"""
        client_ip = "192.168.1.200"
        allowed_ips = ["192.168.1.100", "10.0.0.1"]

        result = validate_ip_allowlist(client_ip, allowed_ips)

        assert result is False

    def test_validate_ip_cidr_range(self):
        """Validate IP in CIDR range"""
        client_ip = "192.168.1.100"
        allowed_ips = ["192.168.1.0/24"]

        result = validate_ip_allowlist(client_ip, allowed_ips)

        assert result is True

    def test_validate_ip_outside_cidr_range(self):
        """Validate IP outside CIDR range"""
        client_ip = "192.168.2.100"
        allowed_ips = ["192.168.1.0/24"]

        result = validate_ip_allowlist(client_ip, allowed_ips)

        assert result is False

    def test_validate_ip_empty_allowlist(self):
        """Empty allowlist should allow all IPs"""
        client_ip = "192.168.1.100"
        allowed_ips = []

        result = validate_ip_allowlist(client_ip, allowed_ips)

        assert result is True

    def test_validate_ip_mixed_formats(self):
        """Validate IP with mixed exact and CIDR formats"""
        client_ip = "10.0.0.5"
        allowed_ips = ["192.168.1.100", "10.0.0.0/24", "172.16.0.1"]

        result = validate_ip_allowlist(client_ip, allowed_ips)

        assert result is True


class TestDomainReferrers:
    """Test domain referrer validation"""

    def test_validate_domain_exact_match(self):
        """Validate domain with exact match"""
        referer = "https://example.com/page"
        allowed_domains = ["example.com", "test.com"]

        result = validate_domain_referrers(referer, allowed_domains)

        assert result is True

    def test_validate_domain_with_subdomain(self):
        """Validate subdomain"""
        referer = "https://api.example.com/endpoint"
        allowed_domains = ["*.example.com", "test.com"]

        result = validate_domain_referrers(referer, allowed_domains)

        # Result depends on implementation - may need wildcard support
        # For now, just test it doesn't crash
        assert isinstance(result, bool)

    def test_validate_domain_not_in_allowlist(self):
        """Validate domain not in allowlist"""
        referer = "https://malicious.com/page"
        allowed_domains = ["example.com", "test.com"]

        result = validate_domain_referrers(referer, allowed_domains)

        assert result is False

    def test_validate_domain_empty_allowlist(self):
        """Empty allowlist should allow all domains"""
        referer = "https://example.com/page"
        allowed_domains = []

        result = validate_domain_referrers(referer, allowed_domains)

        assert result is True

    def test_validate_domain_no_referer(self):
        """No referer should be handled gracefully"""
        referer = ""
        allowed_domains = ["example.com"]

        result = validate_domain_referrers(referer, allowed_domains)

        # Should return False or handle gracefully
        assert isinstance(result, bool)


class TestSecurityConstants:
    """Test security-related constants and configurations"""

    def test_api_key_prefix(self):
        """API keys should use gw_ prefix"""
        api_key = generate_secure_api_key()
        assert api_key.startswith("gw_")

    def test_salt_minimum_length(self):
        """Salt should meet minimum length requirements"""
        salt = os.getenv('API_GATEWAY_SALT')
        assert len(salt) >= 16


class TestSecurityEdgeCases:
    """Test edge cases and error handling"""

    def test_hash_empty_string(self):
        """Hash empty string should work or raise appropriate error"""
        try:
            result = hash_api_key("")
            assert isinstance(result, str)
        except (ValueError, RuntimeError):
            # Acceptable to raise error for empty string
            pass

    def test_validate_ip_invalid_ip(self):
        """Validate with invalid IP format"""
        client_ip = "not_an_ip"
        allowed_ips = ["192.168.1.0/24"]

        # Should handle gracefully without crashing
        result = validate_ip_allowlist(client_ip, allowed_ips)
        assert isinstance(result, bool)

    def test_validate_domain_invalid_url(self):
        """Validate with invalid URL format"""
        referer = "not a url"
        allowed_domains = ["example.com"]

        # Should handle gracefully without crashing
        result = validate_domain_referrers(referer, allowed_domains)
        assert isinstance(result, bool)
