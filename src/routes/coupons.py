"""
API routes for coupon system
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from src.db.coupons import (
    create_coupon,
    deactivate_coupon,
    get_all_coupons_stats,
    get_available_coupons_for_user,
    get_coupon_analytics,
    get_coupon_by_id,
    get_user_redemption_history,
    list_coupons,
    redeem_coupon,
    update_coupon,
)
from src.schemas.coupons import (
    AvailableCouponResponse,
    CouponAnalyticsResponse,
    CouponResponse,
    CouponStatsResponse,
    CreateCouponRequest,
    ListCouponsResponse,
    RedeemCouponRequest,
    RedemptionHistoryItem,
    RedemptionHistoryResponse,
    RedemptionResponse,
    UpdateCouponRequest,
)
from src.security.deps import get_current_user, require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================
# User Endpoints
# ============================================


@router.post("/coupons/redeem", response_model=RedemptionResponse, tags=["coupons"])
async def redeem_coupon_endpoint(
    request: Request,
    redemption_request: RedeemCouponRequest,
    user: dict = Depends(get_current_user),
):
    """
    Redeem a coupon code

    - Validates the coupon
    - Checks if user can redeem it
    - Adds credits to user balance
    - Records the redemption
    """
    try:
        user_id = user["id"]

        # Get client info for audit
        client_host = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # Redeem the coupon
        result = redeem_coupon(
            code=redemption_request.code,
            user_id=user_id,
            ip_address=client_host,
            user_agent=user_agent,
        )

        if not result["success"]:
            return JSONResponse(status_code=400, content=result)

        return RedemptionResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in redeem coupon endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/coupons/available", response_model=List[AvailableCouponResponse], tags=["coupons"])
async def get_available_coupons(user: dict = Depends(get_current_user)):
    """
    Get all coupons available for the current user

    Returns both:
    - User-specific coupons assigned to this user
    - Global coupons not yet redeemed by this user
    """
    try:
        user_id = user["id"]

        # Get available coupons
        coupons = get_available_coupons_for_user(user_id)

        return [AvailableCouponResponse(**coupon) for coupon in coupons]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available coupons: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/coupons/history", response_model=RedemptionHistoryResponse, tags=["coupons"])
async def get_redemption_history(limit: int = 50, user: dict = Depends(get_current_user)):
    """
    Get redemption history for the current user

    Shows all coupons the user has redeemed with details
    """
    try:
        user_id = user["id"]

        # Get redemption history
        redemptions = get_user_redemption_history(user_id, limit=limit)

        # Transform data
        history_items = []
        total_value = 0.0

        for r in redemptions:
            coupon = r.get("coupons", {})
            history_items.append(
                RedemptionHistoryItem(
                    id=r["id"],
                    coupon_code=coupon.get("code", "Unknown"),
                    coupon_scope=coupon.get("coupon_scope", "unknown"),
                    coupon_type=coupon.get("coupon_type", "unknown"),
                    value_applied=float(r["value_applied"]),
                    redeemed_at=r["redeemed_at"],
                    user_balance_before=float(r["user_balance_before"]),
                    user_balance_after=float(r["user_balance_after"]),
                )
            )
            total_value += float(r["value_applied"])

        return RedemptionHistoryResponse(
            redemptions=history_items,
            total_redemptions=len(history_items),
            total_value_redeemed=total_value,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting redemption history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


# ============================================
# Admin Endpoints
# ============================================


@router.post("/admin/coupons", response_model=CouponResponse, tags=["admin", "coupons"])
async def create_coupon_endpoint(
    coupon_request: CreateCouponRequest, user: dict = Depends(require_admin)
):
    """
    Create a new coupon (Admin only)

    - User-specific: assigned to one user, one-time use
    - Global: available to all users, one-time per user
    """
    try:
        created_by = user["id"]

        # Create coupon
        coupon = create_coupon(
            code=coupon_request.code,
            value_usd=coupon_request.value_usd,
            coupon_scope=coupon_request.coupon_scope.value,
            max_uses=coupon_request.max_uses,
            valid_until=coupon_request.valid_until,
            coupon_type=coupon_request.coupon_type.value,
            created_by=created_by,
            created_by_type="admin",
            assigned_to_user_id=coupon_request.assigned_to_user_id,
            description=coupon_request.description,
            valid_from=coupon_request.valid_from,
        )

        if not coupon:
            raise HTTPException(status_code=500, detail="Failed to create coupon")

        return CouponResponse(**coupon)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error creating coupon: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/admin/coupons", response_model=ListCouponsResponse, tags=["admin", "coupons"])
async def list_coupons_endpoint(
    scope: Optional[str] = None,
    coupon_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    user: dict = Depends(require_admin),
):
    """
    List all coupons with filters (Admin only)

    Query parameters:
    - scope: Filter by coupon_scope (user_specific or global)
    - coupon_type: Filter by type
    - is_active: Filter by active status
    - limit: Max results (default 100)
    - offset: Pagination offset
    """
    try:
        # List coupons
        coupons = list_coupons(
            scope=scope, coupon_type=coupon_type, is_active=is_active, limit=limit, offset=offset
        )

        return ListCouponsResponse(
            coupons=[CouponResponse(**c) for c in coupons],
            total=len(coupons),
            offset=offset,
            limit=limit,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing coupons: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/admin/coupons/{coupon_id}", response_model=CouponResponse, tags=["admin", "coupons"])
async def get_coupon_endpoint(coupon_id: int, user: dict = Depends(require_admin)):
    """Get a specific coupon by ID (Admin only)"""
    try:
        coupon = get_coupon_by_id(coupon_id)

        if not coupon:
            raise HTTPException(status_code=404, detail="Coupon not found")

        return CouponResponse(**coupon)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting coupon: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.patch(
    "/admin/coupons/{coupon_id}", response_model=CouponResponse, tags=["admin", "coupons"]
)
async def update_coupon_endpoint(
    coupon_id: int, update_request: UpdateCouponRequest, user: dict = Depends(require_admin)
):
    """Update a coupon (Admin only)"""
    try:
        # Prepare updates
        updates = update_request.dict(exclude_unset=True)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        # Update coupon
        updated_coupon = update_coupon(coupon_id, updates)

        if not updated_coupon:
            raise HTTPException(status_code=404, detail="Coupon not found or update failed")

        return CouponResponse(**updated_coupon)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating coupon: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.delete("/admin/coupons/{coupon_id}", tags=["admin", "coupons"])
async def deactivate_coupon_endpoint(coupon_id: int, user: dict = Depends(require_admin)):
    """Deactivate a coupon (Admin only)"""
    try:
        success = deactivate_coupon(coupon_id)

        if not success:
            raise HTTPException(status_code=404, detail="Coupon not found or already inactive")

        return {"success": True, "message": "Coupon deactivated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating coupon: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get(
    "/admin/coupons/{coupon_id}/analytics",
    response_model=CouponAnalyticsResponse,
    tags=["admin", "coupons"],
)
async def get_coupon_analytics_endpoint(coupon_id: int, user: dict = Depends(require_admin)):
    """Get detailed analytics for a coupon (Admin only)"""
    try:
        analytics = get_coupon_analytics(coupon_id)

        if not analytics:
            raise HTTPException(status_code=404, detail="Coupon not found")

        return CouponAnalyticsResponse(
            coupon=CouponResponse(**analytics["coupon"]),
            total_redemptions=analytics["total_redemptions"],
            unique_users=analytics["unique_users"],
            total_value_distributed=analytics["total_value_distributed"],
            redemption_rate=analytics["redemption_rate"],
            remaining_uses=analytics["remaining_uses"],
            is_expired=analytics["is_expired"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting coupon analytics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get(
    "/admin/coupons/stats/overview", response_model=CouponStatsResponse, tags=["admin", "coupons"]
)
async def get_coupon_stats_endpoint(user: dict = Depends(require_admin)):
    """Get system-wide coupon statistics (Admin only)"""
    try:
        stats = get_all_coupons_stats()

        return CouponStatsResponse(**stats)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting coupon stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
