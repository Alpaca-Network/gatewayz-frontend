"""
API routes for role management (Admin only)
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.db.roles import (
    update_user_role,
    get_role_audit_log,
    get_users_by_role,
    get_role_permissions,
    get_user_permissions,
    get_user_role,
    UserRole
)
from src.security.deps import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================
# Schemas
# ============================================

class UpdateRoleRequest(BaseModel):
    user_id: int
    new_role: str
    reason: Optional[str] = None


class RoleResponse(BaseModel):
    user_id: int
    role: str
    permissions: List[dict]


class RoleAuditLogResponse(BaseModel):
    logs: List[dict]
    total: int


# ============================================
# Role Management Endpoints
# ============================================

@router.post("/admin/roles/update", tags=["admin", "roles"])
async def update_role(
        request: UpdateRoleRequest,
        admin_user: dict = Depends(require_admin)
):
    """
    Update a user's role (Admin only)

    Roles:
    - user: Basic user access
    - developer: Extended API access
    - admin: Full system access
    """
    try:
        if request.new_role not in [UserRole.USER, UserRole.DEVELOPER, UserRole.ADMIN]:
            raise HTTPException(status_code=400, detail="Invalid role")

        success = update_user_role(
            user_id=request.user_id,
            new_role=request.new_role,
            changed_by=admin_user['id'],
            reason=request.reason
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update role")

        return {
            "success": True,
            "message": f"User {request.user_id} role updated to {request.new_role}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating role: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/admin/roles/{user_id}", response_model=RoleResponse, tags=["admin", "roles"])
async def get_user_role_info(
        user_id: int,
        admin_user: dict = Depends(require_admin)
):
    """Get user's role and permissions (Admin only)"""
    try:
        role = get_user_role(user_id)
        if not role:
            raise HTTPException(status_code=404, detail="User not found")

        permissions = get_user_permissions(user_id)

        return RoleResponse(
            user_id=user_id,
            role=role,
            permissions=permissions
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user role: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/admin/roles/audit/log", response_model=RoleAuditLogResponse, tags=["admin", "roles"])
async def get_audit_log(
        user_id: Optional[int] = None,
        limit: int = 50,
        admin_user: dict = Depends(require_admin)
):
    """Get role change audit log (Admin only)"""
    try:
        logs = get_role_audit_log(user_id=user_id, limit=limit)

        return RoleAuditLogResponse(
            logs=logs,
            total=len(logs)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting audit log: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/admin/roles/list/{role}", tags=["admin", "roles"])
async def list_users_by_role(
        role: str,
        limit: int = 100,
        admin_user: dict = Depends(require_admin)
):
    """List all users with a specific role (Admin only)"""
    try:
        if role not in [UserRole.USER, UserRole.DEVELOPER, UserRole.ADMIN]:
            raise HTTPException(status_code=400, detail="Invalid role")

        users = get_users_by_role(role, limit=limit)

        return {
            "role": role,
            "users": users,
            "total": len(users)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing users by role: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/admin/roles/permissions/{role}", tags=["admin", "roles"])
async def get_role_permissions_endpoint(
        role: str,
        admin_user: dict = Depends(require_admin)
):
    """Get all permissions for a role (Admin only)"""
    try:
        if role not in [UserRole.USER, UserRole.DEVELOPER, UserRole.ADMIN]:
            raise HTTPException(status_code=400, detail="Invalid role")

        permissions = get_role_permissions(role)

        return {
            "role": role,
            "permissions": permissions,
            "total": len(permissions)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting role permissions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")