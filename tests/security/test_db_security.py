#!/usr/bin/env python3
"""
Comprehensive tests for db_security module

Tests cover:
- Secure API key creation with encryption
- API key validation with security checks
- API key rotation
- Audit log retrieval
- Bulk key rotation
- Key name uniqueness checks
- IP allowlist validation
- Domain referrer validation
- Expiration checks
- Request limit checks
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta, timezone

from src.db_security import (
    create_secure_api_key,
    validate_secure_api_key,
    rotate_api_key,
    get_audit_logs,
    bulk_rotate_user_keys,
    check_key_name_uniqueness
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with chainable methods"""
    client = Mock()

    # Create chainable table mock
    table_mock = Mock()
    table_mock.select.return_value = table_mock
    table_mock.insert.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.neq.return_value = table_mock
    table_mock.gte.return_value = table_mock
    table_mock.lte.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])

    client.table.return_value = table_mock

    return client, table_mock


@pytest.fixture
def mock_security_manager():
    """Mock security manager"""
    manager = Mock()
    manager.encrypt_api_key.return_value = "encrypted_key_123"
    manager.decrypt_api_key.return_value = "gw_live_test_key_12345"
    return manager


@pytest.fixture
def mock_audit_logger():
    """Mock audit logger"""
    logger = Mock()
    return logger


@pytest.fixture
def sample_api_key_data():
    """Sample API key database record"""
    return {
        'id': 1,
        'user_id': 100,
        'key_name': 'test_key',
        'api_key': 'encrypted_key_123',
        'key_hash': 'hash_123',
        'is_active': True,
        'is_primary': False,
        'expiration_date': None,
        'max_requests': None,
        'requests_used': 0,
        'environment_tag': 'live',
        'scope_permissions': {'read': ['*'], 'write': ['*']},
        'ip_allowlist': [],
        'domain_referrers': [],
        'created_by_user_id': 100,
        'last_used_at': datetime.utcnow().isoformat(),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }


# ============================================================
# TEST CLASS: Create Secure API Key
# ============================================================

class TestCreateSecureAPIKey:
    """Test secure API key creation"""

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.generate_secure_api_key')
    @patch('src.db_security.hash_api_key')
    @patch('src.db_security.check_key_name_uniqueness')
    def test_create_secure_api_key_success(
        self,
        mock_check_uniqueness,
        mock_hash_key,
        mock_generate_key,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger
    ):
        """Test successful secure API key creation"""
        # Setup mocks
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        mock_check_uniqueness.return_value = True
        mock_generate_key.return_value = "gw_live_new_key_12345"
        mock_hash_key.return_value = "hash_new_123"

        # Mock successful insert
        table_mock.execute.return_value = Mock(data=[{'id': 1}])

        # Create key
        result = create_secure_api_key(
            user_id=100,
            key_name="test_key",
            environment_tag="live"
        )

        assert result == "gw_live_new_key_12345"

        # Verify key was encrypted
        mock_security_manager.encrypt_api_key.assert_called_once()

        # Verify audit log was created
        mock_audit_logger.log_api_key_creation.assert_called_once()

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.generate_secure_api_key')
    @patch('src.db_security.hash_api_key')
    @patch('src.db_security.check_key_name_uniqueness')
    def test_create_secure_api_key_with_expiration(
        self,
        mock_check_uniqueness,
        mock_hash_key,
        mock_generate_key,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger
    ):
        """Test API key creation with expiration"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        mock_check_uniqueness.return_value = True
        mock_generate_key.return_value = "gw_live_key_12345"
        mock_hash_key.return_value = "hash_123"
        table_mock.execute.return_value = Mock(data=[{'id': 1}])

        result = create_secure_api_key(
            user_id=100,
            key_name="expiring_key",
            expiration_days=30
        )

        assert result == "gw_live_key_12345"

        # Verify insert was called with expiration_date
        insert_call = table_mock.insert.call_args[0][0]
        assert 'expiration_date' in insert_call
        assert insert_call['expiration_date'] is not None

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.generate_secure_api_key')
    @patch('src.db_security.hash_api_key')
    @patch('src.db_security.check_key_name_uniqueness')
    def test_create_secure_api_key_with_ip_allowlist(
        self,
        mock_check_uniqueness,
        mock_hash_key,
        mock_generate_key,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger
    ):
        """Test API key creation with IP allowlist"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        mock_check_uniqueness.return_value = True
        mock_generate_key.return_value = "gw_live_key_12345"
        mock_hash_key.return_value = "hash_123"
        table_mock.execute.return_value = Mock(data=[{'id': 1}])

        ip_list = ['192.168.1.1', '10.0.0.1']
        result = create_secure_api_key(
            user_id=100,
            key_name="restricted_key",
            ip_allowlist=ip_list
        )

        assert result == "gw_live_key_12345"

        # Verify IP allowlist was stored
        insert_call = table_mock.insert.call_args[0][0]
        assert insert_call['ip_allowlist'] == ip_list

    @patch('src.db_security.check_key_name_uniqueness')
    def test_create_secure_api_key_duplicate_name(
        self,
        mock_check_uniqueness
    ):
        """Test API key creation with duplicate name fails"""
        mock_check_uniqueness.return_value = False

        with pytest.raises(ValueError) as exc_info:
            create_secure_api_key(
                user_id=100,
                key_name="duplicate_key"
            )

        assert "already exists" in str(exc_info.value)

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.generate_secure_api_key')
    @patch('src.db_security.hash_api_key')
    @patch('src.db_security.check_key_name_uniqueness')
    def test_create_secure_api_key_insert_fails(
        self,
        mock_check_uniqueness,
        mock_hash_key,
        mock_generate_key,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger
    ):
        """Test API key creation when insert fails"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        mock_check_uniqueness.return_value = True
        mock_generate_key.return_value = "gw_live_key_12345"
        mock_hash_key.return_value = "hash_123"

        # Insert returns no data (failure)
        table_mock.execute.return_value = Mock(data=[])

        with pytest.raises(RuntimeError) as exc_info:
            create_secure_api_key(
                user_id=100,
                key_name="test_key"
            )

        assert "Failed to create" in str(exc_info.value)

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.generate_secure_api_key')
    @patch('src.db_security.hash_api_key')
    @patch('src.db_security.check_key_name_uniqueness')
    def test_create_secure_api_key_with_custom_permissions(
        self,
        mock_check_uniqueness,
        mock_hash_key,
        mock_generate_key,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger
    ):
        """Test API key creation with custom scope permissions"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        mock_check_uniqueness.return_value = True
        mock_generate_key.return_value = "gw_live_key_12345"
        mock_hash_key.return_value = "hash_123"
        table_mock.execute.return_value = Mock(data=[{'id': 1}])

        custom_perms = {
            'read': ['models', 'usage'],
            'write': [],
            'admin': []
        }

        result = create_secure_api_key(
            user_id=100,
            key_name="readonly_key",
            scope_permissions=custom_perms
        )

        assert result == "gw_live_key_12345"

        # Verify custom permissions were stored
        insert_call = table_mock.insert.call_args[0][0]
        assert insert_call['scope_permissions'] == custom_perms


# ============================================================
# TEST CLASS: Validate Secure API Key
# ============================================================

class TestValidateSecureAPIKey:
    """Test secure API key validation"""

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    def test_validate_secure_api_key_success(
        self,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test successful API key validation"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # Mock key lookup returns sample key
        table_mock.execute.side_effect = [
            Mock(data=[sample_api_key_data]),  # select
            Mock(data=[{'updated': True}])      # update last_used_at
        ]

        mock_security_manager.decrypt_api_key.return_value = "gw_live_test_key_12345"

        result = validate_secure_api_key("gw_live_test_key_12345")

        assert result is not None
        assert result['user_id'] == 100
        assert result['key_id'] == 1
        assert result['is_active'] is True

        # Verify audit log was called
        mock_audit_logger.log_api_key_usage.assert_called_once()

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    def test_validate_secure_api_key_not_found(
        self,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger
    ):
        """Test validation with non-existent key"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # No keys in database
        table_mock.execute.return_value = Mock(data=[])

        result = validate_secure_api_key("gw_live_invalid_key")

        assert result is None

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    def test_validate_secure_api_key_inactive(
        self,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test validation with inactive key"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # Mark key as inactive
        sample_api_key_data['is_active'] = False

        table_mock.execute.return_value = Mock(data=[sample_api_key_data])
        mock_security_manager.decrypt_api_key.return_value = "gw_live_test_key_12345"

        result = validate_secure_api_key("gw_live_test_key_12345")

        assert result is None

        # Verify security violation was logged
        mock_audit_logger.log_security_violation.assert_called_with(
            "INACTIVE_KEY", 100, 1, "Key 1 is inactive", None
        )

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    def test_validate_secure_api_key_expired(
        self,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test validation with expired key"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # Set expiration to past date
        past_date = (datetime.utcnow() - timedelta(days=1)).isoformat() + '+00:00'
        sample_api_key_data['expiration_date'] = past_date

        table_mock.execute.return_value = Mock(data=[sample_api_key_data])
        mock_security_manager.decrypt_api_key.return_value = "gw_live_test_key_12345"

        result = validate_secure_api_key("gw_live_test_key_12345")

        assert result is None

        # Verify expiration violation was logged
        mock_audit_logger.log_security_violation.assert_called_with(
            "EXPIRED_KEY", 100, 1, "Key 1 has expired", None
        )

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.validate_ip_allowlist')
    def test_validate_secure_api_key_ip_not_allowed(
        self,
        mock_validate_ip,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test validation with disallowed IP"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        sample_api_key_data['ip_allowlist'] = ['192.168.1.1']

        table_mock.execute.return_value = Mock(data=[sample_api_key_data])
        mock_security_manager.decrypt_api_key.return_value = "gw_live_test_key_12345"
        mock_validate_ip.return_value = False  # IP not allowed

        result = validate_secure_api_key(
            "gw_live_test_key_12345",
            client_ip="10.0.0.1"
        )

        assert result is None

        # Verify IP violation was logged
        mock_audit_logger.log_security_violation.assert_called_with(
            "IP_NOT_ALLOWED", 100, 1, "IP 10.0.0.1 not in allowlist", "10.0.0.1"
        )

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.validate_domain_referrers')
    def test_validate_secure_api_key_domain_not_allowed(
        self,
        mock_validate_domain,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test validation with disallowed domain"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        sample_api_key_data['domain_referrers'] = ['example.com']

        table_mock.execute.return_value = Mock(data=[sample_api_key_data])
        mock_security_manager.decrypt_api_key.return_value = "gw_live_test_key_12345"
        mock_validate_domain.return_value = False  # Domain not allowed

        result = validate_secure_api_key(
            "gw_live_test_key_12345",
            referer="https://malicious.com"
        )

        assert result is None

        # Verify domain violation was logged
        mock_audit_logger.log_security_violation.assert_called_with(
            "DOMAIN_NOT_ALLOWED", 100, 1,
            "Referer https://malicious.com not in allowlist", None
        )

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    def test_validate_secure_api_key_request_limit_exceeded(
        self,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test validation when request limit is exceeded"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # Set request limit reached
        sample_api_key_data['max_requests'] = 1000
        sample_api_key_data['requests_used'] = 1000

        table_mock.execute.return_value = Mock(data=[sample_api_key_data])
        mock_security_manager.decrypt_api_key.return_value = "gw_live_test_key_12345"

        result = validate_secure_api_key("gw_live_test_key_12345")

        assert result is None

        # Verify limit violation was logged
        mock_audit_logger.log_security_violation.assert_called_with(
            "REQUEST_LIMIT_EXCEEDED", 100, 1,
            "Key 1 request limit reached", None
        )

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    def test_validate_plain_text_key(
        self,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test validation of plain text (legacy) key"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # Store plain text key instead of encrypted
        plain_key = "gw_live_plain_key_12345"
        sample_api_key_data['api_key'] = plain_key

        table_mock.execute.side_effect = [
            Mock(data=[sample_api_key_data]),
            Mock(data=[{'updated': True}])
        ]

        # Decryption will fail, fallback to plain text
        mock_security_manager.decrypt_api_key.side_effect = Exception("Decryption failed")

        result = validate_secure_api_key(plain_key)

        assert result is not None
        assert result['user_id'] == 100


# ============================================================
# TEST CLASS: Rotate API Key
# ============================================================

class TestRotateAPIKey:
    """Test API key rotation"""

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.generate_secure_api_key')
    @patch('src.db_security.hash_api_key')
    def test_rotate_api_key_success(
        self,
        mock_hash_key,
        mock_generate_key,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test successful API key rotation"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # Mock key lookup and update
        table_mock.execute.side_effect = [
            Mock(data=[sample_api_key_data]),  # select current key
            Mock(data=[{'id': 1}]),             # update key
            Mock(data=[{'inserted': True}])     # insert audit log
        ]

        mock_generate_key.return_value = "gw_live_rotated_key_12345"
        mock_hash_key.return_value = "hash_rotated_123"

        result = rotate_api_key(key_id=1, user_id=100)

        assert result == "gw_live_rotated_key_12345"

        # Verify new key was encrypted
        mock_security_manager.encrypt_api_key.assert_called_once()

        # Verify audit log was created
        mock_audit_logger.log_api_key_creation.assert_called_once()

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    def test_rotate_api_key_not_found(
        self,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger
    ):
        """Test rotation with non-existent key"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        # Key not found
        table_mock.execute.return_value = Mock(data=[])

        with pytest.raises(RuntimeError) as exc_info:
            rotate_api_key(key_id=999, user_id=100)

        assert "Failed to rotate" in str(exc_info.value)

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_security_manager')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.generate_secure_api_key')
    @patch('src.db_security.hash_api_key')
    def test_rotate_api_key_with_new_name(
        self,
        mock_hash_key,
        mock_generate_key,
        mock_get_audit,
        mock_get_security,
        mock_get_client,
        mock_supabase_client,
        mock_security_manager,
        mock_audit_logger,
        sample_api_key_data
    ):
        """Test API key rotation with new name"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_security.return_value = mock_security_manager
        mock_get_audit.return_value = mock_audit_logger

        table_mock.execute.side_effect = [
            Mock(data=[sample_api_key_data]),
            Mock(data=[{'id': 1}]),
            Mock(data=[{'inserted': True}])
        ]

        mock_generate_key.return_value = "gw_live_new_key_12345"
        mock_hash_key.return_value = "hash_new_123"

        result = rotate_api_key(
            key_id=1,
            user_id=100,
            new_key_name="rotated_key_v2"
        )

        assert result == "gw_live_new_key_12345"

        # Verify new name was used in update
        update_call = table_mock.update.call_args[0][0]
        assert update_call['key_name'] == "rotated_key_v2"


# ============================================================
# TEST CLASS: Get Audit Logs
# ============================================================

class TestGetAuditLogs:
    """Test audit log retrieval"""

    @patch('src.db_security.get_supabase_client')
    def test_get_audit_logs_all(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test getting all audit logs"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        sample_logs = [
            {'id': 1, 'user_id': 100, 'action': 'create'},
            {'id': 2, 'user_id': 100, 'action': 'rotate'}
        ]
        table_mock.execute.return_value = Mock(data=sample_logs)

        result = get_audit_logs()

        assert len(result) == 2
        assert result[0]['action'] == 'create'

    @patch('src.db_security.get_supabase_client')
    def test_get_audit_logs_by_user(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test getting audit logs filtered by user"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        table_mock.execute.return_value = Mock(data=[
            {'id': 1, 'user_id': 100, 'action': 'create'}
        ])

        result = get_audit_logs(user_id=100)

        assert len(result) == 1
        assert result[0]['user_id'] == 100

        # Verify user filter was applied
        table_mock.eq.assert_any_call('user_id', 100)

    @patch('src.db_security.get_supabase_client')
    def test_get_audit_logs_by_action(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test getting audit logs filtered by action"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        table_mock.execute.return_value = Mock(data=[
            {'id': 1, 'action': 'rotate'}
        ])

        result = get_audit_logs(action='rotate')

        assert len(result) == 1

        # Verify action filter was applied
        table_mock.eq.assert_any_call('action', 'rotate')

    @patch('src.db_security.get_supabase_client')
    def test_get_audit_logs_with_date_range(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test getting audit logs within date range"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        table_mock.execute.return_value = Mock(data=[])

        start = datetime.utcnow() - timedelta(days=7)
        end = datetime.utcnow()

        result = get_audit_logs(start_date=start, end_date=end)

        # Verify date filters were applied
        table_mock.gte.assert_called_once()
        table_mock.lte.assert_called_once()

    @patch('src.db_security.get_supabase_client')
    def test_get_audit_logs_empty(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test getting audit logs when none exist"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        table_mock.execute.return_value = Mock(data=None)

        result = get_audit_logs()

        assert result == []

    @patch('src.db_security.get_supabase_client')
    def test_get_audit_logs_error_handling(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test audit logs error handling"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Simulate database error
        table_mock.execute.side_effect = Exception("Database error")

        result = get_audit_logs()

        # Should return empty list on error
        assert result == []


# ============================================================
# TEST CLASS: Bulk Rotate User Keys
# ============================================================

class TestBulkRotateUserKeys:
    """Test bulk key rotation"""

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.rotate_api_key')
    def test_bulk_rotate_user_keys_success(
        self,
        mock_rotate_key,
        mock_get_audit,
        mock_get_client,
        mock_supabase_client,
        mock_audit_logger
    ):
        """Test successful bulk rotation"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_audit.return_value = mock_audit_logger

        # Mock user has 2 keys
        user_keys = [
            {'id': 1, 'key_name': 'key1'},
            {'id': 2, 'key_name': 'key2'}
        ]
        table_mock.execute.return_value = Mock(data=user_keys)

        # Mock rotation returns new keys
        mock_rotate_key.side_effect = [
            "gw_live_new_key_1",
            "gw_live_new_key_2"
        ]

        result = bulk_rotate_user_keys(user_id=100)

        assert result['rotated_count'] == 2
        assert len(result['new_keys']) == 2
        assert result['new_keys'][0]['new_api_key'] == "gw_live_new_key_1"

        # Verify rotation was called for each key
        assert mock_rotate_key.call_count == 2

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_audit_logger')
    def test_bulk_rotate_user_keys_no_keys(
        self,
        mock_get_audit,
        mock_get_client,
        mock_supabase_client,
        mock_audit_logger
    ):
        """Test bulk rotation when user has no keys"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_audit.return_value = mock_audit_logger

        # User has no keys
        table_mock.execute.return_value = Mock(data=[])

        result = bulk_rotate_user_keys(user_id=100)

        assert result['rotated_count'] == 0
        assert result['new_keys'] == []

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.rotate_api_key')
    def test_bulk_rotate_user_keys_with_environment(
        self,
        mock_rotate_key,
        mock_get_audit,
        mock_get_client,
        mock_supabase_client,
        mock_audit_logger
    ):
        """Test bulk rotation filtered by environment"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_audit.return_value = mock_audit_logger

        user_keys = [{'id': 1, 'key_name': 'test_key'}]
        table_mock.execute.return_value = Mock(data=user_keys)
        mock_rotate_key.return_value = "gw_test_new_key"

        result = bulk_rotate_user_keys(user_id=100, environment_tag='test')

        assert result['rotated_count'] == 1

        # Verify environment filter was applied
        table_mock.eq.assert_any_call('environment_tag', 'test')

    @patch('src.db_security.get_supabase_client')
    @patch('src.db_security.get_audit_logger')
    @patch('src.db_security.rotate_api_key')
    def test_bulk_rotate_user_keys_partial_failure(
        self,
        mock_rotate_key,
        mock_get_audit,
        mock_get_client,
        mock_supabase_client,
        mock_audit_logger
    ):
        """Test bulk rotation when some keys fail"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        mock_get_audit.return_value = mock_audit_logger

        user_keys = [
            {'id': 1, 'key_name': 'key1'},
            {'id': 2, 'key_name': 'key2'}
        ]
        table_mock.execute.return_value = Mock(data=user_keys)

        # First succeeds, second fails
        mock_rotate_key.side_effect = [
            "gw_live_new_key_1",
            Exception("Rotation failed")
        ]

        result = bulk_rotate_user_keys(user_id=100)

        # Should still return successfully rotated keys
        assert result['rotated_count'] == 1
        assert len(result['new_keys']) == 1


# ============================================================
# TEST CLASS: Check Key Name Uniqueness
# ============================================================

class TestCheckKeyNameUniqueness:
    """Test key name uniqueness checking"""

    @patch('src.db_security.get_supabase_client')
    def test_check_key_name_uniqueness_unique(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test that unique name returns True"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # No existing keys with this name
        table_mock.execute.return_value = Mock(data=[])

        result = check_key_name_uniqueness(user_id=100, key_name="unique_key")

        assert result is True

    @patch('src.db_security.get_supabase_client')
    def test_check_key_name_uniqueness_duplicate(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test that duplicate name returns False"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Existing key with same name
        table_mock.execute.return_value = Mock(data=[{'id': 1}])

        result = check_key_name_uniqueness(user_id=100, key_name="duplicate_key")

        assert result is False

    @patch('src.db_security.get_supabase_client')
    def test_check_key_name_uniqueness_with_exclusion(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test uniqueness check excluding a specific key"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        table_mock.execute.return_value = Mock(data=[])

        result = check_key_name_uniqueness(
            user_id=100,
            key_name="key_name",
            exclude_key_id=5
        )

        assert result is True

        # Verify exclusion filter was applied
        table_mock.neq.assert_called_once_with('id', 5)

    @patch('src.db_security.get_supabase_client')
    def test_check_key_name_uniqueness_error_handling(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test that errors return False (safe default)"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Simulate database error
        table_mock.execute.side_effect = Exception("Database error")

        result = check_key_name_uniqueness(user_id=100, key_name="test_key")

        # Should return False on error (assume not unique for safety)
        assert result is False
