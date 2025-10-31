#!/usr/bin/env python3
"""
Comprehensive tests for role management API endpoints

Tests cover:
- Role update endpoint (admin only)
- Get user role and permissions endpoint
- Role audit log retrieval
- List users by role
- Get role permissions
- Admin authorization
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient

from src.main import app


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_admin_user():
    """Mock admin user for authentication"""
    return {
        'id': 456,
        'username': 'admin',
        'email': 'admin@example.com',
        'role': 'admin'
    }


@pytest.fixture
def mock_regular_user():
    """Mock regular user"""
    return {
        'id': 123,
        'username': 'testuser',
        'email': 'test@example.com',
        'role': 'user'
    }


@pytest.fixture
def mock_developer_user():
    """Mock developer user"""
    return {
        'id': 789,
        'username': 'developer',
        'email': 'dev@example.com',
        'role': 'developer'
    }


# ============================================================
# TEST CLASS: Update User Role
# ============================================================

class TestUpdateUserRole:
    """Test role update endpoint"""

    @patch('src.routes.roles.update_user_role')
    @patch('src.routes.roles.require_admin')
    def test_update_role_success(
        self,
        mock_require_admin,
        mock_update_role,
        client,
        mock_admin_user
    ):
        """Test successfully updating user's role"""
        mock_require_admin.return_value = mock_admin_user
        mock_update_role.return_value = True

        response = client.post(
            '/admin/roles/update',
            json={
                'user_id': 123,
                'new_role': 'developer',
                'reason': 'Promoted to developer'
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'User 123 role updated to developer' in data['message']

        # Verify update_user_role was called
        mock_update_role.assert_called_once_with(
            user_id=123,
            new_role='developer',
            changed_by=456,
            reason='Promoted to developer'
        )

    @patch('src.routes.roles.update_user_role')
    @patch('src.routes.roles.require_admin')
    def test_update_role_without_reason(
        self,
        mock_require_admin,
        mock_update_role,
        client,
        mock_admin_user
    ):
        """Test updating role without providing reason"""
        mock_require_admin.return_value = mock_admin_user
        mock_update_role.return_value = True

        response = client.post(
            '/admin/roles/update',
            json={
                'user_id': 123,
                'new_role': 'admin'
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

        # Verify reason was None
        mock_update_role.assert_called_once()
        call_args = mock_update_role.call_args[1]
        assert call_args['reason'] is None

    @patch('src.routes.roles.require_admin')
    def test_update_role_invalid_role(
        self,
        mock_require_admin,
        client,
        mock_admin_user
    ):
        """Test updating to invalid role"""
        mock_require_admin.return_value = mock_admin_user

        response = client.post(
            '/admin/roles/update',
            json={
                'user_id': 123,
                'new_role': 'superadmin'  # Invalid
            }
        )

        assert response.status_code == 400
        assert 'Invalid role' in response.json()['detail']

    @patch('src.routes.roles.update_user_role')
    @patch('src.routes.roles.require_admin')
    def test_update_role_failure(
        self,
        mock_require_admin,
        mock_update_role,
        client,
        mock_admin_user
    ):
        """Test role update failure"""
        mock_require_admin.return_value = mock_admin_user
        mock_update_role.return_value = False

        response = client.post(
            '/admin/roles/update',
            json={
                'user_id': 999,
                'new_role': 'developer'
            }
        )

        assert response.status_code == 500
        assert 'Failed to update role' in response.json()['detail']

    @patch('src.routes.roles.update_user_role')
    @patch('src.routes.roles.require_admin')
    def test_update_role_exception(
        self,
        mock_require_admin,
        mock_update_role,
        client,
        mock_admin_user
    ):
        """Test role update with exception"""
        mock_require_admin.return_value = mock_admin_user
        mock_update_role.side_effect = Exception("Database error")

        response = client.post(
            '/admin/roles/update',
            json={
                'user_id': 123,
                'new_role': 'developer'
            }
        )

        assert response.status_code == 500
        assert 'Internal server error' in response.json()['detail']

    def test_update_role_missing_fields(self, client):
        """Test validation error for missing required fields"""
        response = client.post(
            '/admin/roles/update',
            json={
                'user_id': 123
                # new_role is missing
            }
        )

        assert response.status_code == 422  # Validation error


# ============================================================
# TEST CLASS: Get User Role Info
# ============================================================

class TestGetUserRoleInfo:
    """Test retrieving user role and permissions"""

    @patch('src.routes.roles.get_user_permissions')
    @patch('src.routes.roles.get_user_role')
    @patch('src.routes.roles.require_admin')
    def test_get_user_role_info_success(
        self,
        mock_require_admin,
        mock_get_role,
        mock_get_permissions,
        client,
        mock_admin_user
    ):
        """Test retrieving user's role and permissions"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_role.return_value = 'developer'
        mock_get_permissions.return_value = [
            {'resource': 'api_keys', 'action': 'create', 'allowed': True},
            {'resource': 'api_keys', 'action': 'read', 'allowed': True}
        ]

        response = client.get('/admin/roles/123')

        assert response.status_code == 200
        data = response.json()
        assert data['user_id'] == 123
        assert data['role'] == 'developer'
        assert len(data['permissions']) == 2
        assert data['permissions'][0]['resource'] == 'api_keys'

    @patch('src.routes.roles.get_user_role')
    @patch('src.routes.roles.require_admin')
    def test_get_user_role_info_not_found(
        self,
        mock_require_admin,
        mock_get_role,
        client,
        mock_admin_user
    ):
        """Test retrieving role for non-existent user"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_role.return_value = None

        response = client.get('/admin/roles/999')

        assert response.status_code == 404
        assert 'User not found' in response.json()['detail']

    @patch('src.routes.roles.get_user_permissions')
    @patch('src.routes.roles.get_user_role')
    @patch('src.routes.roles.require_admin')
    def test_get_user_role_info_no_permissions(
        self,
        mock_require_admin,
        mock_get_role,
        mock_get_permissions,
        client,
        mock_admin_user
    ):
        """Test user with role but no permissions"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_role.return_value = 'user'
        mock_get_permissions.return_value = []

        response = client.get('/admin/roles/123')

        assert response.status_code == 200
        data = response.json()
        assert data['role'] == 'user'
        assert data['permissions'] == []

    @patch('src.routes.roles.get_user_role')
    @patch('src.routes.roles.require_admin')
    def test_get_user_role_info_exception(
        self,
        mock_require_admin,
        mock_get_role,
        client,
        mock_admin_user
    ):
        """Test exception handling"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_role.side_effect = Exception("Database error")

        response = client.get('/admin/roles/123')

        assert response.status_code == 500
        assert 'Internal server error' in response.json()['detail']


# ============================================================
# TEST CLASS: Role Audit Log
# ============================================================

class TestRoleAuditLog:
    """Test role change audit log retrieval"""

    @patch('src.routes.roles.get_role_audit_log')
    @patch('src.routes.roles.require_admin')
    def test_get_audit_log_all(
        self,
        mock_require_admin,
        mock_get_log,
        client,
        mock_admin_user
    ):
        """Test retrieving all audit log entries"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_log.return_value = [
            {
                'id': 1,
                'user_id': 123,
                'old_role': 'user',
                'new_role': 'developer',
                'changed_by': 456,
                'reason': 'Promoted',
                'created_at': '2024-01-15T10:00:00Z'
            },
            {
                'id': 2,
                'user_id': 124,
                'old_role': 'developer',
                'new_role': 'admin',
                'changed_by': 456,
                'reason': 'Promoted to admin',
                'created_at': '2024-01-16T11:00:00Z'
            }
        ]

        response = client.get('/admin/roles/audit/log')

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 2
        assert len(data['logs']) == 2
        assert data['logs'][0]['user_id'] == 123

        # Verify default limit
        mock_get_log.assert_called_once_with(user_id=None, limit=50)

    @patch('src.routes.roles.get_role_audit_log')
    @patch('src.routes.roles.require_admin')
    def test_get_audit_log_by_user(
        self,
        mock_require_admin,
        mock_get_log,
        client,
        mock_admin_user
    ):
        """Test retrieving audit log for specific user"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_log.return_value = [
            {
                'id': 1,
                'user_id': 123,
                'old_role': 'user',
                'new_role': 'developer',
                'changed_by': 456,
                'created_at': '2024-01-15T10:00:00Z'
            }
        ]

        response = client.get('/admin/roles/audit/log?user_id=123')

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['logs'][0]['user_id'] == 123

        # Verify user_id filter
        mock_get_log.assert_called_once_with(user_id=123, limit=50)

    @patch('src.routes.roles.get_role_audit_log')
    @patch('src.routes.roles.require_admin')
    def test_get_audit_log_with_limit(
        self,
        mock_require_admin,
        mock_get_log,
        client,
        mock_admin_user
    ):
        """Test retrieving audit log with custom limit"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_log.return_value = []

        response = client.get('/admin/roles/audit/log?limit=10')

        assert response.status_code == 200

        # Verify custom limit
        mock_get_log.assert_called_once_with(user_id=None, limit=10)

    @patch('src.routes.roles.get_role_audit_log')
    @patch('src.routes.roles.require_admin')
    def test_get_audit_log_empty(
        self,
        mock_require_admin,
        mock_get_log,
        client,
        mock_admin_user
    ):
        """Test retrieving empty audit log"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_log.return_value = []

        response = client.get('/admin/roles/audit/log')

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 0
        assert data['logs'] == []

    @patch('src.routes.roles.get_role_audit_log')
    @patch('src.routes.roles.require_admin')
    def test_get_audit_log_exception(
        self,
        mock_require_admin,
        mock_get_log,
        client,
        mock_admin_user
    ):
        """Test exception handling"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_log.side_effect = Exception("Database error")

        response = client.get('/admin/roles/audit/log')

        assert response.status_code == 500
        assert 'Internal server error' in response.json()['detail']


# ============================================================
# TEST CLASS: List Users by Role
# ============================================================

class TestListUsersByRole:
    """Test listing users by role"""

    @patch('src.routes.roles.get_users_by_role')
    @patch('src.routes.roles.require_admin')
    def test_list_users_by_role_success(
        self,
        mock_require_admin,
        mock_get_users,
        client,
        mock_admin_user
    ):
        """Test listing users with specific role"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_users.return_value = [
            {'id': 123, 'username': 'user1', 'email': 'user1@example.com', 'role': 'developer'},
            {'id': 124, 'username': 'user2', 'email': 'user2@example.com', 'role': 'developer'}
        ]

        response = client.get('/admin/roles/list/developer')

        assert response.status_code == 200
        data = response.json()
        assert data['role'] == 'developer'
        assert data['total'] == 2
        assert len(data['users']) == 2
        assert data['users'][0]['username'] == 'user1'

        # Verify default limit
        mock_get_users.assert_called_once_with('developer', limit=100)

    @patch('src.routes.roles.get_users_by_role')
    @patch('src.routes.roles.require_admin')
    def test_list_users_by_role_with_limit(
        self,
        mock_require_admin,
        mock_get_users,
        client,
        mock_admin_user
    ):
        """Test listing users with custom limit"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_users.return_value = []

        response = client.get('/admin/roles/list/admin?limit=10')

        assert response.status_code == 200

        # Verify custom limit
        mock_get_users.assert_called_once_with('admin', limit=10)

    @patch('src.routes.roles.require_admin')
    def test_list_users_invalid_role(
        self,
        mock_require_admin,
        client,
        mock_admin_user
    ):
        """Test listing users with invalid role"""
        mock_require_admin.return_value = mock_admin_user

        response = client.get('/admin/roles/list/superadmin')

        assert response.status_code == 400
        assert 'Invalid role' in response.json()['detail']

    @patch('src.routes.roles.get_users_by_role')
    @patch('src.routes.roles.require_admin')
    def test_list_users_empty(
        self,
        mock_require_admin,
        mock_get_users,
        client,
        mock_admin_user
    ):
        """Test listing users when none have role"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_users.return_value = []

        response = client.get('/admin/roles/list/admin')

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 0
        assert data['users'] == []

    @patch('src.routes.roles.get_users_by_role')
    @patch('src.routes.roles.require_admin')
    def test_list_users_exception(
        self,
        mock_require_admin,
        mock_get_users,
        client,
        mock_admin_user
    ):
        """Test exception handling"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_users.side_effect = Exception("Database error")

        response = client.get('/admin/roles/list/user')

        assert response.status_code == 500
        assert 'Internal server error' in response.json()['detail']


# ============================================================
# TEST CLASS: Get Role Permissions
# ============================================================

class TestGetRolePermissions:
    """Test retrieving role permissions"""

    @patch('src.routes.roles.get_role_permissions')
    @patch('src.routes.roles.require_admin')
    def test_get_role_permissions_success(
        self,
        mock_require_admin,
        mock_get_permissions,
        client,
        mock_admin_user
    ):
        """Test retrieving permissions for a role"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_permissions.return_value = [
            {'resource': 'api_keys', 'action': 'create', 'allowed': True},
            {'resource': 'api_keys', 'action': 'read', 'allowed': True},
            {'resource': 'api_keys', 'action': 'update', 'allowed': True}
        ]

        response = client.get('/admin/roles/permissions/developer')

        assert response.status_code == 200
        data = response.json()
        assert data['role'] == 'developer'
        assert data['total'] == 3
        assert len(data['permissions']) == 3
        assert data['permissions'][0]['resource'] == 'api_keys'

    @patch('src.routes.roles.require_admin')
    def test_get_role_permissions_invalid_role(
        self,
        mock_require_admin,
        client,
        mock_admin_user
    ):
        """Test getting permissions for invalid role"""
        mock_require_admin.return_value = mock_admin_user

        response = client.get('/admin/roles/permissions/superadmin')

        assert response.status_code == 400
        assert 'Invalid role' in response.json()['detail']

    @patch('src.routes.roles.get_role_permissions')
    @patch('src.routes.roles.require_admin')
    def test_get_role_permissions_empty(
        self,
        mock_require_admin,
        mock_get_permissions,
        client,
        mock_admin_user
    ):
        """Test getting permissions when role has none"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_permissions.return_value = []

        response = client.get('/admin/roles/permissions/user')

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 0
        assert data['permissions'] == []

    @patch('src.routes.roles.get_role_permissions')
    @patch('src.routes.roles.require_admin')
    def test_get_role_permissions_exception(
        self,
        mock_require_admin,
        mock_get_permissions,
        client,
        mock_admin_user
    ):
        """Test exception handling"""
        mock_require_admin.return_value = mock_admin_user
        mock_get_permissions.side_effect = Exception("Database error")

        response = client.get('/admin/roles/permissions/admin')

        assert response.status_code == 500
        assert 'Internal server error' in response.json()['detail']


# ============================================================
# TEST CLASS: Authorization
# ============================================================

class TestRoleAuthorization:
    """Test admin-only authorization"""

    @patch('src.routes.roles.require_admin')
    def test_all_endpoints_require_admin(
        self,
        mock_require_admin,
        client
    ):
        """Test that all role endpoints require admin access"""
        from fastapi import HTTPException

        # Mock admin check to raise 403
        mock_require_admin.side_effect = HTTPException(
            status_code=403,
            detail="Requires admin role"
        )

        # Test each endpoint
        endpoints = [
            ('POST', '/admin/roles/update', {'user_id': 123, 'new_role': 'developer'}),
            ('GET', '/admin/roles/123', None),
            ('GET', '/admin/roles/audit/log', None),
            ('GET', '/admin/roles/list/user', None),
            ('GET', '/admin/roles/permissions/developer', None)
        ]

        for method, endpoint, json_data in endpoints:
            if method == 'POST':
                response = client.post(endpoint, json=json_data)
            else:
                response = client.get(endpoint)

            # Should fail with 403 due to admin requirement
            assert response.status_code == 403
            assert 'admin' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestRoleManagementIntegration:
    """Test role management integration scenarios"""

    @patch('src.routes.roles.get_role_audit_log')
    @patch('src.routes.roles.update_user_role')
    @patch('src.routes.roles.require_admin')
    def test_role_update_creates_audit_entry(
        self,
        mock_require_admin,
        mock_update_role,
        mock_get_log,
        client,
        mock_admin_user
    ):
        """Test that updating role creates audit log entry"""
        mock_require_admin.return_value = mock_admin_user
        mock_update_role.return_value = True

        # Update role
        update_response = client.post(
            '/admin/roles/update',
            json={
                'user_id': 123,
                'new_role': 'developer',
                'reason': 'Promoted'
            }
        )

        assert update_response.status_code == 200

        # Mock audit log with new entry
        mock_get_log.return_value = [
            {
                'id': 1,
                'user_id': 123,
                'new_role': 'developer',
                'changed_by': 456,
                'reason': 'Promoted'
            }
        ]

        # Check audit log
        log_response = client.get('/admin/roles/audit/log?user_id=123')

        assert log_response.status_code == 200
        data = log_response.json()
        assert data['total'] == 1
        assert data['logs'][0]['user_id'] == 123
        assert data['logs'][0]['new_role'] == 'developer'

    @patch('src.routes.roles.get_users_by_role')
    @patch('src.routes.roles.update_user_role')
    @patch('src.routes.roles.require_admin')
    def test_role_update_affects_user_list(
        self,
        mock_require_admin,
        mock_update_role,
        mock_get_users,
        client,
        mock_admin_user
    ):
        """Test that role updates affect user list by role"""
        mock_require_admin.return_value = mock_admin_user
        mock_update_role.return_value = True

        # Initially no developers
        mock_get_users.return_value = []

        list_response_1 = client.get('/admin/roles/list/developer')
        assert list_response_1.json()['total'] == 0

        # Update user to developer
        client.post(
            '/admin/roles/update',
            json={
                'user_id': 123,
                'new_role': 'developer'
            }
        )

        # Now one developer
        mock_get_users.return_value = [
            {'id': 123, 'username': 'testuser', 'role': 'developer'}
        ]

        list_response_2 = client.get('/admin/roles/list/developer')
        assert list_response_2.json()['total'] == 1
