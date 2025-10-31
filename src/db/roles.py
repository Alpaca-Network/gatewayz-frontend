"""
Role Management Database Layer
Handles user roles and permissions
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


# ============================================
# Role Constants
# ============================================

class UserRole:
    """User role constants"""
    USER = "user"
    DEVELOPER = "developer"
    ADMIN = "admin"


# ============================================
# Permission Checking
# ============================================

def check_user_permission(user_id: int, resource: str, action: str) -> bool:
    """
    Check if user has permission for a specific action on a resource

    Args:
        user_id: User ID
        resource: Resource name (e.g., 'coupons', 'users')
        action: Action name (e.g., 'create', 'read', 'update', 'delete')

    Returns:
        True if user has permission, False otherwise
    """
    try:
        client = get_supabase_client()

        # Call database function
        result = client.rpc('user_has_permission', {
            'p_user_id': user_id,
            'p_resource': resource,
            'p_action': action
        }).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]

        return False

    except Exception as e:
        logger.error(f"Error checking permission: {e}")
        return False


def get_user_permissions(user_id: int) -> List[Dict[str, Any]]:
    """
    Get all permissions for a user

    Args:
        user_id: User ID

    Returns:
        List of permission dictionaries with resource, action, allowed
    """
    try:
        client = get_supabase_client()

        result = client.rpc('get_user_permissions', {
            'p_user_id': user_id
        }).execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error getting user permissions: {e}")
        return []


def get_user_role(user_id: int) -> Optional[str]:
    """
    Get user's role

    Args:
        user_id: User ID

    Returns:
        Role string or None
    """
    try:
        client = get_supabase_client()

        result = client.table('users').select('role').eq('id', user_id).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]['role']

        return None

    except Exception as e:
        logger.error(f"Error getting user role: {e}")
        return None


# ============================================
# Role Management (Admin Only)
# ============================================

def update_user_role(
    user_id: int,
    new_role: str,
    changed_by: Optional[int] = None,
    reason: Optional[str] = None
) -> bool:
    """
    Update a user's role

    Args:
        user_id: User ID to update
        new_role: New role (user, developer, admin)
        changed_by: Admin user ID making the change
        reason: Optional reason for the change

    Returns:
        True if successful, False otherwise
    """
    try:
        if new_role not in [UserRole.USER, UserRole.DEVELOPER, UserRole.ADMIN]:
            raise ValueError(f"Invalid role: {new_role}")

        client = get_supabase_client()

        # Update user role
        result = client.table('users').update({
            'role': new_role,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', user_id).execute()

        if not result.data:
            return False

        # Log the change (trigger will handle this, but we can add extra metadata)
        if changed_by and reason:
            client.table('role_audit_log').insert({
                'user_id': user_id,
                'new_role': new_role,
                'changed_by': changed_by,
                'reason': reason,
                'metadata': {'manual_update': True}
            }).execute()

        logger.info(f"User {user_id} role updated to {new_role} by {changed_by}")
        return True

    except Exception as e:
        logger.error(f"Error updating user role: {e}")
        return False


def get_role_audit_log(user_id: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get role change audit log

    Args:
        user_id: Optional user ID to filter by
        limit: Max number of entries

    Returns:
        List of audit log entries
    """
    try:
        client = get_supabase_client()

        query = client.table('role_audit_log').select('*')

        if user_id:
            query = query.eq('user_id', user_id)

        result = query.order('created_at', desc=True).limit(limit).execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error getting role audit log: {e}")
        return []


def get_users_by_role(role: str, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get all users with a specific role

    Args:
        role: Role to filter by
        limit: Max number of users

    Returns:
        List of users
    """
    try:
        client = get_supabase_client()

        result = client.table('users').select(
            'id, username, email, role, role_metadata, created_at'
        ).eq('role', role).limit(limit).execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error getting users by role: {e}")
        return []


# ============================================
# Role Permissions Management
# ============================================

def get_role_permissions(role: str) -> List[Dict[str, Any]]:
    """
    Get all permissions for a role

    Args:
        role: Role name

    Returns:
        List of permissions
    """
    try:
        client = get_supabase_client()

        result = client.table('role_permissions').select('*').eq('role', role).eq('allowed', True).execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error getting role permissions: {e}")
        return []


def add_role_permission(role: str, resource: str, action: str) -> bool:
    """
    Add a permission to a role

    Args:
        role: Role name
        resource: Resource name
        action: Action name

    Returns:
        True if successful
    """
    try:
        client = get_supabase_client()

        result = client.table('role_permissions').insert({
            'role': role,
            'resource': resource,
            'action': action,
            'allowed': True
        }).execute()

        if result.data:
            logger.info(f"Permission added: {role} can {action} {resource}")
            return True

        return False

    except Exception as e:
        logger.error(f"Error adding role permission: {e}")
        return False


def remove_role_permission(role: str, resource: str, action: str) -> bool:
    """
    Remove a permission from a role

    Args:
        role: Role name
        resource: Resource name
        action: Action name

    Returns:
        True if successful
    """
    try:
        client = get_supabase_client()

        result = client.table('role_permissions').update({
            'allowed': False
        }).eq('role', role).eq('resource', resource).eq('action', action).execute()

        if result.data:
            logger.info(f"Permission removed: {role} cannot {action} {resource}")
            return True

        return False

    except Exception as e:
        logger.error(f"Error removing role permission: {e}")
        return False