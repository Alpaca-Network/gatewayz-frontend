import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from src.config.supabase_config import get_supabase_client
from src.db.users import get_user

logger = logging.getLogger(__name__)


def get_user_rate_limits(api_key: str) -> dict[str, Any] | None:
    """Get rate limits for a user"""
    try:
        client = get_supabase_client()

        # First try to get rate limits from the new system (rate_limit_configs table)
        try:
            # Get the API key record from api_keys_new
            key_record = client.table("api_keys_new").select("*").eq("api_key", api_key).execute()

            if key_record.data:
                # Get rate limit config for this key
                rate_config = (
                    client.table("rate_limit_configs")
                    .select("*")
                    .eq("api_key_id", key_record.data[0]["id"])
                    .execute()
                )

                if rate_config.data:
                    config = rate_config.data[0]
                    return {
                        "requests_per_minute": config.get("max_requests", 1000)
                        // 60,  # Convert hourly to per-minute
                        "requests_per_hour": config.get("max_requests", 1000),
                        "requests_per_day": config.get("max_requests", 1000)
                        * 24,  # Convert hourly to per-day
                        "tokens_per_minute": config.get("max_tokens", 1000000) // 60,
                        "tokens_per_hour": config.get("max_tokens", 1000000),
                        "tokens_per_day": config.get("max_tokens", 1000000) * 24,
                    }
        except Exception as e:
            logger.warning(f"Failed to get rate limits from new system: {e}")

        # Fallback to old system (rate_limits table)
        result = client.table("rate_limits").select("*").eq("api_key", api_key).execute()

        if not result.data:
            return None

        rate_limits = result.data[0]
        return {
            "requests_per_minute": rate_limits.get("requests_per_minute", 60),
            "requests_per_hour": rate_limits.get("requests_per_hour", 1000),
            "requests_per_day": rate_limits.get("requests_per_day", 10000),
            "tokens_per_minute": rate_limits.get("tokens_per_minute", 10000),
            "tokens_per_hour": rate_limits.get("tokens_per_hour", 100000),
            "tokens_per_day": rate_limits.get("tokens_per_day", 1000000),
        }

    except Exception as e:
        logger.error(f"Error getting user rate limits: {e}")
        return None


def set_user_rate_limits(api_key: str, rate_limits: dict[str, int]) -> None:
    try:
        client = get_supabase_client()

        user = get_user(api_key)
        if not user:
            raise ValueError(f"User with API key {api_key} not found")

        rate_limit_data = {
            "api_key": api_key,
            "user_id": user["id"],
            "requests_per_minute": rate_limits.get("requests_per_minute", 60),
            "requests_per_hour": rate_limits.get("requests_per_hour", 1000),
            "requests_per_day": rate_limits.get("requests_per_day", 10000),
            "tokens_per_minute": rate_limits.get("tokens_per_minute", 10000),
            "tokens_per_hour": rate_limits.get("tokens_per_hour", 100000),
            "tokens_per_day": rate_limits.get("tokens_per_day", 1000000),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        existing = client.table("rate_limits").select("*").eq("api_key", api_key).execute()

        if existing.data:
            client.table("rate_limits").update(rate_limit_data).eq("api_key", api_key).execute()
        else:
            client.table("rate_limits").insert(rate_limit_data).execute()

    except Exception as e:
        logger.error(f"Failed to set user rate limits: {e}")
        raise RuntimeError(f"Failed to set user rate limits: {e}") from e


def check_rate_limit(api_key: str, tokens_used: int = 0) -> dict[str, Any]:
    try:
        client = get_supabase_client()

        rate_limits = get_user_rate_limits(api_key)
        if not rate_limits:
            return {"allowed": True, "reason": "No rate limits configured"}

        now = datetime.now(timezone.utc)
        minute_start = now.replace(second=0, microsecond=0)
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Get current usage for all windows
        usage_result = client.table("rate_limit_usage").select("*").eq("api_key", api_key).execute()
        usage_records = usage_result.data

        # Find current window records
        minute_usage = next(
            (
                u
                for u in usage_records
                if u["window_type"] == "minute" and u["window_start"] == minute_start.isoformat()
            ),
            None,
        )
        hour_usage = next(
            (
                u
                for u in usage_records
                if u["window_type"] == "hour" and u["window_start"] == hour_start.isoformat()
            ),
            None,
        )
        day_usage = next(
            (
                u
                for u in usage_records
                if u["window_type"] == "day" and u["window_start"] == day_start.isoformat()
            ),
            None,
        )

        requests_minute = (minute_usage["requests_count"] if minute_usage else 0) + 1
        requests_hour = (hour_usage["requests_count"] if hour_usage else 0) + 1
        requests_day = (day_usage["requests_count"] if day_usage else 0) + 1

        tokens_minute = (minute_usage["tokens_count"] if minute_usage else 0) + tokens_used
        tokens_hour = (hour_usage["tokens_count"] if hour_usage else 0) + tokens_used
        tokens_day = (day_usage["tokens_count"] if day_usage else 0) + tokens_used

        if requests_minute > rate_limits["requests_per_minute"]:
            return {
                "allowed": False,
                "reason": f"Rate limit exceeded: {requests_minute} requests per minute",
            }

        if requests_hour > rate_limits["requests_per_hour"]:
            return {
                "allowed": False,
                "reason": f"Rate limit exceeded: {requests_hour} requests per hour",
            }

        if requests_day > rate_limits["requests_per_day"]:
            return {
                "allowed": False,
                "reason": f"Rate limit exceeded: {requests_day} requests per day",
            }

        if tokens_minute > rate_limits["tokens_per_minute"]:
            return {
                "allowed": False,
                "reason": f"Token limit exceeded: {tokens_minute} tokens per minute",
            }

        if tokens_hour > rate_limits["tokens_per_hour"]:
            return {
                "allowed": False,
                "reason": f"Token limit exceeded: {tokens_hour} tokens per hour",
            }

        if tokens_day > rate_limits["tokens_per_day"]:
            return {
                "allowed": False,
                "reason": f"Token limit exceeded: {tokens_day} tokens per day",
            }

        return {"allowed": True, "reason": "Within rate limits"}

    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        return {"allowed": True, "reason": "Error checking rate limits"}


def update_rate_limit_usage(api_key: str, tokens_used: int) -> None:
    try:
        client = get_supabase_client()

        # Get user info
        user = get_user(api_key)
        if not user:
            logger.error(f"User not found for API key: {api_key}")
            return

        user_id = user["id"]
        now = datetime.now(timezone.utc)

        # Timestamp is already timezone-aware
        timestamp = now.isoformat()

        # Calculate window starts
        minute_start = now.replace(second=0, microsecond=0).replace(tzinfo=timezone.utc).isoformat()
        hour_start = now.replace(minute=0, second=0, microsecond=0).replace(tzinfo=timezone.utc).isoformat()
        day_start = (
            now.replace(hour=0, minute=0, second=0, microsecond=0).replace(tzinfo=timezone.utc).isoformat()
        )

        # Check if this is a new API key (gw_ prefix)
        is_new_key = api_key.startswith("gw_")

        # Update minute window
        minute_data = {
            "user_id": user_id,
            "api_key": api_key,
            "window_type": "minute",
            "window_start": minute_start,
            "requests_count": 1,
            "tokens_count": tokens_used,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

        # Update hour window
        hour_data = {
            "user_id": user_id,
            "api_key": api_key,
            "window_type": "hour",
            "window_start": hour_start,
            "requests_count": 1,
            "tokens_count": tokens_used,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

        # Update day window
        day_data = {
            "user_id": user_id,
            "api_key": api_key,
            "window_type": "day",
            "window_start": day_start,
            "requests_count": 1,
            "tokens_count": tokens_used,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

        # Try to update existing records, insert if they don't exist
        for window_data in [minute_data, hour_data, day_data]:
            try:
                # Check if record exists
                existing = (
                    client.table("rate_limit_usage")
                    .select("*")
                    .eq("api_key", api_key)
                    .eq("window_type", window_data["window_type"])
                    .eq("window_start", window_data["window_start"])
                    .execute()
                )

                if existing.data:
                    # Update existing record
                    current = existing.data[0]
                    updated_data = {
                        "requests_count": current["requests_count"] + 1,
                        "tokens_count": current["tokens_count"] + tokens_used,
                        "updated_at": timestamp,
                    }
                    client.table("rate_limit_usage").update(updated_data).eq(
                        "id", current["id"]
                    ).execute()
                else:
                    # Insert new record
                    client.table("rate_limit_usage").insert(window_data).execute()

            except Exception as e:
                logger.error(
                    f"Failed to update rate limit usage for {window_data['window_type']}: {e}"
                )

        # If this is a new key, also update the api_keys_new table
        if is_new_key:
            try:
                # Update last_used_at in api_keys_new
                client.table("api_keys_new").update({"last_used_at": timestamp}).eq(
                    "api_key", api_key
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to update last_used_at in api_keys_new: {e}")

    except Exception as e:
        logger.error(f"Failed to update rate limit usage: {e}")


def get_environment_usage_summary(user_id: int) -> dict[str, Any]:
    """Get usage breakdown by environment"""
    try:
        client = get_supabase_client()

        # Get all API keys for the user with their environment tags
        keys_result = (
            client.table("api_keys_new")
            .select("environment_tag, requests_used, max_requests")
            .eq("user_id", user_id)
            .execute()
        )

        env_summary = {}
        for key in keys_result.data or []:
            env_tag = key.get("environment_tag", "unknown")
            if env_tag not in env_summary:
                env_summary[env_tag] = {
                    "total_requests": 0,
                    "total_max_requests": 0,
                    "key_count": 0,
                }

            env_summary[env_tag]["total_requests"] += key.get("requests_used", 0)
            if key.get("max_requests"):
                env_summary[env_tag]["total_max_requests"] += key["max_requests"]
            env_summary[env_tag]["key_count"] += 1

        return env_summary

    except Exception as e:
        logger.error(f"Error getting environment usage summary for user {user_id}: {e}")
        return {}


# =============================================================================
# ADVANCED RATE LIMITING FUNCTIONS
# =============================================================================


def get_rate_limit_config(api_key: str) -> dict[str, Any] | None:
    """Get rate limit configuration for a specific API key"""
    try:
        client = get_supabase_client()

        # Get rate limit config from api_keys table
        result = (
            client.table("api_keys").select("rate_limit_config").eq("api_key", api_key).execute()
        )

        if result.data and result.data[0].get("rate_limit_config"):
            return result.data[0]["rate_limit_config"]

        # Fallback to default config
        return {
            "requests_per_minute": 60,
            "requests_per_hour": 1000,
            "requests_per_day": 10000,
            "tokens_per_minute": 10000,
            "tokens_per_hour": 100000,
            "tokens_per_day": 1000000,
            "burst_limit": 10,
            "concurrency_limit": 50,
            "window_size_seconds": 60,
        }

    except Exception as e:
        logger.error(f"Error getting rate limit config for key {api_key[:10]}...: {e}")
        return None


def update_rate_limit_config(api_key: str, config: dict[str, Any]) -> bool:
    """Update rate limit configuration for a specific API key"""
    try:
        client = get_supabase_client()

        result = (
            client.table("api_keys")
            .update({"rate_limit_config": config, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("api_key", api_key)
            .execute()
        )

        return len(result.data) > 0

    except Exception as e:
        logger.error(f"Error updating rate limit config for key {api_key[:10]}...: {e}")
        return False


def get_user_rate_limit_configs(user_id: int) -> list[dict[str, Any]]:
    """Get all rate limit configurations for a user's API keys"""
    try:
        client = get_supabase_client()

        result = (
            client.table("api_keys")
            .select("api_key, key_name, rate_limit_config, environment_tag")
            .eq("user_id", user_id)
            .execute()
        )

        configs = []
        for key in result.data or []:
            config = key.get("rate_limit_config", {})
            configs.append(
                {
                    "api_key": key["api_key"],
                    "key_name": key["key_name"],
                    "environment_tag": key["environment_tag"],
                    "rate_limit_config": config,
                }
            )

        return configs

    except Exception as e:
        logger.error(f"Error getting rate limit configs for user {user_id}: {e}")
        return []


def bulk_update_rate_limit_configs(user_id: int, config: dict[str, Any]) -> int:
    """Bulk update rate limit configurations for all user's API keys"""
    try:
        client = get_supabase_client()

        result = (
            client.table("api_keys")
            .update({"rate_limit_config": config, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("user_id", user_id)
            .execute()
        )

        return len(result.data)

    except Exception as e:
        logger.error(f"Error bulk updating rate limit configs for user {user_id}: {e}")
        return 0


def get_rate_limit_usage_stats(api_key: str, time_window: str = "minute") -> dict[str, Any]:
    """Get current rate limit usage statistics for an API key"""
    try:
        client = get_supabase_client()

        now = datetime.now(timezone.utc)

        if time_window == "minute":
            start_time = now.replace(second=0, microsecond=0)
            end_time = start_time + timedelta(minutes=1)
        elif time_window == "hour":
            start_time = now.replace(minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(hours=1)
        elif time_window == "day":
            start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(days=1)
        else:
            raise ValueError(f"Invalid time window: {time_window}")

        # Get usage records for the time window
        result = (
            client.table("usage_records")
            .select("tokens_used, created_at")
            .eq("api_key", api_key)
            .gte("created_at", start_time.isoformat())
            .lt("created_at", end_time.isoformat())
            .execute()
        )

        total_requests = len(result.data or [])
        total_tokens = sum(record.get("tokens_used", 0) for record in (result.data or []))

        return {
            "time_window": time_window,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "total_requests": total_requests,
            "total_tokens": total_tokens,
            "requests_per_second": (
                total_requests / (end_time - start_time).total_seconds()
                if (end_time - start_time).total_seconds() > 0
                else 0
            ),
        }

    except Exception as e:
        logger.error(f"Error getting rate limit usage stats for key {api_key[:10]}...: {e}")
        return {
            "time_window": time_window,
            "total_requests": 0,
            "total_tokens": 0,
            "requests_per_second": 0,
        }


def get_system_rate_limit_stats() -> dict[str, Any]:
    """Get system-wide rate limiting statistics"""
    try:
        client = get_supabase_client()

        now = datetime.now(timezone.utc)
        minute_ago = now - timedelta(minutes=1)
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)

        # Get usage stats for different time windows
        minute_result = (
            client.table("usage_records")
            .select("api_key, tokens_used")
            .gte("created_at", minute_ago.isoformat())
            .execute()
        )
        hour_result = (
            client.table("usage_records")
            .select("api_key, tokens_used")
            .gte("created_at", hour_ago.isoformat())
            .execute()
        )
        day_result = (
            client.table("usage_records")
            .select("api_key, tokens_used")
            .gte("created_at", day_ago.isoformat())
            .execute()
        )

        # Calculate stats
        minute_requests = len(minute_result.data or [])
        minute_tokens = sum(record.get("tokens_used", 0) for record in (minute_result.data or []))

        hour_requests = len(hour_result.data or [])
        hour_tokens = sum(record.get("tokens_used", 0) for record in (hour_result.data or []))

        day_requests = len(day_result.data or [])
        day_tokens = sum(record.get("tokens_used", 0) for record in (day_result.data or []))

        # Get unique active keys
        active_keys_minute = len({record["api_key"] for record in (minute_result.data or [])})
        active_keys_hour = len({record["api_key"] for record in (hour_result.data or [])})
        active_keys_day = len({record["api_key"] for record in (day_result.data or [])})

        return {
            "timestamp": now.isoformat(),
            "minute": {
                "requests": minute_requests,
                "tokens": minute_tokens,
                "active_keys": active_keys_minute,
                "requests_per_second": minute_requests / 60,
            },
            "hour": {
                "requests": hour_requests,
                "tokens": hour_tokens,
                "active_keys": active_keys_hour,
                "requests_per_minute": hour_requests / 60,
            },
            "day": {
                "requests": day_requests,
                "tokens": day_tokens,
                "active_keys": active_keys_day,
                "requests_per_hour": day_requests / 24,
            },
        }

    except Exception as e:
        logger.error(f"Error getting system rate limit stats: {e}")
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "minute": {"requests": 0, "tokens": 0, "active_keys": 0, "requests_per_second": 0},
            "hour": {"requests": 0, "tokens": 0, "active_keys": 0, "requests_per_minute": 0},
            "day": {"requests": 0, "tokens": 0, "active_keys": 0, "requests_per_hour": 0},
        }


def create_rate_limit_alert(api_key: str, alert_type: str, details: dict[str, Any]) -> bool:
    """Create a rate limit alert for monitoring (optional - table may not exist)"""
    try:
        client = get_supabase_client()

        # Check if rate_limit_alerts table exists
        try:
            # Try to query the table to see if it exists
            client.table("rate_limit_alerts").select("id").limit(1).execute()
        except Exception:
            # Table doesn't exist, skip alert creation
            logger.info("Rate limit alerts table not available, skipping alert creation")
            return True

        alert_data = {
            "api_key": api_key,
            "alert_type": alert_type,
            "details": details,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "resolved": False,
        }

        result = client.table("rate_limit_alerts").insert(alert_data).execute()
        return len(result.data) > 0

    except Exception as e:
        logger.warning(f"Rate limit alert creation failed (non-critical): {e}")
        return True  # Return True to not block the main flow


def get_rate_limit_alerts(
    api_key: str | None = None, resolved: bool = False, limit: int = 100
) -> list[dict[str, Any]]:
    """Get rate limit alerts with optional filtering"""
    try:
        client = get_supabase_client()

        query = (
            client.table("rate_limit_alerts")
            .select("*")
            .eq("resolved", resolved)
            .order("created_at", desc=True)
            .limit(limit)
        )

        if api_key:
            query = query.eq("api_key", api_key)

        result = query.execute()
        return result.data or []

    except Exception as e:
        logger.error(f"Error getting rate limit alerts: {e}")
        return []
