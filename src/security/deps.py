"""
FastAPI Security Dependencies
Dependency injection functions for authentication and authorization
"""

import logging
from typing import Optional, Dict, Any, List
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.security.security import validate_api_key_security, audit_logger
from src.db.users import get_user

logger = logging.getLogger(__name__)

# HTTP Bearer security scheme with auto_error=False to allow custom error handling
security = HTTPBearer(auto_error=False)


async def get_api_key(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        request: Request = None
) -> str:
    """
    Validate API key from Authorization header

    Extracts and validates Bearer token with security checks including:
    - Key existence and format
    - Active status
    - Expiration date
    - Request limits
    - IP allowlist
    - Domain restrictions

    Args:
        credentials: HTTP Authorization credentials
        request: FastAPI request object

    Returns:
        Validated API key string

    Raises:
        HTTPException: 401/403/429 depending on error type
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is required"
        )

    api_key = credentials.credentials
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key is required"
        )

    # Extract security context
    client_ip = None
    referer = None
    user_agent = None

    if request:
        client_ip = request.client.host if request.client else None
        referer = request.headers.get("referer")
        user_agent = request.headers.get("user-agent")

    try:
        # Validate API key with security checks
        validated_key = validate_api_key_security(
            api_key=api_key,
            client_ip=client_ip,
            referer=referer
        )

        # Log successful authentication
        user = get_user(api_key)
        if user and request:
            audit_logger.log_api_key_usage(
                user_id=user['id'],
                key_id=user.get('key_id', 0),
                endpoint=request.url.path,
                ip_address=client_ip or "unknown",
                user_agent=user_agent
            )

        return validated_key

    except ValueError as e:
        error_message = str(e)

        # Map errors to HTTP status codes
        status_code_map = {
            "inactive": 401,
            "expired": 401,
            "limit reached": 429,
            "not allowed": 403,
            "IP address": 403,
            "Domain": 403
        }

        status_code = 401
        for keyword, code in status_code_map.items():
            if keyword in error_message:
                status_code = code
                break

        # Log security violation
        if client_ip:
            audit_logger.log_security_violation(
                violation_type="INVALID_API_KEY",
                details=error_message,
                ip_address=client_ip
            )

        raise HTTPException(status_code=status_code, detail=error_message)

    except Exception as e:
        logger.error(f"Unexpected error validating API key: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal authentication error"
        )


async def get_current_user(api_key: str = Depends(get_api_key)) -> Dict[str, Any]:
    """
    Get the current authenticated user

    Chains with get_api_key to extract full user object.

    Args:
        api_key: Validated API key

    Returns:
        User dictionary with all data

    Raises:
        HTTPException: 404 if user not found
    """
    user = get_user(api_key)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


async def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Require admin role

    Args:
        user: Current user

    Returns:
        User dictionary if admin

    Raises:
        HTTPException: 403 if not admin
    """
    is_admin = user.get('is_admin', False) or user.get('role') == 'admin'

    if not is_admin:
        audit_logger.log_security_violation(
            violation_type="UNAUTHORIZED_ADMIN_ACCESS",
            user_id=user.get('id'),
            details="Non-admin attempted admin endpoint"
        )
        raise HTTPException(
            status_code=403,
            detail="Administrator privileges required"
        )

    return user


async def get_optional_user(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
        request: Request = None
) -> Optional[Dict[str, Any]]:
    """
    Get user if authenticated, None otherwise

    Use for endpoints that work for both auth and non-auth users.

    Args:
        credentials: Optional credentials
        request: Request object

    Returns:
        User dict if authenticated, None otherwise
    """
    if not credentials:
        return None

    try:
        api_key = await get_api_key(credentials, request)
        return get_user(api_key)
    except HTTPException:
        return None


async def require_active_subscription(
        user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Require active subscription

    Args:
        user: Current user

    Returns:
        User if subscription active

    Raises:
        HTTPException: 403 if subscription inactive
    """
    subscription_status = user.get('subscription_status', 'inactive')

    if subscription_status not in ['active', 'trial']:
        raise HTTPException(
            status_code=403,
            detail="Active subscription required"
        )

    return user


async def check_credits(
        user: Dict[str, Any] = Depends(get_current_user),
        min_credits: float = 0.0
) -> Dict[str, Any]:
    """
    Check if user has sufficient credits

    Args:
        user: Current user
        min_credits: Minimum credits required

    Returns:
        User if credits sufficient

    Raises:
        HTTPException: 402 if insufficient credits
    """
    current_credits = user.get('credits', 0.0)

    if current_credits < min_credits:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Required: {min_credits}, Available: {current_credits}"
        )

    return user


async def get_user_id(user: Dict[str, Any] = Depends(get_current_user)) -> int:
    """Extract just the user ID (lightweight dependency)"""
    return user['id']


async def verify_key_permissions(
        api_key: str = Depends(get_api_key),
        required_permissions: List[str] = None
) -> str:
    """
    Verify API key has specific permissions

    Args:
        api_key: Validated API key
        required_permissions: List of required permissions

    Returns:
        API key if permissions valid

    Raises:
        HTTPException: 403 if insufficient permissions
    """
    if not required_permissions:
        return api_key

    user = get_user(api_key)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    scope_permissions = user.get('scope_permissions', {})

    for permission in required_permissions:
        allowed_resources = scope_permissions.get(permission, [])

        if '*' not in allowed_resources and permission not in allowed_resources:
            raise HTTPException(
                status_code=403,
                detail=f"API key lacks '{permission}' permission"
            )

    return api_key
