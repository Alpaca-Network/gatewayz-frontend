import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from src.db.api_keys import get_api_key_by_id
from src.db.rate_limits import (
    bulk_update_rate_limit_configs,
    get_rate_limit_alerts,
    get_rate_limit_config,
    get_rate_limit_usage_stats,
    get_system_rate_limit_stats,
    get_user_rate_limit_configs,
    update_rate_limit_config,
)
from src.db.users import get_user
from src.security.deps import get_api_key, require_admin

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()

# =============================================================================
# ADVANCED RATE LIMITING ENDPOINTS
# =============================================================================


@router.get("/user/rate-limits", tags=["authentication"])
async def get_user_rate_limits_advanced(api_key: str = Depends(get_api_key)):
    """Get advanced rate limit configuration and status for user's API keys"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Get rate limit configurations for all user's keys
        configs = get_user_rate_limit_configs(user["id"])

        # Get current usage stats for each key
        enhanced_configs = []
        for config in configs:
            usage_stats = {
                "minute": get_rate_limit_usage_stats(config["api_key"], "minute"),
                "hour": get_rate_limit_usage_stats(config["api_key"], "hour"),
                "day": get_rate_limit_usage_stats(config["api_key"], "day"),
            }

            enhanced_configs.append(
                {
                    **config,
                    "usage_stats": usage_stats,
                    "current_status": {
                        "requests_remaining_minute": max(
                            0,
                            config["rate_limit_config"].get("requests_per_minute", 60)
                            - usage_stats["minute"]["total_requests"],
                        ),
                        "tokens_remaining_minute": max(
                            0,
                            config["rate_limit_config"].get("tokens_per_minute", 10000)
                            - usage_stats["minute"]["total_tokens"],
                        ),
                        "requests_remaining_hour": max(
                            0,
                            config["rate_limit_config"].get("requests_per_hour", 1000)
                            - usage_stats["hour"]["total_requests"],
                        ),
                        "tokens_remaining_hour": max(
                            0,
                            config["rate_limit_config"].get("tokens_per_hour", 100000)
                            - usage_stats["hour"]["total_tokens"],
                        ),
                        "requests_remaining_day": max(
                            0,
                            config["rate_limit_config"].get("requests_per_day", 10000)
                            - usage_stats["day"]["total_requests"],
                        ),
                        "tokens_remaining_day": max(
                            0,
                            config["rate_limit_config"].get("tokens_per_day", 1000000)
                            - usage_stats["day"]["total_tokens"],
                        ),
                    },
                }
            )

        return {
            "status": "success",
            "user_id": user["id"],
            "rate_limit_configs": enhanced_configs,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting advanced rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.put("/user/rate-limits/{key_id}", tags=["authentication"])
async def update_user_rate_limits_advanced(
    key_id: int, rate_limit_config: dict, api_key: str = Depends(get_api_key)
):
    """Update rate limit configuration for a specific API key"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Verify the user owns the key
        key_to_update = get_api_key_by_id(key_id, user["id"])
        if not key_to_update:
            raise HTTPException(status_code=404, detail="API key not found")

        # Validate rate limit configuration
        required_fields = [
            "requests_per_minute",
            "requests_per_hour",
            "requests_per_day",
            "tokens_per_minute",
            "tokens_per_hour",
            "tokens_per_day",
        ]

        for field in required_fields:
            if field not in rate_limit_config:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

            if not isinstance(rate_limit_config[field], int) or rate_limit_config[field] < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid value for {field}: must be non-negative integer",
                )

        # Update rate limit configuration
        success = update_rate_limit_config(key_to_update["api_key"], rate_limit_config)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update rate limit configuration")

        return {
            "status": "success",
            "message": "Rate limit configuration updated successfully",
            "key_id": key_id,
            "updated_config": rate_limit_config,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/user/rate-limits/bulk-update", tags=["authentication"])
async def bulk_update_user_rate_limits(
    rate_limit_config: dict, api_key: str = Depends(get_api_key)
):
    """Bulk update rate limit configuration for all user's API keys"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Validate rate limit configuration
        required_fields = [
            "requests_per_minute",
            "requests_per_hour",
            "requests_per_day",
            "tokens_per_minute",
            "tokens_per_hour",
            "tokens_per_day",
        ]

        for field in required_fields:
            if field not in rate_limit_config:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

            if not isinstance(rate_limit_config[field], int) or rate_limit_config[field] < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid value for {field}: must be non-negative integer",
                )

        # Bulk update rate limit configurations
        updated_count = bulk_update_rate_limit_configs(user["id"], rate_limit_config)

        return {
            "status": "success",
            "message": f"Rate limit configuration updated for {updated_count} API keys",
            "updated_count": updated_count,
            "updated_config": rate_limit_config,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/user/rate-limits/usage/{key_id}", tags=["authentication"])
async def get_api_key_rate_limit_usage(
    key_id: int, time_window: str = "minute", api_key: str = Depends(get_api_key)
):
    """Get detailed rate limit usage statistics for a specific API key"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Verify the user owns the key
        key_to_check = get_api_key_by_id(key_id, user["id"])
        if not key_to_check:
            raise HTTPException(status_code=404, detail="API key not found")

        # Validate time window
        if time_window not in ["minute", "hour", "day"]:
            raise HTTPException(
                status_code=400, detail="Invalid time window. Must be 'minute', 'hour', or 'day'"
            )

        # Get usage statistics
        usage_stats = get_rate_limit_usage_stats(key_to_check["api_key"], time_window)

        # Get rate limit configuration
        rate_limit_config = get_rate_limit_config(key_to_check["api_key"])

        return {
            "status": "success",
            "key_id": key_id,
            "key_name": key_to_check["key_name"],
            "time_window": time_window,
            "usage_stats": usage_stats,
            "rate_limit_config": rate_limit_config,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting rate limit usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/admin/rate-limits/system", tags=["admin"])
async def get_system_rate_limits(admin_user: dict = Depends(require_admin)):
    """Get system-wide rate limiting statistics"""
    try:
        stats = get_system_rate_limit_stats()

        return {
            "status": "success",
            "system_stats": stats,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting system rate limit stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/admin/rate-limits/alerts", tags=["admin"])
async def get_rate_limit_alerts_endpoint(
    api_key: str | None = None,
    resolved: bool = False,
    limit: int = 100,
    admin_user: dict = Depends(require_admin),
):
    """Get rate limit alerts for monitoring"""
    try:
        alerts = get_rate_limit_alerts(api_key, resolved, limit)

        return {
            "status": "success",
            "total_alerts": len(alerts),
            "alerts": alerts,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting rate limit alerts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
