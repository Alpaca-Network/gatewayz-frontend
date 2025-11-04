#!/usr/bin/env python3
"""
Comprehensive tests for API key management endpoints

Tests cover:
- API key creation with security features
- API key update and rotation
- Bulk key rotation
- API key listing with security status
- API key deletion
- API key usage statistics
- Permission validation
- Error handling
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from src.main import app


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client with dependency overrides"""
    from src.security.deps import get_api_key

    # Override the get_api_key dependency to bypass authentication
    async def override_get_api_key():
        return "gw_live_test1234567890"

    app.dependency_overrides[get_api_key] = override_get_api_key

    client = TestClient(app)
    yield client

    # Cleanup: Remove overrides after test
    app.dependency_overrides.clear()


@pytest.fixture
def mock_api_key():
    """Sample API key"""
    return "gw_live_test1234567890"


@pytest.fixture
def mock_user():
    """Sample user from database"""
    return {
        'id': '1',
        'username': 'testuser',
        'email': 'test@example.com',
        'credits': 100.0
    }


@pytest.fixture
def mock_api_key_data():
    """Sample API key data"""
    return {
        'id': 1,
        'api_key': 'gw_live_abcdef123456',
        'user_id': '1',
        'key_name': 'Production Key',
        'environment_tag': 'live',
        'scope_permissions': {'read': ['*'], 'write': ['api_keys']},
        'is_active': True,
        'is_primary': False,
        'expiration_date': None,
        'max_requests': None,
        'requests_used': 0,
        'ip_allowlist': [],
        'domain_referrers': [],
        'last_used_at': '2024-01-01T12:00:00Z',
        'created_at': '2024-01-01T00:00:00Z',
        'updated_at': '2024-01-01T00:00:00Z'
    }


@pytest.fixture
def mock_api_keys_list():
    """Sample list of API keys"""
    return [
        {
            'id': 1,
            'api_key': 'gw_live_primary123',
            'key_name': 'Primary Key',
            'environment_tag': 'live',
            'is_active': True,
            'is_primary': True,
            'ip_allowlist': ['192.168.1.1'],
            'domain_referrers': [],
            'expiration_date': None,
            'max_requests': None,
            'requests_used': 0,
            'last_used_at': '2024-01-05T12:00:00Z'
        },
        {
            'id': 2,
            'api_key': 'gw_test_secondary456',
            'key_name': 'Test Key',
            'environment_tag': 'test',
            'is_active': True,
            'is_primary': False,
            'ip_allowlist': [],
            'domain_referrers': ['example.com'],
            'expiration_date': '2024-12-31T23:59:59Z',
            'max_requests': 1000,
            'requests_used': 500,
            'last_used_at': '2024-01-03T10:00:00Z'
        }
    ]


@pytest.fixture
def mock_usage_stats():
    """Sample usage statistics"""
    return {
        'total_keys': 2,
        'active_keys': 2,
        'total_requests': 1500,
        'total_tokens': 75000,
        'total_cost': 12.50,
        'keys_usage': [
            {
                'key_id': 1,
                'key_name': 'Primary Key',
                'requests': 1200,
                'tokens': 60000,
                'cost': 10.00,
                'last_used': '2024-01-05T12:00:00Z'
            },
            {
                'key_id': 2,
                'key_name': 'Test Key',
                'requests': 300,
                'tokens': 15000,
                'cost': 2.50,
                'last_used': '2024-01-03T10:00:00Z'
            }
        ]
    }


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client"""
    client = Mock()
    table_mock = Mock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])
    client.table.return_value = table_mock
    return client, table_mock


# ============================================================
# TEST CLASS: API Key Creation
# ============================================================

class TestApiKeyCreation:
    """Test API key creation"""

    @patch('src.security.security.get_audit_logger')
    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.create_api_key')
    def test_create_api_key_success(
        self,
        mock_create_key,
        mock_validate_perms,
        mock_get_user,
        mock_audit_logger,
        client,
        mock_api_key,
        mock_user
    ):
        """Test successful API key creation"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_create_key.return_value = ('gw_live_newkey123456', 123)

        request_data = {
            'action': 'create',
            'key_name': 'New Production Key',
            'environment_tag': 'live',
            'scope_permissions': {'read': ['*'], 'write': ['api_keys']},
            'expiration_days': 90,
            'max_requests': 10000,
            'ip_allowlist': ['192.168.1.100'],
            'domain_referrers': ['myapp.com']
        }

        response = client.post(
            '/user/api-keys',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['api_key'] == 'gw_live_newkey123456'
        assert data['key_name'] == 'New Production Key'
        assert data['environment_tag'] == 'live'
        assert data['security_features']['ip_allowlist'] == ['192.168.1.100']
        assert data['security_features']['domain_referrers'] == ['myapp.com']
        assert data['security_features']['expiration_days'] == 90
        assert data['security_features']['max_requests'] == 10000
        assert data['phase4_integration'] is True

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    def test_create_api_key_insufficient_permissions(
        self,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test API key creation with insufficient permissions"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = False

        request_data = {
            'action': 'create',
            'key_name': 'Test Key',
            'environment_tag': 'test',
            'scope_permissions': {}
        }

        response = client.post(
            '/user/api-keys',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 403
        assert 'insufficient permissions' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    def test_create_api_key_invalid_environment(
        self,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test API key creation with invalid environment tag"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True

        request_data = {
            'action': 'create',
            'key_name': 'Test Key',
            'environment_tag': 'invalid',
            'scope_permissions': {}
        }

        response = client.post(
            '/user/api-keys',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 400
        assert 'invalid environment tag' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    def test_create_api_key_negative_expiration(
        self,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test API key creation with negative expiration days"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True

        request_data = {
            'action': 'create',
            'key_name': 'Test Key',
            'environment_tag': 'test',
            'scope_permissions': {},
            'expiration_days': -10
        }

        response = client.post(
            '/user/api-keys',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 400
        assert 'expiration days must be positive' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.create_api_key')
    def test_create_api_key_duplicate_name(
        self,
        mock_create_key,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test API key creation with duplicate name"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_create_key.side_effect = ValueError("Key with this name already exists")

        request_data = {
            'action': 'create',
            'key_name': 'Existing Key',
            'environment_tag': 'live',
            'scope_permissions': {}
        }

        response = client.post(
            '/user/api-keys',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 400
        assert 'already exists' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: API Key Update
# ============================================================

class TestApiKeyUpdate:
    """Test API key update and rotation"""

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    @patch('src.routes.api_keys.update_api_key')
    def test_update_api_key_success(
        self,
        mock_update_key,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_key_data
    ):
        """Test successfully updating API key"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = mock_api_key_data
        mock_update_key.return_value = True

        updated_key = mock_api_key_data.copy()
        updated_key['key_name'] = 'Updated Key Name'
        mock_get_key_by_id.side_effect = [mock_api_key_data, updated_key]

        request_data = {
            'key_name': 'Updated Key Name'
        }

        response = client.put(
            '/user/api-keys/1',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['updated_key']['key_name'] == 'Updated Key Name'

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    def test_update_api_key_not_found(
        self,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test updating non-existent API key"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = None

        request_data = {
            'key_name': 'Updated Name'
        }

        response = client.put(
            '/user/api-keys/999',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 404
        assert 'not found' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    def test_update_api_key_no_fields(
        self,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_key_data
    ):
        """Test updating API key with no fields"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = mock_api_key_data

        request_data = {}

        response = client.put(
            '/user/api-keys/1',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 400
        assert 'no valid fields' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    @patch('src.routes.api_keys.update_api_key')
    def test_rotate_api_key_success(
        self,
        mock_update_key,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_key_data
    ):
        """Test successfully rotating API key"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = mock_api_key_data
        mock_update_key.return_value = True

        rotated_key = mock_api_key_data.copy()
        rotated_key['api_key'] = 'gw_live_rotated_newkey123'
        mock_get_key_by_id.side_effect = [mock_api_key_data, rotated_key]

        request_data = {
            'action': 'rotate'
        }

        response = client.put(
            '/user/api-keys/1',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert 'rotated' in data['message'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    @patch('src.db_security.bulk_rotate_user_keys')
    def test_bulk_rotate_api_keys_success(
        self,
        mock_bulk_rotate,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_key_data
    ):
        """Test bulk rotation of API keys"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = mock_api_key_data
        mock_bulk_rotate.return_value = {
            'rotated_count': 3,
            'new_keys': [
                {'id': 1, 'api_key': 'gw_live_new1'},
                {'id': 2, 'api_key': 'gw_live_new2'},
                {'id': 3, 'api_key': 'gw_live_new3'}
            ]
        }

        request_data = {
            'action': 'bulk_rotate',
            'environment_tag': 'live'
        }

        response = client.put(
            '/user/api-keys/1',
            json=request_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['rotated_count'] == 3
        assert len(data['new_keys']) == 3


# ============================================================
# TEST CLASS: API Key Listing
# ============================================================

class TestApiKeyListing:
    """Test API key listing"""

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_user_api_keys')
    def test_list_api_keys_success(
        self,
        mock_get_keys,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_keys_list
    ):
        """Test successfully listing API keys"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_keys.return_value = mock_api_keys_list

        response = client.get(
            '/user/api-keys',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['total_keys'] == 2
        assert len(data['keys']) == 2
        assert data['phase4_integration'] is True

        # Verify security status is added
        first_key = data['keys'][0]
        assert 'security_status' in first_key
        assert first_key['security_status']['has_ip_restrictions'] is True
        assert first_key['security_status']['phase4_enhanced'] is True

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    def test_list_api_keys_insufficient_permissions(
        self,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test listing keys with insufficient permissions"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = False

        response = client.get(
            '/user/api-keys',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 403
        assert 'insufficient permissions' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_user_api_keys')
    def test_list_api_keys_empty(
        self,
        mock_get_keys,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test listing when no API keys exist"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_keys.return_value = []

        response = client.get(
            '/user/api-keys',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total_keys'] == 0
        assert len(data['keys']) == 0


# ============================================================
# TEST CLASS: API Key Deletion
# ============================================================

class TestApiKeyDeletion:
    """Test API key deletion"""

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    @patch('src.routes.api_keys.delete_api_key')
    def test_delete_api_key_success(
        self,
        mock_delete_key,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_key_data
    ):
        """Test successfully deleting API key"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = mock_api_key_data
        mock_delete_key.return_value = True

        delete_data = {
            'confirmation': 'DELETE_KEY'
        }

        response = client.request("DELETE",
            '/user/api-keys/1',
            json=delete_data,
            headers={'Authorization': f'Bearer {mock_api_key}', 'Content-Type': 'application/json'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['message'] == 'API key deleted successfully'
        assert data['deleted_key_id'] == 1

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    def test_delete_api_key_wrong_confirmation(
        self,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test deleting API key with wrong confirmation"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True

        delete_data = {
            'confirmation': 'DELETE'
        }

        response = client.request("DELETE",
            '/user/api-keys/1',
            json=delete_data,
            headers={'Authorization': f'Bearer {mock_api_key}', 'Content-Type': 'application/json'}
        )

        assert response.status_code == 400
        assert 'delete_key' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    def test_delete_api_key_not_found(
        self,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test deleting non-existent API key"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = None

        delete_data = {
            'confirmation': 'DELETE_KEY'
        }

        response = client.request("DELETE",
            '/user/api-keys/999',
            json=delete_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 404

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    @patch('src.routes.api_keys.delete_api_key')
    def test_delete_api_key_failed(
        self,
        mock_delete_key,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_key_data
    ):
        """Test API key deletion failure"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = mock_api_key_data
        mock_delete_key.return_value = False

        delete_data = {
            'confirmation': 'DELETE_KEY'
        }

        response = client.request("DELETE",
            '/user/api-keys/1',
            json=delete_data,
            headers={'Authorization': f'Bearer {mock_api_key}', 'Content-Type': 'application/json'}
        )

        assert response.status_code == 500
        assert 'failed to delete' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: API Key Usage
# ============================================================

class TestApiKeyUsage:
    """Test API key usage statistics"""

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.get_user_all_api_keys_usage')
    def test_get_usage_stats_success(
        self,
        mock_get_usage,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_usage_stats
    ):
        """Test successfully getting usage statistics"""
        mock_get_user.return_value = mock_user
        mock_get_usage.return_value = mock_usage_stats

        response = client.get(
            '/user/api-keys/usage',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total_keys'] == 2
        assert data['total_requests'] == 1500
        assert data['total_tokens'] == 75000
        assert data['total_cost'] == 12.50
        assert data['phase4_integration'] is True
        assert 'audit_logging' in data
        assert data['audit_logging']['enabled'] is True

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.get_user_all_api_keys_usage')
    def test_get_usage_stats_failed(
        self,
        mock_get_usage,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test usage statistics retrieval failure"""
        mock_get_user.return_value = mock_user
        mock_get_usage.return_value = None

        response = client.get(
            '/user/api-keys/usage',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 500
        assert 'failed to retrieve' in response.json()['detail'].lower()

    @patch('src.routes.api_keys.get_user')
    def test_get_usage_stats_invalid_key(
        self,
        mock_get_user,
        client
    ):
        """Test usage stats with invalid API key"""
        mock_get_user.return_value = None

        response = client.get(
            '/user/api-keys/usage',
            headers={'Authorization': 'Bearer invalid-key'}
        )

        assert response.status_code == 401


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestApiKeyIntegration:
    """Test API key management integration scenarios"""

    @patch('src.security.security.get_audit_logger')
    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.create_api_key')
    @patch('src.routes.api_keys.get_user_api_keys')
    def test_complete_key_lifecycle(
        self,
        mock_get_keys,
        mock_create_key,
        mock_validate_perms,
        mock_get_user,
        mock_audit_logger,
        client,
        mock_api_key,
        mock_user
    ):
        """Test complete API key lifecycle: create -> list -> use"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True

        # 1. Create new key
        mock_create_key.return_value = ('gw_live_newkey123', 456)

        create_response = client.post(
            '/user/api-keys',
            json={
                'action': 'create',
                'key_name': 'Integration Test Key',
                'environment_tag': 'live',
                'scope_permissions': {}
            },
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert create_response.status_code == 200
        assert create_response.json()['api_key'] == 'gw_live_newkey123'

        # 2. List keys to verify creation
        mock_get_keys.return_value = [{
            'id': 1,
            'api_key': 'gw_live_newkey123',
            'key_name': 'Integration Test Key',
            'environment_tag': 'live',
            'is_active': True,
            'ip_allowlist': [],
            'domain_referrers': []
        }]

        list_response = client.get(
            '/user/api-keys',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert list_response.status_code == 200
        assert list_response.json()['total_keys'] == 1

    @patch('src.routes.api_keys.get_user')
    @patch('src.routes.api_keys.validate_api_key_permissions')
    @patch('src.routes.api_keys.get_api_key_by_id')
    @patch('src.routes.api_keys.update_api_key')
    @patch('src.routes.api_keys.delete_api_key')
    def test_update_then_delete_workflow(
        self,
        mock_delete_key,
        mock_update_key,
        mock_get_key_by_id,
        mock_validate_perms,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_api_key_data
    ):
        """Test updating then deleting a key"""
        mock_get_user.return_value = mock_user
        mock_validate_perms.return_value = True
        mock_get_key_by_id.return_value = mock_api_key_data
        mock_update_key.return_value = True

        # 1. Update key
        updated_key = mock_api_key_data.copy()
        updated_key['key_name'] = 'Updated Key'
        mock_get_key_by_id.side_effect = [
            mock_api_key_data,  # First call (verify ownership)
            updated_key,  # Second call (get updated key)
            updated_key   # Third call (before delete)
        ]

        update_response = client.put(
            '/user/api-keys/1',
            json={'key_name': 'Updated Key'},
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert update_response.status_code == 200

        # 2. Delete key
        mock_delete_key.return_value = True

        delete_response = client.request("DELETE",
            '/user/api-keys/1',
            json={'confirmation': 'DELETE_KEY'},
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert delete_response.status_code == 200
        assert delete_response.json()['status'] == 'success'
