#!/usr/bin/env python3
"""
Comprehensive tests for audit log endpoints

Tests cover:
- Audit log retrieval for API keys
- Filtering by key_id, action, date range
- Pagination with limit
- Permission validation
- Date parsing and validation
- Authentication
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from datetime import datetime

from src.main import app
from src.security.deps import get_api_key


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    # Override the get_api_key dependency
    app.dependency_overrides[get_api_key] = lambda: 'test_api_key'

    test_client = TestClient(app)

    yield test_client

    # Clean up dependency overrides
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user_data():
    """Mock user data"""
    return {
        'id': 123,
        'username': 'testuser',
        'email': 'test@example.com',
        'role': 'user'
    }


@pytest.fixture
def mock_audit_logs():
    """Mock audit log entries"""
    return [
        {
            'id': 1,
            'user_id': 123,
            'api_key_id': 456,
            'action': 'key_created',
            'timestamp': '2024-01-15T10:00:00Z',
            'ip_address': '192.168.1.1',
            'metadata': {
                'key_name': 'Production API Key',
                'environment': 'live'
            }
        },
        {
            'id': 2,
            'user_id': 123,
            'api_key_id': 456,
            'action': 'key_used',
            'timestamp': '2024-01-15T11:00:00Z',
            'ip_address': '192.168.1.1',
            'metadata': {
                'endpoint': '/v1/chat/completions',
                'model': 'gpt-4'
            }
        },
        {
            'id': 3,
            'user_id': 123,
            'api_key_id': 457,
            'action': 'key_rotated',
            'timestamp': '2024-01-16T09:00:00Z',
            'ip_address': '192.168.1.2',
            'metadata': {
                'old_key_id': 456,
                'new_key_id': 457
            }
        }
    ]


# ============================================================
# TEST CLASS: Audit Log Retrieval
# ============================================================

class TestGetAuditLogs:
    """Test audit log retrieval endpoint"""

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_success(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test successfully retrieving audit logs"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.return_value = mock_audit_logs

        response = client.get(
            '/user/api-keys/audit-logs'
        )

        assert response.status_code == 200
        data = response.json()

        assert data['status'] == 'success'
        assert data['total_logs'] == 3
        assert len(data['logs']) == 3
        assert data['logs'][0]['action'] == 'key_created'
        assert data['phase4_integration'] is True
        assert data['security_features_enabled'] is True

        # Verify get_audit_logs was called with correct parameters
        mock_get_logs.assert_called_once_with(
            user_id=123,
            key_id=None,
            action=None,
            start_date=None,
            end_date=None,
            limit=100
        )

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_with_key_filter(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test retrieving audit logs filtered by key_id"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True

        # Return only logs for key_id 456
        filtered_logs = [log for log in mock_audit_logs if log['api_key_id'] == 456]
        mock_get_logs.return_value = filtered_logs

        response = client.get(
            '/user/api-keys/audit-logs?key_id=456',
        )

        assert response.status_code == 200
        data = response.json()

        assert data['total_logs'] == 2
        assert all(log['api_key_id'] == 456 for log in data['logs'])

        # Verify key_id filter was passed
        mock_get_logs.assert_called_once()
        call_args = mock_get_logs.call_args[1]
        assert call_args['key_id'] == 456

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_with_action_filter(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test retrieving audit logs filtered by action"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True

        # Return only logs for specific action
        filtered_logs = [log for log in mock_audit_logs if log['action'] == 'key_created']
        mock_get_logs.return_value = filtered_logs

        response = client.get(
            '/user/api-keys/audit-logs?action=key_created',
        )

        assert response.status_code == 200
        data = response.json()

        assert data['total_logs'] == 1
        assert data['logs'][0]['action'] == 'key_created'

        # Verify action filter was passed
        mock_get_logs.assert_called_once()
        call_args = mock_get_logs.call_args[1]
        assert call_args['action'] == 'key_created'

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_with_date_range(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test retrieving audit logs with date range"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.return_value = mock_audit_logs

        response = client.get(
            '/user/api-keys/audit-logs?start_date=2024-01-15T00:00:00Z&end_date=2024-01-31T23:59:59Z',
        )

        assert response.status_code == 200

        # Verify dates were parsed and passed
        mock_get_logs.assert_called_once()
        call_args = mock_get_logs.call_args[1]
        assert call_args['start_date'] is not None
        assert call_args['end_date'] is not None
        assert isinstance(call_args['start_date'], datetime)
        assert isinstance(call_args['end_date'], datetime)

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_with_limit(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test retrieving audit logs with custom limit"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.return_value = mock_audit_logs[:2]  # Only return 2

        response = client.get(
            '/user/api-keys/audit-logs?limit=2',
        )

        assert response.status_code == 200
        data = response.json()

        assert data['total_logs'] == 2

        # Verify limit was passed
        mock_get_logs.assert_called_once()
        call_args = mock_get_logs.call_args[1]
        assert call_args['limit'] == 2

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_combined_filters(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test retrieving audit logs with multiple filters"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.return_value = [mock_audit_logs[0]]

        response = client.get(
            '/user/api-keys/audit-logs?key_id=456&action=key_created&start_date=2024-01-15T00:00:00Z&limit=10',
        )

        assert response.status_code == 200

        # Verify all filters were passed
        mock_get_logs.assert_called_once()
        call_args = mock_get_logs.call_args[1]
        assert call_args['key_id'] == 456
        assert call_args['action'] == 'key_created'
        assert call_args['start_date'] is not None
        assert call_args['limit'] == 10

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_empty(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data
    ):
        """Test retrieving empty audit logs"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.return_value = []

        response = client.get(
            '/user/api-keys/audit-logs',
        )

        assert response.status_code == 200
        data = response.json()

        assert data['total_logs'] == 0
        assert data['logs'] == []


# ============================================================
# TEST CLASS: Authentication and Authorization
# ============================================================

class TestAuditAuthentication:
    """Test authentication and authorization"""

    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_invalid_api_key(
        self,
        mock_get_user,
        client
    ):
        """Test retrieving audit logs with invalid API key"""
        mock_get_user.return_value = None

        response = client.get(
            '/user/api-keys/audit-logs',
            headers={'X-API-Key': 'invalid_key'}
        )

        assert response.status_code == 401
        assert 'Invalid API key' in response.json()['detail']

    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_insufficient_permissions(
        self,
        mock_get_user,
        mock_validate_perms,
        client,
        mock_user_data
    ):
        """Test retrieving audit logs without sufficient permissions"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = False

        response = client.get(
            '/user/api-keys/audit-logs',
        )

        assert response.status_code == 403
        assert 'Insufficient permissions' in response.json()['detail']

        # Verify permission check was called
        mock_validate_perms.assert_called_once_with(
            'test_api_key',
            'read',
            'api_keys'
        )

    def test_get_audit_logs_missing_api_key(self, client):
        """Test retrieving audit logs without API key"""
        response = client.get('/user/api-keys/audit-logs')

        # Should fail due to missing API key
        assert response.status_code in [401, 422]


# ============================================================
# TEST CLASS: Date Validation
# ============================================================

class TestAuditDateValidation:
    """Test date parsing and validation"""

    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_invalid_start_date(
        self,
        mock_get_user,
        mock_validate_perms,
        client,
        mock_user_data
    ):
        """Test invalid start_date format"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True

        response = client.get(
            '/user/api-keys/audit-logs?start_date=invalid-date',
        )

        assert response.status_code == 400
        assert 'Invalid start_date format' in response.json()['detail']

    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_invalid_end_date(
        self,
        mock_get_user,
        mock_validate_perms,
        client,
        mock_user_data
    ):
        """Test invalid end_date format"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True

        response = client.get(
            '/user/api-keys/audit-logs?end_date=not-a-date',
        )

        assert response.status_code == 400
        assert 'Invalid end_date format' in response.json()['detail']

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_valid_iso_dates(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test valid ISO date formats"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.return_value = mock_audit_logs

        # Test various valid ISO formats
        # Note: The implementation supports Z (which gets converted to +00:00)
        # but does not support explicit +00:00 format
        valid_dates = [
            '2024-01-15T10:00:00Z',
            '2024-01-15T10:00:00.000Z'
        ]

        for date_str in valid_dates:
            response = client.get(
                f'/user/api-keys/audit-logs?start_date={date_str}'
            )

            # Should succeed with valid ISO dates
            assert response.status_code == 200


# ============================================================
# TEST CLASS: Error Handling
# ============================================================

class TestAuditErrorHandling:
    """Test error handling"""

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_database_error(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data
    ):
        """Test error handling when database fails"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.side_effect = Exception("Database connection error")

        response = client.get(
            '/user/api-keys/audit-logs',
        )

        assert response.status_code == 500
        assert 'Internal server error' in response.json()['detail']

    @patch('src.routes.audit.get_user')
    def test_get_audit_logs_user_lookup_error(
        self,
        mock_get_user,
        client
    ):
        """Test error handling when user lookup fails"""
        mock_get_user.side_effect = Exception("Database error")

        response = client.get(
            '/user/api-keys/audit-logs',
        )

        assert response.status_code == 500
        assert 'Internal server error' in response.json()['detail']


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestAuditIntegration:
    """Test audit log integration scenarios"""

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_audit_log_filtering_workflow(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test complete filtering workflow"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True

        # 1. Get all logs
        mock_get_logs.return_value = mock_audit_logs
        response1 = client.get(
            '/user/api-keys/audit-logs',
        )
        assert response1.json()['total_logs'] == 3

        # 2. Filter by key
        mock_get_logs.return_value = [mock_audit_logs[0], mock_audit_logs[1]]
        response2 = client.get(
            '/user/api-keys/audit-logs?key_id=456',
        )
        assert response2.json()['total_logs'] == 2

        # 3. Further filter by action
        mock_get_logs.return_value = [mock_audit_logs[0]]
        response3 = client.get(
            '/user/api-keys/audit-logs?key_id=456&action=key_created',
        )
        assert response3.json()['total_logs'] == 1

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_audit_log_pagination(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test pagination with limit parameter"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True

        # Get first page
        mock_get_logs.return_value = mock_audit_logs[:2]
        response1 = client.get(
            '/user/api-keys/audit-logs?limit=2',
        )
        assert response1.json()['total_logs'] == 2

        # Get all logs
        mock_get_logs.return_value = mock_audit_logs
        response2 = client.get(
            '/user/api-keys/audit-logs?limit=100',
        )
        assert response2.json()['total_logs'] == 3

    @patch('src.db_security.get_audit_logs')
    @patch('src.routes.audit.validate_api_key_permissions')
    @patch('src.routes.audit.get_user')
    def test_audit_log_metadata_structure(
        self,
        mock_get_user,
        mock_validate_perms,
        mock_get_logs,
        client,
        mock_user_data,
        mock_audit_logs
    ):
        """Test audit log response includes metadata"""
        mock_get_user.return_value = mock_user_data
        mock_validate_perms.return_value = True
        mock_get_logs.return_value = mock_audit_logs

        response = client.get(
            '/user/api-keys/audit-logs',
        )

        data = response.json()

        # Check metadata in logs
        assert all('metadata' in log for log in data['logs'])
        assert data['logs'][0]['metadata']['key_name'] == 'Production API Key'
        assert data['logs'][1]['metadata']['endpoint'] == '/v1/chat/completions'

        # Check response structure includes Phase 4 flags
        assert data['phase4_integration'] is True
        assert data['security_features_enabled'] is True
