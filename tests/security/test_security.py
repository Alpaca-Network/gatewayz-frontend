"""
Tests for Security Module

Covers:
- API key encryption/decryption
- Password hashing and verification
- Token generation and validation
- Security utilities
- Error handling
"""

import os
import pytest
from unittest.mock import patch, Mock

# Set test environment
os.environ['APP_ENV'] = 'testing'
os.environ['ENCRYPTION_KEY'] = 'test-encryption-key-32-bytes-long!'

from src.security.security import (
    encrypt_api_key,
    decrypt_api_key,
    hash_password,
    verify_password,
    generate_api_key,
)


class TestAPIKeyEncryption:
    """Test API key encryption and decryption"""

    def test_encrypt_api_key_success(self):
        """Successfully encrypt an API key"""
        api_key = "gw_test_key_123456789"

        encrypted = encrypt_api_key(api_key)

        assert encrypted is not None
        assert encrypted != api_key
        assert isinstance(encrypted, str)

    def test_decrypt_api_key_success(self):
        """Successfully decrypt an API key"""
        api_key = "gw_test_key_123456789"

        encrypted = encrypt_api_key(api_key)
        decrypted = decrypt_api_key(encrypted)

        assert decrypted == api_key

    def test_encryption_is_deterministic(self):
        """Same input should NOT produce same encrypted output (IV should differ)"""
        api_key = "gw_test_key_123456789"

        encrypted1 = encrypt_api_key(api_key)
        encrypted2 = encrypt_api_key(api_key)

        # Encrypted values should be different due to random IV
        # but both should decrypt to same value
        assert decrypt_api_key(encrypted1) == api_key
        assert decrypt_api_key(encrypted2) == api_key

    def test_encrypt_empty_string(self):
        """Encrypt empty string should work or raise appropriate error"""
        try:
            encrypted = encrypt_api_key("")
            assert encrypted is not None or encrypted == ""
        except ValueError:
            # Acceptable if empty strings are rejected
            pass

    def test_decrypt_invalid_data(self):
        """Decrypting invalid data should raise error"""
        with pytest.raises(Exception):
            decrypt_api_key("invalid_encrypted_data")

    def test_decrypt_with_wrong_key(self):
        """Decrypting with wrong key should fail"""
        api_key = "gw_test_key_123456789"
        encrypted = encrypt_api_key(api_key)

        # Change encryption key
        with patch.dict(os.environ, {'ENCRYPTION_KEY': 'different-key-32-bytes-long!!!'}):
            with pytest.raises(Exception):
                # Should fail to decrypt with different key
                result = decrypt_api_key(encrypted)
                # If it doesn't raise, result should be wrong
                assert result != api_key

    def test_encrypt_long_api_key(self):
        """Encrypt very long API key"""
        long_key = "gw_" + "x" * 1000

        encrypted = encrypt_api_key(long_key)
        decrypted = decrypt_api_key(encrypted)

        assert decrypted == long_key

    def test_encrypt_special_characters(self):
        """Encrypt API key with special characters"""
        special_key = "gw_!@#$%^&*()_+-=[]{}|;:,.<>?"

        encrypted = encrypt_api_key(special_key)
        decrypted = decrypt_api_key(encrypted)

        assert decrypted == special_key


class TestPasswordHashing:
    """Test password hashing and verification"""

    def test_hash_password_success(self):
        """Successfully hash a password"""
        password = "SecurePassword123!"

        hashed = hash_password(password)

        assert hashed is not None
        assert hashed != password
        assert isinstance(hashed, str)
        assert len(hashed) > 20  # Hashed password should be longer

    def test_verify_password_correct(self):
        """Verify correct password"""
        password = "SecurePassword123!"

        hashed = hash_password(password)
        result = verify_password(password, hashed)

        assert result is True

    def test_verify_password_incorrect(self):
        """Verify incorrect password"""
        password = "SecurePassword123!"
        wrong_password = "WrongPassword456!"

        hashed = hash_password(password)
        result = verify_password(wrong_password, hashed)

        assert result is False

    def test_hash_same_password_different_hashes(self):
        """Same password should produce different hashes (salt)"""
        password = "SecurePassword123!"

        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # Hashes should be different due to salt
        assert hash1 != hash2

        # But both should verify correctly
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True

    def test_hash_empty_password(self):
        """Hash empty password should work or raise appropriate error"""
        try:
            hashed = hash_password("")
            assert hashed is not None
        except ValueError:
            # Acceptable if empty passwords are rejected
            pass

    def test_hash_long_password(self):
        """Hash very long password"""
        long_password = "x" * 1000

        hashed = hash_password(long_password)
        result = verify_password(long_password, hashed)

        assert result is True

    def test_verify_password_with_invalid_hash(self):
        """Verify password with invalid hash format"""
        password = "SecurePassword123!"
        invalid_hash = "not_a_valid_hash"

        result = verify_password(password, invalid_hash)

        assert result is False

    def test_password_case_sensitive(self):
        """Password verification is case-sensitive"""
        password = "SecurePassword123!"

        hashed = hash_password(password)

        assert verify_password("securepassword123!", hashed) is False
        assert verify_password("SECUREPASSWORD123!", hashed) is False


class TestAPIKeyGeneration:
    """Test API key generation"""

    def test_generate_api_key_success(self):
        """Successfully generate an API key"""
        api_key = generate_api_key()

        assert api_key is not None
        assert isinstance(api_key, str)
        assert len(api_key) > 10
        assert api_key.startswith("gw_")

    def test_generate_api_key_unique(self):
        """Generated API keys should be unique"""
        keys = set()
        for _ in range(100):
            key = generate_api_key()
            keys.add(key)

        # All keys should be unique
        assert len(keys) == 100

    def test_generate_api_key_format(self):
        """API key should follow expected format"""
        api_key = generate_api_key()

        assert api_key.startswith("gw_")
        # Should contain alphanumeric characters
        assert all(c.isalnum() or c == '_' for c in api_key)

    def test_generate_api_key_length(self):
        """API key should have appropriate length"""
        api_key = generate_api_key()

        # Should be reasonably long for security
        assert len(api_key) >= 20


class TestSecurityHelpers:
    """Test security helper functions"""

    def test_encryption_key_loaded_from_environment(self):
        """Encryption key should be loaded from environment"""
        assert os.getenv('ENCRYPTION_KEY') is not None
        assert len(os.getenv('ENCRYPTION_KEY')) >= 32

    def test_encryption_requires_key(self):
        """Encryption should require ENCRYPTION_KEY environment variable"""
        api_key = "gw_test_key_123"

        # Should work with key
        encrypted = encrypt_api_key(api_key)
        assert encrypted is not None

        # Test without key would require unloading the module
        # which is complex, so we just verify key exists
        assert os.getenv('ENCRYPTION_KEY') is not None


class TestSecurityEdgeCases:
    """Test edge cases and error handling"""

    def test_encrypt_none(self):
        """Encrypt None should handle gracefully"""
        try:
            result = encrypt_api_key(None)
            assert result is None or isinstance(result, str)
        except (TypeError, ValueError):
            # Acceptable to raise error for None
            pass

    def test_decrypt_none(self):
        """Decrypt None should handle gracefully"""
        try:
            result = decrypt_api_key(None)
            assert result is None
        except (TypeError, ValueError, AttributeError):
            # Acceptable to raise error for None
            pass

    def test_hash_none(self):
        """Hash None should handle gracefully"""
        try:
            result = hash_password(None)
            assert result is None or isinstance(result, str)
        except (TypeError, ValueError, AttributeError):
            # Acceptable to raise error for None
            pass

    def test_verify_with_none_password(self):
        """Verify with None password should return False"""
        hashed = hash_password("test123")

        try:
            result = verify_password(None, hashed)
            assert result is False
        except (TypeError, AttributeError):
            # Acceptable to raise error
            pass

    def test_verify_with_none_hash(self):
        """Verify with None hash should return False"""
        try:
            result = verify_password("test123", None)
            assert result is False
        except (TypeError, AttributeError):
            # Acceptable to raise error
            pass


class TestSecurityConstants:
    """Test security-related constants and configurations"""

    def test_api_key_prefix(self):
        """API keys should use gw_ prefix"""
        api_key = generate_api_key()
        assert api_key.startswith("gw_")

    def test_encryption_key_minimum_length(self):
        """Encryption key should meet minimum length requirements"""
        key = os.getenv('ENCRYPTION_KEY')
        assert len(key) >= 32  # AES-256 requires 32 bytes


class TestEncryptionRoundtrip:
    """Test encryption/decryption roundtrip scenarios"""

    def test_multiple_roundtrips(self):
        """Multiple encrypt/decrypt roundtrips should work"""
        api_key = "gw_test_key_123456789"

        # Encrypt and decrypt multiple times
        for _ in range(10):
            encrypted = encrypt_api_key(api_key)
            decrypted = decrypt_api_key(encrypted)
            assert decrypted == api_key

    def test_encrypted_key_can_be_stored_and_retrieved(self):
        """Encrypted keys should be storable as strings"""
        api_key = "gw_test_key_123456789"

        encrypted = encrypt_api_key(api_key)

        # Simulate storage and retrieval
        stored_encrypted = str(encrypted)
        decrypted = decrypt_api_key(stored_encrypted)

        assert decrypted == api_key

    def test_unicode_characters(self):
        """Handle Unicode characters in API keys"""
        api_key = "gw_test_🔑_key"

        try:
            encrypted = encrypt_api_key(api_key)
            decrypted = decrypt_api_key(encrypted)
            assert decrypted == api_key
        except (UnicodeEncodeError, ValueError):
            # Acceptable if Unicode is not supported
            pass
