"""
Role-Based Access Control Dependencies
FastAPI dependencies for role and permission checking
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import Depends, HTTPException

from src.security.deps import get_current_user
from src.db.roles import check_user_permission, get_user_role, UserRole

logger = logging.getLogger(__name__)


async def require_role(required_role: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Require specific role

    Args:
        required_role: Required role name
        user: Current user

    Returns:
        User if role matches

    Raises:
        HTTPException: 403 if role doesn't match
    """
    user_role = user.get('role', UserRole.USER)

    # Role hierarchy: admin > developer > user
    role_hierarchy = {
        UserRole.ADMIN: 3,
        UserRole.DEVELOPER: 2,
        UserRole.USER: 1
    }

    user_level = role_hierarchy.get(user_role, 0)
    required_level = role_hierarchy.get(required_role, 0)

    if user_level < required_level:
        raise HTTPException(
            status_code=403,
            detail=f"Requires {required_role} role"
        )

    return user


async def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Require admin role"""
    return await require_role(UserRole.ADMIN, user)


async def require_developer(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Require developer role or higher"""
    return await require_role(UserRole.DEVELOPER, user)


async def require_permission(
        resource: str,
        action: str,
        user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Require specific permission

    Args:
        resource: Resource name
        action: Action name
        user: Current user

    Returns:
        User if permission granted

    Raises:
        HTTPException: 403 if permission denied
    """
    user_id = user.get('id')

    if not check_user_permission(user_id, resource, action):
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: cannot {action} {resource}"
        )

    return user


def create_permission_checker(resource: str, action: str):
    """
    Factory function to create permission checker dependency

    Usage:
        @router.post("/coupons", dependencies=[Depends(create_permission_checker("coupons", "create"))])
        async def create_coupon(...):
            ...
    """

    async def check_permission(user: Dict[str, Any] = Depends(get_current_user)):
        return await require_permission(resource, action, user)

    return check_permission