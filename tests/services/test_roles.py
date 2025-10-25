#!/usr/bin/env python3
"""
Tests for role-based access control service

Tests cover:
- Role requirements (admin, developer, user)
- Role hierarchy validation
- Permission checking
- Permission checker factory
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException

from src.services.roles import (
    require_role,
    require_admin,
    require_developer,
    require_permission,
    create_permission_checker
)
from src.db.roles import UserRole


# ============================================================
# TEST: Require Role
# ============================================================

class TestRequireRole:
    """Test role requirement function"""

    @pytest.mark.asyncio
    async def test_require_role_admin_success(self):
        """Test admin accessing admin resource"""
        user = {'id': 1, 'role': UserRole.ADMIN}

        result = await require_role(UserRole.ADMIN, user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_role_developer_success(self):
        """Test developer accessing developer resource"""
        user = {'id': 1, 'role': UserRole.DEVELOPER}

        result = await require_role(UserRole.DEVELOPER, user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_role_user_success(self):
        """Test user accessing user resource"""
        user = {'id': 1, 'role': UserRole.USER}

        result = await require_role(UserRole.USER, user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_role_hierarchy_admin_to_dev(self):
        """Test admin can access developer resources"""
        user = {'id': 1, 'role': UserRole.ADMIN}

        result = await require_role(UserRole.DEVELOPER, user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_role_hierarchy_admin_to_user(self):
        """Test admin can access user resources"""
        user = {'id': 1, 'role': UserRole.ADMIN}

        result = await require_role(UserRole.USER, user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_role_hierarchy_dev_to_user(self):
        """Test developer can access user resources"""
        user = {'id': 1, 'role': UserRole.DEVELOPER}

        result = await require_role(UserRole.USER, user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_role_user_cannot_access_dev(self):
        """Test user cannot access developer resources"""
        user = {'id': 1, 'role': UserRole.USER}

        with pytest.raises(HTTPException) as exc_info:
            await require_role(UserRole.DEVELOPER, user)

        assert exc_info.value.status_code == 403
        assert "developer" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_require_role_user_cannot_access_admin(self):
        """Test user cannot access admin resources"""
        user = {'id': 1, 'role': UserRole.USER}

        with pytest.raises(HTTPException) as exc_info:
            await require_role(UserRole.ADMIN, user)

        assert exc_info.value.status_code == 403
        assert "admin" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_require_role_dev_cannot_access_admin(self):
        """Test developer cannot access admin resources"""
        user = {'id': 1, 'role': UserRole.DEVELOPER}

        with pytest.raises(HTTPException) as exc_info:
            await require_role(UserRole.ADMIN, user)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_require_role_default_to_user(self):
        """Test missing role defaults to user level"""
        user = {'id': 1}  # No role specified

        result = await require_role(UserRole.USER, user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_role_unknown_role(self):
        """Test unknown role is rejected"""
        user = {'id': 1, 'role': 'unknown_role'}

        with pytest.raises(HTTPException):
            await require_role(UserRole.ADMIN, user)


# ============================================================
# TEST: Require Admin
# ============================================================

class TestRequireAdmin:
    """Test admin requirement shortcut"""

    @pytest.mark.asyncio
    async def test_require_admin_success(self):
        """Test admin can access admin-only resource"""
        user = {'id': 1, 'role': UserRole.ADMIN}

        result = await require_admin(user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_admin_developer_rejected(self):
        """Test developer cannot access admin-only resource"""
        user = {'id': 1, 'role': UserRole.DEVELOPER}

        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_require_admin_user_rejected(self):
        """Test user cannot access admin-only resource"""
        user = {'id': 1, 'role': UserRole.USER}

        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user)

        assert exc_info.value.status_code == 403


# ============================================================
# TEST: Require Developer
# ============================================================

class TestRequireDeveloper:
    """Test developer requirement shortcut"""

    @pytest.mark.asyncio
    async def test_require_developer_success(self):
        """Test developer can access developer resource"""
        user = {'id': 1, 'role': UserRole.DEVELOPER}

        result = await require_developer(user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_developer_admin_success(self):
        """Test admin can access developer resource"""
        user = {'id': 1, 'role': UserRole.ADMIN}

        result = await require_developer(user)
        assert result == user

    @pytest.mark.asyncio
    async def test_require_developer_user_rejected(self):
        """Test user cannot access developer resource"""
        user = {'id': 1, 'role': UserRole.USER}

        with pytest.raises(HTTPException) as exc_info:
            await require_developer(user)

        assert exc_info.value.status_code == 403


# ============================================================
# TEST: Require Permission
# ============================================================

class TestRequirePermission:
    """Test permission requirement"""

    @pytest.mark.asyncio
    @patch('src.services.roles.check_user_permission')
    async def test_require_permission_granted(self, mock_check):
        """Test permission granted"""
        mock_check.return_value = True
        user = {'id': 1}

        result = await require_permission('coupons', 'create', user)
        assert result == user

        mock_check.assert_called_once_with(1, 'coupons', 'create')

    @pytest.mark.asyncio
    @patch('src.services.roles.check_user_permission')
    async def test_require_permission_denied(self, mock_check):
        """Test permission denied"""
        mock_check.return_value = False
        user = {'id': 1}

        with pytest.raises(HTTPException) as exc_info:
            await require_permission('coupons', 'create', user)

        assert exc_info.value.status_code == 403
        assert "permission denied" in exc_info.value.detail.lower()
        assert "create" in exc_info.value.detail.lower()
        assert "coupons" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    @patch('src.services.roles.check_user_permission')
    async def test_require_permission_different_resources(self, mock_check):
        """Test permission checking for different resources"""
        mock_check.return_value = True
        user = {'id': 1}

        # Test different resource/action combinations
        resources = ['users', 'api_keys', 'billing']
        actions = ['read', 'write', 'delete']

        for resource in resources:
            for action in actions:
                result = await require_permission(resource, action, user)
                assert result == user


# ============================================================
# TEST: Create Permission Checker
# ============================================================

class TestCreatePermissionChecker:
    """Test permission checker factory"""

    @pytest.mark.asyncio
    @patch('src.services.roles.check_user_permission')
    async def test_create_permission_checker_success(self, mock_check):
        """Test permission checker factory"""
        mock_check.return_value = True

        checker = create_permission_checker('coupons', 'create')
        user = {'id': 1}

        result = await checker(user)
        assert result == user

        mock_check.assert_called_once_with(1, 'coupons', 'create')

    @pytest.mark.asyncio
    @patch('src.services.roles.check_user_permission')
    async def test_create_permission_checker_denied(self, mock_check):
        """Test permission checker factory with denied permission"""
        mock_check.return_value = False

        checker = create_permission_checker('coupons', 'delete')
        user = {'id': 1}

        with pytest.raises(HTTPException) as exc_info:
            await checker(user)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    @patch('src.services.roles.check_user_permission')
    async def test_create_permission_checker_multiple_resources(self, mock_check):
        """Test creating multiple permission checkers"""
        mock_check.return_value = True

        # Create different checkers
        coupon_creator = create_permission_checker('coupons', 'create')
        user_reader = create_permission_checker('users', 'read')
        billing_writer = create_permission_checker('billing', 'write')

        user = {'id': 1}

        # All should work
        await coupon_creator(user)
        await user_reader(user)
        await billing_writer(user)

        assert mock_check.call_count == 3
