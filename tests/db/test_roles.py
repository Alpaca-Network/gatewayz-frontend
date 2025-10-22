#!/usr/bin/env python3
"""
Comprehensive tests for role management database layer

Tests cover:
- User role retrieval
- User role updates
- Permission checking
- User permission retrieval
- Role permission management
- Role audit logging
- Users by role queries
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from src.db.roles import (
    UserRole,
    check_user_permission,
    get_user_permissions,
    get_user_role,
    update_user_role,
    get_role_audit_log,
    get_users_by_role,
    get_role_permissions,
    add_role_permission,
    remove_role_permission
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with chainable methods"""
    client = Mock()
    table_mock = Mock()
    rpc_mock = Mock()

    client.table.return_value = table_mock
    client.rpc.return_value = rpc_mock

    # Chainable methods
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.insert.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])

    rpc_mock.execute.return_value = Mock(data=[])

    return client, table_mock, rpc_mock


@pytest.fixture
def mock_user_data():
    """Mock user data"""
    return {
        'id': 123,
        'username': 'testuser',
        'email': 'test@example.com',
        'role': UserRole.USER,
        'role_metadata': {},
        'created_at': '2024-01-01T00:00:00Z'
    }


@pytest.fixture
def mock_admin_data():
    """Mock admin user data"""
    return {
        'id': 456,
        'username': 'admin',
        'email': 'admin@example.com',
        'role': UserRole.ADMIN,
        'role_metadata': {},
        'created_at': '2024-01-01T00:00:00Z'
    }


@pytest.fixture
def mock_permission_data():
    """Mock permission data"""
    return {
        'id': 1,
        'role': UserRole.DEVELOPER,
        'resource': 'api_keys',
        'action': 'create',
        'allowed': True,
        'created_at': '2024-01-01T00:00:00Z'
    }


@pytest.fixture
def mock_audit_log_data():
    """Mock role audit log entry"""
    return {
        'id': 1,
        'user_id': 123,
        'old_role': UserRole.USER,
        'new_role': UserRole.DEVELOPER,
        'changed_by': 456,
        'reason': 'Promoted to developer',
        'metadata': {'manual_update': True},
        'created_at': '2024-01-15T10:00:00Z'
    }


# ============================================================
# TEST CLASS: Permission Checking
# ============================================================

class TestPermissionChecking:
    """Test user permission checking"""

    @patch('src.db.roles.get_supabase_client')
    def test_check_user_permission_granted(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test permission check when permission is granted"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC response: permission granted
        rpc_mock.execute.return_value = Mock(data=[True])

        has_permission = check_user_permission(
            user_id=123,
            resource='api_keys',
            action='create'
        )

        assert has_permission is True
        client.rpc.assert_called_once_with('user_has_permission', {
            'p_user_id': 123,
            'p_resource': 'api_keys',
            'p_action': 'create'
        })

    @patch('src.db.roles.get_supabase_client')
    def test_check_user_permission_denied(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test permission check when permission is denied"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC response: permission denied
        rpc_mock.execute.return_value = Mock(data=[False])

        has_permission = check_user_permission(
            user_id=123,
            resource='admin_panel',
            action='access'
        )

        assert has_permission is False

    @patch('src.db.roles.get_supabase_client')
    def test_check_user_permission_no_data(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test permission check when no data is returned"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC response: no data
        rpc_mock.execute.return_value = Mock(data=[])

        has_permission = check_user_permission(
            user_id=123,
            resource='unknown',
            action='unknown'
        )

        assert has_permission is False

    @patch('src.db.roles.get_supabase_client')
    def test_check_user_permission_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test permission check with database error"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC error
        client.rpc.side_effect = Exception("Database error")

        has_permission = check_user_permission(
            user_id=123,
            resource='api_keys',
            action='create'
        )

        assert has_permission is False

    @patch('src.db.roles.get_supabase_client')
    def test_get_user_permissions_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_permission_data
    ):
        """Test retrieving all user permissions"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC response with multiple permissions
        permissions_data = [
            {'resource': 'api_keys', 'action': 'create', 'allowed': True},
            {'resource': 'api_keys', 'action': 'read', 'allowed': True},
            {'resource': 'api_keys', 'action': 'delete', 'allowed': True}
        ]
        rpc_mock.execute.return_value = Mock(data=permissions_data)

        permissions = get_user_permissions(user_id=123)

        assert len(permissions) == 3
        assert permissions[0]['resource'] == 'api_keys'
        assert permissions[0]['action'] == 'create'
        client.rpc.assert_called_once_with('get_user_permissions', {
            'p_user_id': 123
        })

    @patch('src.db.roles.get_supabase_client')
    def test_get_user_permissions_empty(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving permissions when user has none"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC response: no permissions
        rpc_mock.execute.return_value = Mock(data=[])

        permissions = get_user_permissions(user_id=123)

        assert permissions == []

    @patch('src.db.roles.get_supabase_client')
    def test_get_user_permissions_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when retrieving permissions"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC error
        client.rpc.side_effect = Exception("Database error")

        permissions = get_user_permissions(user_id=123)

        assert permissions == []


# ============================================================
# TEST CLASS: User Role Management
# ============================================================

class TestUserRoleManagement:
    """Test user role retrieval and updates"""

    @patch('src.db.roles.get_supabase_client')
    def test_get_user_role_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_user_data
    ):
        """Test retrieving user's role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock table response
        table_mock.execute.return_value = Mock(data=[mock_user_data])

        role = get_user_role(user_id=123)

        assert role == UserRole.USER
        client.table.assert_called_once_with('users')
        table_mock.select.assert_called_once_with('role')
        table_mock.eq.assert_called_once_with('id', 123)

    @patch('src.db.roles.get_supabase_client')
    def test_get_user_role_not_found(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving role for non-existent user"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock table response: no data
        table_mock.execute.return_value = Mock(data=[])

        role = get_user_role(user_id=999)

        assert role is None

    @patch('src.db.roles.get_supabase_client')
    def test_get_user_role_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when getting user role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock table error
        client.table.side_effect = Exception("Database error")

        role = get_user_role(user_id=123)

        assert role is None

    @patch('src.db.roles.get_supabase_client')
    def test_update_user_role_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_user_data
    ):
        """Test successfully updating user's role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock update response
        updated_user = {**mock_user_data, 'role': UserRole.DEVELOPER}
        table_mock.execute.return_value = Mock(data=[updated_user])

        success = update_user_role(
            user_id=123,
            new_role=UserRole.DEVELOPER,
            changed_by=456,
            reason='Promoted to developer'
        )

        assert success is True

        # Verify update was called
        table_mock.update.assert_called()
        update_call = table_mock.update.call_args[0][0]
        assert update_call['role'] == UserRole.DEVELOPER
        assert 'updated_at' in update_call

    @patch('src.db.roles.get_supabase_client')
    def test_update_user_role_with_audit_log(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_user_data
    ):
        """Test role update creates audit log entry"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock update response
        updated_user = {**mock_user_data, 'role': UserRole.ADMIN}

        # Create separate mocks for users and role_audit_log tables
        def table_side_effect(table_name):
            if table_name == 'users':
                users_mock = Mock()
                users_mock.update.return_value = users_mock
                users_mock.eq.return_value = users_mock
                users_mock.execute.return_value = Mock(data=[updated_user])
                return users_mock
            elif table_name == 'role_audit_log':
                audit_mock = Mock()
                audit_mock.insert.return_value = audit_mock
                audit_mock.execute.return_value = Mock(data=[{'id': 1}])
                return audit_mock

        client.table.side_effect = table_side_effect

        success = update_user_role(
            user_id=123,
            new_role=UserRole.ADMIN,
            changed_by=456,
            reason='Promoted to admin'
        )

        assert success is True

        # Verify audit log was created
        assert client.table.call_count >= 2

    @patch('src.db.roles.get_supabase_client')
    def test_update_user_role_invalid_role(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test updating to invalid role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        success = update_user_role(
            user_id=123,
            new_role='superadmin',  # Invalid role
            changed_by=456
        )

        assert success is False

    @patch('src.db.roles.get_supabase_client')
    def test_update_user_role_no_data(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test role update when no data is returned"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock update response: no data (user not found)
        table_mock.execute.return_value = Mock(data=[])

        success = update_user_role(
            user_id=999,
            new_role=UserRole.DEVELOPER
        )

        assert success is False

    @patch('src.db.roles.get_supabase_client')
    def test_update_user_role_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling during role update"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock update error
        client.table.side_effect = Exception("Database error")

        success = update_user_role(
            user_id=123,
            new_role=UserRole.DEVELOPER
        )

        assert success is False


# ============================================================
# TEST CLASS: Role Audit Log
# ============================================================

class TestRoleAuditLog:
    """Test role change audit logging"""

    @patch('src.db.roles.get_supabase_client')
    def test_get_role_audit_log_all(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_audit_log_data
    ):
        """Test retrieving all audit log entries"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock audit log response with multiple entries
        audit_logs = [
            mock_audit_log_data,
            {**mock_audit_log_data, 'id': 2, 'user_id': 456}
        ]
        table_mock.execute.return_value = Mock(data=audit_logs)

        logs = get_role_audit_log(limit=50)

        assert len(logs) == 2
        assert logs[0]['user_id'] == 123
        assert logs[1]['user_id'] == 456

        client.table.assert_called_once_with('role_audit_log')
        table_mock.select.assert_called_once_with('*')
        table_mock.order.assert_called_once_with('created_at', desc=True)
        table_mock.limit.assert_called_once_with(50)

    @patch('src.db.roles.get_supabase_client')
    def test_get_role_audit_log_by_user(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_audit_log_data
    ):
        """Test retrieving audit log for specific user"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock audit log response
        table_mock.execute.return_value = Mock(data=[mock_audit_log_data])

        logs = get_role_audit_log(user_id=123, limit=50)

        assert len(logs) == 1
        assert logs[0]['user_id'] == 123

        # Verify user_id filter was applied
        table_mock.eq.assert_called_once_with('user_id', 123)

    @patch('src.db.roles.get_supabase_client')
    def test_get_role_audit_log_empty(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving empty audit log"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock empty response
        table_mock.execute.return_value = Mock(data=[])

        logs = get_role_audit_log()

        assert logs == []

    @patch('src.db.roles.get_supabase_client')
    def test_get_role_audit_log_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when retrieving audit log"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock error
        client.table.side_effect = Exception("Database error")

        logs = get_role_audit_log()

        assert logs == []


# ============================================================
# TEST CLASS: Users by Role
# ============================================================

class TestUsersByRole:
    """Test retrieving users by role"""

    @patch('src.db.roles.get_supabase_client')
    def test_get_users_by_role_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_user_data
    ):
        """Test retrieving users with specific role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock users response
        users = [
            mock_user_data,
            {**mock_user_data, 'id': 124, 'username': 'testuser2'}
        ]
        table_mock.execute.return_value = Mock(data=users)

        result = get_users_by_role(role=UserRole.USER, limit=100)

        assert len(result) == 2
        assert result[0]['role'] == UserRole.USER

        client.table.assert_called_once_with('users')
        table_mock.eq.assert_called_once_with('role', UserRole.USER)
        table_mock.limit.assert_called_once_with(100)

    @patch('src.db.roles.get_supabase_client')
    def test_get_users_by_role_admin(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_admin_data
    ):
        """Test retrieving admin users"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock admin users response
        table_mock.execute.return_value = Mock(data=[mock_admin_data])

        result = get_users_by_role(role=UserRole.ADMIN, limit=100)

        assert len(result) == 1
        assert result[0]['role'] == UserRole.ADMIN
        assert result[0]['username'] == 'admin'

    @patch('src.db.roles.get_supabase_client')
    def test_get_users_by_role_empty(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving users when none have role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock empty response
        table_mock.execute.return_value = Mock(data=[])

        result = get_users_by_role(role=UserRole.DEVELOPER, limit=100)

        assert result == []

    @patch('src.db.roles.get_supabase_client')
    def test_get_users_by_role_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when retrieving users by role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock error
        client.table.side_effect = Exception("Database error")

        result = get_users_by_role(role=UserRole.USER)

        assert result == []


# ============================================================
# TEST CLASS: Role Permissions Management
# ============================================================

class TestRolePermissionsManagement:
    """Test role permissions CRUD operations"""

    @patch('src.db.roles.get_supabase_client')
    def test_get_role_permissions_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_permission_data
    ):
        """Test retrieving all permissions for a role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock permissions response
        permissions = [
            mock_permission_data,
            {**mock_permission_data, 'action': 'read'},
            {**mock_permission_data, 'action': 'update'}
        ]
        table_mock.execute.return_value = Mock(data=permissions)

        result = get_role_permissions(role=UserRole.DEVELOPER)

        assert len(result) == 3
        assert result[0]['resource'] == 'api_keys'

        client.table.assert_called_once_with('role_permissions')
        table_mock.eq.assert_any_call('role', UserRole.DEVELOPER)
        table_mock.eq.assert_any_call('allowed', True)

    @patch('src.db.roles.get_supabase_client')
    def test_get_role_permissions_empty(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving permissions when role has none"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock empty response
        table_mock.execute.return_value = Mock(data=[])

        result = get_role_permissions(role=UserRole.USER)

        assert result == []

    @patch('src.db.roles.get_supabase_client')
    def test_add_role_permission_success(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test adding permission to a role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock insert response
        table_mock.execute.return_value = Mock(data=[{'id': 1}])

        success = add_role_permission(
            role=UserRole.DEVELOPER,
            resource='api_keys',
            action='create'
        )

        assert success is True

        client.table.assert_called_once_with('role_permissions')
        table_mock.insert.assert_called_once()
        insert_data = table_mock.insert.call_args[0][0]
        assert insert_data['role'] == UserRole.DEVELOPER
        assert insert_data['resource'] == 'api_keys'
        assert insert_data['action'] == 'create'
        assert insert_data['allowed'] is True

    @patch('src.db.roles.get_supabase_client')
    def test_add_role_permission_no_data(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test adding permission when no data is returned"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock insert response: no data
        table_mock.execute.return_value = Mock(data=None)

        success = add_role_permission(
            role=UserRole.USER,
            resource='api_keys',
            action='read'
        )

        assert success is False

    @patch('src.db.roles.get_supabase_client')
    def test_add_role_permission_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when adding permission"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock error
        client.table.side_effect = Exception("Database error")

        success = add_role_permission(
            role=UserRole.DEVELOPER,
            resource='api_keys',
            action='delete'
        )

        assert success is False

    @patch('src.db.roles.get_supabase_client')
    def test_remove_role_permission_success(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test removing permission from a role"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock update response
        table_mock.execute.return_value = Mock(data=[{'id': 1, 'allowed': False}])

        success = remove_role_permission(
            role=UserRole.USER,
            resource='admin_panel',
            action='access'
        )

        assert success is True

        client.table.assert_called_once_with('role_permissions')
        table_mock.update.assert_called_once_with({'allowed': False})

        # Verify all filters were applied
        assert table_mock.eq.call_count == 3

    @patch('src.db.roles.get_supabase_client')
    def test_remove_role_permission_no_data(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test removing permission when no data is returned"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock update response: no data
        table_mock.execute.return_value = Mock(data=None)

        success = remove_role_permission(
            role=UserRole.DEVELOPER,
            resource='api_keys',
            action='delete'
        )

        assert success is False

    @patch('src.db.roles.get_supabase_client')
    def test_remove_role_permission_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when removing permission"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock error
        client.table.side_effect = Exception("Database error")

        success = remove_role_permission(
            role=UserRole.USER,
            resource='api_keys',
            action='create'
        )

        assert success is False


# ============================================================
# TEST CLASS: Role Constants
# ============================================================

class TestRoleConstants:
    """Test role constants and validation"""

    def test_user_role_constants(self):
        """Test role constant values"""
        assert UserRole.USER == "user"
        assert UserRole.DEVELOPER == "developer"
        assert UserRole.ADMIN == "admin"

    def test_role_constants_are_strings(self):
        """Test all role constants are strings"""
        assert isinstance(UserRole.USER, str)
        assert isinstance(UserRole.DEVELOPER, str)
        assert isinstance(UserRole.ADMIN, str)

    def test_role_constants_uniqueness(self):
        """Test all role constants are unique"""
        roles = {UserRole.USER, UserRole.DEVELOPER, UserRole.ADMIN}
        assert len(roles) == 3
