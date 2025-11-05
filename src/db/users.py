import logging
from typing import Any
from datetime import datetime, timedelta, timezone

from src.db.api_keys import create_api_key
from src.config.supabase_config import get_supabase_client
import secrets
from src.utils.security_validators import sanitize_for_logging

logger = logging.getLogger(__name__)


def create_enhanced_user(
    username: str, email: str, auth_method: str, credits: int = 10, privy_user_id: str | None = None
) -> dict[str, Any]:
    """Create a new user with automatic 3-day trial and $10 credits"""
    try:
        client = get_supabase_client()

        # Prepare user data with trial setup
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=3)

        user_data = {
            "username": username,
            "email": email,
            "credits": credits,  # $10 trial credits
            "is_active": True,
            "registration_date": trial_start.isoformat(),
            "auth_method": auth_method,
            "subscription_status": "trial",
            "trial_expires_at": trial_end.isoformat(),
            "welcome_email_sent": False,  # New users haven't received welcome email yet
        }

        # Add privy_user_id if provided
        if privy_user_id:
            user_data["privy_user_id"] = privy_user_id

        # Create user account with a temporary API key (will be replaced)
        user_data["api_key"] = f"gw_live_{secrets.token_urlsafe(16)}"
        user_result = client.table("users").insert(user_data).execute()

        if not user_result.data:
            raise ValueError("Failed to create user account")

        user = user_result.data[0]
        user_id = user["id"]

        # Generate primary API key
        primary_key, _ = create_api_key(
            user_id=user_id, key_name="Primary Key", environment_tag="live", is_primary=True
        )

        # Update user with the actual API key
        update_result = (
            client.table("users").update({"api_key": primary_key}).eq("id", user_id).execute()
        )

        if not update_result.data:
            logger.warning(
                "Failed to update users.api_key for user %s, but primary key created successfully in api_keys_new",
                sanitize_for_logging(str(user_id)),
            )

        logger.info(
            "User %s created successfully with primary API key: %s",
            sanitize_for_logging(str(user_id)),
            sanitize_for_logging(primary_key[:15] + "..."),
        )

        # Return user info with primary key
        return {
            "user_id": user_id,
            "username": username,
            "email": email,
            "credits": credits,
            "primary_api_key": primary_key,
        }

    except Exception as e:
        logger.error("Failed to create enhanced user: %s", sanitize_for_logging(str(e)))
        raise RuntimeError(f"Failed to create enhanced user: {e}")


def get_user(api_key: str) -> dict[str, Any] | None:
    """Get user by API key from unified system"""
    try:
        client = get_supabase_client()

        # First, try to get user from the new api_keys table
        key_result = client.table("api_keys_new").select("*").eq("api_key", api_key).execute()

        if key_result.data:
            key_data = key_result.data[0]
            user_id = key_data["user_id"]

            # Get user info from users table
            user_result = client.table("users").select("*").eq("id", user_id).execute()

            if user_result.data:
                user = user_result.data[0]
                # Add key information to user data
                user["key_id"] = key_data["id"]
                user["key_name"] = key_data["key_name"]
                user["environment_tag"] = key_data["environment_tag"]
                user["scope_permissions"] = key_data["scope_permissions"]
                user["is_primary"] = key_data["is_primary"]
                return user

        # Fallback: Check if this is a legacy key (for backward compatibility during migration)
        legacy_result = client.table("users").select("*").eq("api_key", api_key).execute()
        if legacy_result.data:
            logger.warning(
                "Legacy API key %s detected - should be migrated",
                sanitize_for_logging(api_key[:20] + "..."),
            )
            return legacy_result.data[0]

        return None

    except Exception as e:
        logger.error("Error getting user: %s", sanitize_for_logging(str(e)))
        return None


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    """
    Get user by user ID (primary key)

    Args:
        user_id: User's numeric ID

    Returns:
        User dictionary if found, None otherwise
    """
    try:
        client = get_supabase_client()

        result = client.table("users").select("*").eq("id", user_id).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]

        return None

    except Exception as e:
        logger.error(
            "Error getting user by ID %s: %s",
            sanitize_for_logging(str(user_id)),
            sanitize_for_logging(str(e)),
        )
        return None


def get_user_by_privy_id(privy_user_id: str) -> dict[str, Any] | None:
    """Get user by Privy user ID"""
    try:
        client = get_supabase_client()

        result = client.table("users").select("*").eq("privy_user_id", privy_user_id).execute()

        if result.data:
            return result.data[0]

        return None

    except Exception as e:
        logger.error("Error getting user by Privy ID: %s", sanitize_for_logging(str(e)))
        return None


def get_user_by_username(username: str) -> dict[str, Any] | None:
    """Get user by username"""
    try:
        client = get_supabase_client()

        result = client.table("users").select("*").eq("username", username).execute()

        if result.data:
            return result.data[0]

        return None

    except Exception as e:
        logger.error("Error getting user by username: %s", sanitize_for_logging(str(e)))
        return None


def add_credits_to_user(
    user_id: int,
    credits: float,
    transaction_type: str = "admin_credit",
    description: str = "Credits added",
    payment_id: int | None = None,
    metadata: dict | None = None,
) -> None:
    """
    Add credits to user account by user ID and log the transaction

    Args:
        user_id: User ID
        credits: Amount of credits to add
        transaction_type: Type of transaction (trial, purchase, admin_credit, etc.)
        description: Description of the transaction
        payment_id: Optional payment ID if this is from a payment
        metadata: Optional metadata dictionary
    """
    if credits <= 0:
        raise ValueError("Credits must be positive")

    try:
        from src.db.credit_transactions import log_credit_transaction

        client = get_supabase_client()

        # Get current balance
        user_result = client.table("users").select("credits").eq("id", user_id).execute()
        if not user_result.data:
            raise ValueError(f"User with ID {user_id} not found")

        balance_before = user_result.data[0]["credits"]
        balance_after = balance_before + credits

        # Update user credits
        result = (
            client.table("users")
            .update({"credits": balance_after, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", user_id)
            .execute()
        )

        if not result.data:
            raise ValueError(f"User with ID {user_id} not found")

        # Log the transaction
        log_credit_transaction(
            user_id=user_id,
            amount=credits,
            transaction_type=transaction_type,
            description=description,
            balance_before=balance_before,
            balance_after=balance_after,
            payment_id=payment_id,
            metadata=metadata,
        )

        logger.info(
            "Added %s credits to user %s. Balance: %s → %s",
            sanitize_for_logging(str(credits)),
            sanitize_for_logging(str(user_id)),
            sanitize_for_logging(str(balance_before)),
            sanitize_for_logging(str(balance_after)),
        )

    except Exception as e:
        logger.error("Failed to add credits: %s", sanitize_for_logging(str(e)))
        raise RuntimeError(f"Failed to add credits: {e}")


def add_credits(api_key: str, credits: int) -> None:
    """Legacy function for backward compatibility"""
    user = get_user(api_key)
    if not user:
        raise ValueError(f"User with API key {api_key} not found")

    add_credits_to_user(user["id"], credits)


def log_api_usage_transaction(
    api_key: str,
    cost: float,
    description: str = "API usage",
    metadata: dict | None = None,
    is_trial: bool = False,
) -> None:
    """
    Log API usage transaction (for both trial and non-trial users)
    For trial users, logs with $0 cost. For non-trial users, deducts credits and logs transaction.

    Args:
        api_key: User's API key
        cost: Cost of the API call (will be 0 for trial users)
        description: Description of the usage
        metadata: Optional metadata (model used, tokens, etc.)
        is_trial: Whether user is on trial (if True, cost should be 0 and no credits deducted)
    """
    try:
        from src.db.credit_transactions import log_credit_transaction, TransactionType

        user = get_user(api_key)
        if not user:
            logger.warning(f"User with API key {api_key[:20]}... not found for transaction logging")
            return

        user_id = user["id"]
        balance_before = user.get("credits", 0.0) or 0.0
        balance_after = balance_before - cost if not is_trial else balance_before

        # Log the transaction (negative amount for usage)
        transaction_result = log_credit_transaction(
            user_id=user_id,
            amount=-cost,  # Negative for API usage
            transaction_type=TransactionType.API_USAGE,
            description=description,
            balance_before=balance_before,
            balance_after=balance_after,
            metadata={
                **(metadata or {}),
                "is_trial": is_trial,
            },
        )

        if not transaction_result:
            logger.error(
                f"Failed to log API usage transaction for user {user_id}. "
                f"Cost: ${cost}, Is Trial: {is_trial}"
            )
        else:
            logger.info(
                f"Logged API usage transaction for user {user_id}. "
                f"Cost: ${cost}, Is Trial: {is_trial}, Transaction ID: {transaction_result.get('id', 'unknown')}"
            )

    except Exception as e:
        logger.error(f"Failed to log API usage transaction: {e}", exc_info=True)


def deduct_credits(
    api_key: str, tokens: float, description: str = "API usage", metadata: dict | None = None
) -> None:
    """
    Deduct credits from user account by API key and log the transaction

    Args:
        api_key: User's API key
        tokens: Amount of credits to deduct
        description: Description of the usage
        metadata: Optional metadata (model used, tokens, etc.)
    """
    # Allow very small amounts but not exactly 0 or negative
    if tokens < 0:
        raise ValueError("Credits cannot be negative")

    # If tokens is 0 or very small (less than $0.000001), skip deduction but log usage
    if tokens < 0.000001:
        logger.info(
            "Skipping credit deduction for minimal amount: $%s",
            sanitize_for_logging(f"{tokens:.10f}"),
        )
        return

    try:
        from src.db.credit_transactions import log_credit_transaction, TransactionType

        user = get_user(api_key)
        if not user:
            raise ValueError(f"User with API key {api_key} not found")

        user_id = user["id"]
        balance_before = user["credits"]

        if balance_before < tokens:
            raise ValueError(f"Insufficient credits. Current: {balance_before}, Required: {tokens}")

        balance_after = balance_before - tokens

        client = get_supabase_client()
        result = (
            client.table("users")
            .update({"credits": balance_after, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", user_id)
            .execute()
        )

        if not result.data:
            raise ValueError(f"Failed to update user balance for user {user_id}")

        # Log the transaction (negative amount for deduction)
        transaction_result = log_credit_transaction(
            user_id=user_id,
            amount=-tokens,  # Negative for deduction
            transaction_type=TransactionType.API_USAGE,
            description=description,
            balance_before=balance_before,
            balance_after=balance_after,
            metadata=metadata,
        )

        if not transaction_result:
            logger.error(
                f"Failed to log credit transaction for user {user_id}. "
                f"Credits were deducted but transaction not logged. "
                f"Amount: -{tokens}, Balance: {balance_before} → {balance_after}"
            )
            # Don't raise here - credits were already deducted, just log the error
        else:
            logger.info(
                "Deducted %s credits from user %s. Balance: %s → %s. Transaction logged: %s",
                sanitize_for_logging(str(tokens)),
                sanitize_for_logging(str(user_id)),
                sanitize_for_logging(str(balance_before)),
                sanitize_for_logging(str(balance_after)),
                transaction_result.get("id", "unknown"),
            )

    except Exception as e:
        logger.error("Failed to deduct credits: %s", sanitize_for_logging(str(e)), exc_info=True)
        # Wrap exceptions in RuntimeError for consistency with test expectations
        if isinstance(e, RuntimeError):
            raise
        raise RuntimeError(f"Failed to deduct credits: {e}") from e


def get_all_users() -> list[dict[str, Any]]:
    try:
        client = get_supabase_client()
        result = client.table("users").select("*").execute()
        return result.data

    except Exception as e:
        logger.error("Error getting all users: %s", sanitize_for_logging(str(e)))
        return []


def delete_user(api_key: str) -> None:
    try:
        client = get_supabase_client()
        result = client.table("users").delete().eq("api_key", api_key).execute()

        if not result.data:
            raise ValueError(f"User with API key {api_key} not found")

    except Exception as e:
        logger.error("Failed to delete user: %s", sanitize_for_logging(str(e)))
        raise RuntimeError(f"Failed to delete user: {e}")


def get_user_count() -> int:
    try:
        client = get_supabase_client()
        result = client.table("users").select("*", count="exact").execute()
        return result.count or 0

    except Exception as e:
        logger.error("Error getting user count: %s", sanitize_for_logging(str(e)))
        return 0


def record_usage(
    user_id: int,
    api_key: str,
    model: str,
    tokens_used: int,
    cost: float = 0.0,
    latency_ms: int = None,
) -> None:
    """
    Record usage in the usage_records table.
    Note: latency_ms is accepted for backward compatibility but not stored (column doesn't exist in DB).
    Use activity_log for detailed metrics including latency and gateway info.
    """
    try:
        client = get_supabase_client()

        # Ensure timestamp is timezone-aware
        timestamp = datetime.now(timezone.utc).replace(tzinfo=timezone.utc).isoformat()

        # Only include columns that exist in the schema
        usage_data = {
            "user_id": user_id,
            "api_key": api_key,
            "model": model,
            "tokens_used": tokens_used,
            "cost": cost,
            "timestamp": timestamp,
        }

        client.table("usage_records").insert(usage_data).execute()

        logger.info(
            "Usage recorded successfully: user_id=%s, api_key=%s, model=%s, tokens=%s, cost=%s",
            sanitize_for_logging(str(user_id)),
            sanitize_for_logging(api_key[:20] + "..."),
            sanitize_for_logging(model),
            sanitize_for_logging(str(tokens_used)),
            sanitize_for_logging(str(cost)),
        )

    except Exception as e:
        logger.error("Failed to record usage: %s", sanitize_for_logging(str(e)))
        # Don't raise the exception to avoid breaking the main flow


def get_user_usage_metrics(api_key: str) -> dict[str, Any]:
    try:
        client = get_supabase_client()

        # Get user info from api_keys_new table first
        key_result = client.table("api_keys_new").select("user_id").eq("api_key", api_key).execute()
        if not key_result.data:
            # Fallback to legacy users table
            user_result = (
                client.table("users").select("id, credits").eq("api_key", api_key).execute()
            )
            if not user_result.data:
                return None
            user_id = user_result.data[0]["id"]
        else:
            user_id = key_result.data[0]["user_id"]

        # Get user credits
        user_result = client.table("users").select("credits").eq("id", user_id).execute()
        if not user_result.data:
            return None

        current_credits = user_result.data[0]["credits"]

        # Use the database function to get usage metrics
        result = client.rpc("get_user_usage_metrics", {"user_api_key": api_key}).execute()

        if not result.data:
            # If no usage data, return empty metrics
            return {
                "user_id": user_id,
                "current_credits": current_credits,
                "usage_metrics": {
                    "total_requests": 0,
                    "total_tokens": 0,
                    "total_cost": 0.0,
                    "requests_today": 0,
                    "tokens_today": 0,
                    "cost_today": 0.0,
                    "requests_this_month": 0,
                    "tokens_this_month": 0,
                    "cost_this_month": 0.0,
                    "average_tokens_per_request": 0.0,
                    "most_used_model": "No models used",
                    "last_request_time": None,
                },
            }

        metrics = result.data[0]

        return {
            "user_id": user_id,
            "current_credits": current_credits,
            "usage_metrics": {
                "total_requests": metrics["total_requests"],
                "total_tokens": metrics["total_tokens"],
                "total_cost": float(metrics["total_cost"]),
                "requests_today": metrics["requests_today"],
                "tokens_today": metrics["tokens_today"],
                "cost_today": float(metrics["cost_today"]),
                "requests_this_month": metrics["requests_this_month"],
                "tokens_this_month": metrics["tokens_this_month"],
                "cost_this_month": float(metrics["cost_this_month"]),
                "average_tokens_per_request": float(metrics["average_tokens_per_request"]),
                "most_used_model": metrics["most_used_model"] or "No models used",
                "last_request_time": metrics["last_request_time"],
            },
        }

    except Exception as e:
        logger.error("Error getting user usage metrics: %s", sanitize_for_logging(str(e)))
        return None


def get_admin_monitor_data() -> dict[str, Any]:
    """Get admin monitoring data with robust error handling"""
    try:
        client = get_supabase_client()

        # Get users data with error handling
        users = []
        try:
            users_result = client.table("users").select("*").execute()
            users = users_result.data or []
        except Exception as e:
            logger.error("Error retrieving users: %s", sanitize_for_logging(str(e)))
            users = []

        # Get activity_log data (primary source - actively updated)
        # This is the main source of truth for API usage tracking
        activity_logs = []
        try:
            activity_result = client.table("activity_log").select("*").order("timestamp", desc=True).execute()
            activity_logs = activity_result.data or []
            logger.info(f"Retrieved {len(activity_logs)} activity log records")
        except Exception as e:
            logger.error(f"Error retrieving activity_log: {e}", exc_info=True)
            activity_logs = []

        # Get usage records data as fallback (legacy table, may not be updated)
        usage_records_legacy = []
        try:
            usage_result = client.table("usage_records").select("*").execute()
            usage_records_legacy = usage_result.data or []
            logger.debug(f"Retrieved {len(usage_records_legacy)} legacy usage_records")
        except Exception as e:
            logger.warning(f"Error retrieving usage_records (legacy): {e}")
            usage_records_legacy = []

        # Create user_id -> api_key mapping for efficient lookup
        user_id_to_api_key = {}
        for user in users:
            user_id = user.get("id")
            api_key = user.get("api_key")
            if user_id and api_key:
                user_id_to_api_key[user_id] = api_key

        # Also check api_keys_new table for users who might not have api_key in users table
        try:
            api_keys_result = client.table("api_keys_new").select("user_id, api_key, is_primary").execute()
            if api_keys_result.data:
                for key_data in api_keys_result.data:
                    user_id = key_data.get("user_id")
                    api_key = key_data.get("api_key")
                    is_primary = key_data.get("is_primary", False)
                    # Prefer primary keys, but update if user_id not in mapping
                    if user_id and api_key:
                        if user_id not in user_id_to_api_key or is_primary:
                            user_id_to_api_key[user_id] = api_key
        except Exception as e:
            logger.warning(f"Error retrieving api_keys_new for user mapping: {e}")

        # Convert activity_log to usage_records format for compatibility
        # activity_log has: user_id, model, provider, tokens, cost, timestamp, metadata
        # usage_records format: user_id, api_key, model, tokens_used, cost, timestamp
        usage_records = []
        for activity in activity_logs:
            user_id = activity.get("user_id")
            # Look up API key from mapping
            api_key = user_id_to_api_key.get(user_id, "unknown")
            
            # Create a usage record-like entry from activity log
            usage_record = {
                "user_id": user_id,
                "api_key": api_key,
                "model": activity.get("model", "unknown"),
                "tokens_used": activity.get("tokens", 0),
                "cost": activity.get("cost", 0.0),
                "timestamp": activity.get("timestamp", ""),
            }
            usage_records.append(usage_record)

        # Add legacy usage_records that might not be in activity_log (for backward compatibility)
        # Only add if timestamp is not already covered by activity_log
        activity_timestamps = {r.get("timestamp", "") for r in usage_records}
        for legacy_record in usage_records_legacy:
            legacy_timestamp = legacy_record.get("timestamp", "")
            if legacy_timestamp and legacy_timestamp not in activity_timestamps:
                usage_records.append(legacy_record)

        # Calculate basic statistics
        total_users = len(users)
        sum(user.get("credits", 0) for user in users)
        len([user for user in users if user.get("credits", 0) > 0])

        # Calculate time-based statistics
        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # Filter usage records by time periods with error handling
        day_usage = []
        week_usage = []
        month_usage = []

        for record in usage_records:
            try:
                timestamp_str = record.get("timestamp", "")
                if timestamp_str:
                    # Handle different timestamp formats
                    if "Z" in timestamp_str:
                        timestamp_str = timestamp_str.replace("Z", "+00:00")
                    
                    # Fix malformed timestamps with odd-numbered microseconds
                    # e.g., "2025-10-14T15:24:27.81588+00:00" -> "2025-10-14T15:24:27.815880+00:00"
                    if "." in timestamp_str and "+" in timestamp_str:
                        parts = timestamp_str.split("+")
                        if len(parts) == 2:
                            time_part = parts[0]
                            tz_part = "+" + parts[1]
                            if "." in time_part:
                                time_parts = time_part.split(".")
                                if len(time_parts) == 2:
                                    seconds_part = time_parts[0]
                                    micros_part = time_parts[1]
                                    # Pad or truncate microseconds to 6 digits
                                    if len(micros_part) < 6:
                                        micros_part = micros_part.ljust(6, "0")
                                    elif len(micros_part) > 6:
                                        micros_part = micros_part[:6]
                                    timestamp_str = f"{seconds_part}.{micros_part}{tz_part}"
                    
                    record_time = datetime.fromisoformat(timestamp_str)

                    if record_time > day_ago:
                        day_usage.append(record)
                    if record_time > week_ago:
                        week_usage.append(record)
                    if record_time > month_ago:
                        month_usage.append(record)
            except Exception as e:
                logger.warning(
                    f"Error parsing timestamp for record {record.get('id', 'unknown')}: {e}, timestamp: {record.get('timestamp', '')[:50]}"
                )
                continue

        # Calculate totals with safe aggregation
        def safe_sum(records, field):
            return sum(record.get(field, 0) for record in records)

        total_tokens_day = safe_sum(day_usage, "tokens_used")
        safe_sum(week_usage, "tokens_used")
        total_tokens_month = safe_sum(month_usage, "tokens_used")
        total_tokens_all = safe_sum(usage_records, "tokens_used")

        total_cost_day = safe_sum(day_usage, "cost")
        safe_sum(week_usage, "cost")
        total_cost_month = safe_sum(month_usage, "cost")
        total_cost_all = safe_sum(usage_records, "cost")

        requests_day = len(day_usage)
        len(week_usage)
        requests_month = len(month_usage)
        requests_all = len(usage_records)

        # Get top users by usage
        user_usage = {}
        for record in usage_records:
            api_key = record.get("api_key", "unknown")
            if api_key not in user_usage:
                user_usage[api_key] = {"tokens_used": 0, "cost": 0, "requests": 0}
            user_usage[api_key]["tokens_used"] += record.get("tokens_used", 0)
            user_usage[api_key]["cost"] += record.get("cost", 0)
            user_usage[api_key]["requests"] += 1

        top_users = sorted(user_usage.items(), key=lambda x: x[1]["tokens_used"], reverse=True)[:10]
        top_users_data = [{"api_key": k, **v} for k, v in top_users]

        # Get recent activity
        recent_activity = sorted(usage_records, key=lambda x: x.get("timestamp", ""), reverse=True)[
            :20
        ]
        recent_activity_data = [
            {
                "api_key": record.get("api_key", "unknown"),
                "model": record.get("model", "unknown"),
                "tokens_used": record.get("tokens_used", 0),
                "timestamp": record.get("timestamp", ""),
            }
            for record in recent_activity
        ]

        # Calculate most used model safely
        most_used_model = "No models used"
        if usage_records:
            model_counts = {}
            for record in usage_records:
                model = record.get("model", "unknown")
                model_counts[model] = model_counts.get(model, 0) + 1

            if model_counts:
                most_used_model = max(model_counts.items(), key=lambda x: x[1])[0]

        # Calculate last request time safely
        last_request_time = None
        if usage_records:
            timestamps = [
                record.get("timestamp", "") for record in usage_records if record.get("timestamp")
            ]
            if timestamps:
                last_request_time = max(timestamps)

        # Build response data
        response_data = {
            "total_users": total_users,
            "active_users_today": len({record.get("api_key", "") for record in day_usage}),
            "total_requests_today": requests_day,
            "total_tokens_today": total_tokens_day,
            "total_cost_today": total_cost_day,
            "system_usage_metrics": {
                "total_requests": requests_all,
                "total_tokens": total_tokens_all,
                "total_cost": total_cost_all,
                "requests_today": requests_day,
                "tokens_today": total_tokens_day,
                "cost_today": total_cost_day,
                "requests_this_month": requests_month,
                "tokens_this_month": total_tokens_month,
                "cost_this_month": total_cost_month,
                "average_tokens_per_request": (
                    total_tokens_all / requests_all if requests_all > 0 else 0
                ),
                "most_used_model": most_used_model,
                "last_request_time": last_request_time,
            },
            "top_users_by_usage": top_users_data,
            "recent_activity": recent_activity_data,
        }

        return response_data

    except Exception as e:
        logger.error(f"Error getting admin monitor data: {e}")

        # Return a minimal response with error information
        return {
            "total_users": 0,
            "active_users_today": 0,
            "total_requests_today": 0,
            "total_tokens_today": 0,
            "total_cost_today": 0.0,
            "system_usage_metrics": {
                "total_requests": 0,
                "total_tokens": 0,
                "total_cost": 0.0,
                "requests_today": 0,
                "tokens_today": 0,
                "cost_today": 0.0,
                "requests_this_month": 0,
                "tokens_this_month": 0,
                "cost_this_month": 0.0,
                "average_tokens_per_request": 0.0,
                "most_used_model": "No models used",
                "last_request_time": None,
            },
            "top_users_by_usage": [],
            "recent_activity": [],
            "error": str(e),
        }


def update_user_profile(api_key: str, profile_data: dict[str, Any]) -> dict[str, Any]:
    """Update user profile information"""
    try:
        client = get_supabase_client()

        # Get current user
        user = get_user(api_key)
        if not user:
            raise ValueError(f"User with API key {api_key} not found")

        # Prepare update data
        update_data = {}
        allowed_fields = ["name", "email", "preferences", "settings"]

        for field, value in profile_data.items():
            if field in allowed_fields:
                update_data[field] = value

        if not update_data:
            raise ValueError("No valid profile fields to update")

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Update user profile
        result = client.table("users").update(update_data).eq("api_key", api_key).execute()

        if not result.data:
            raise ValueError("Failed to update user profile")

        # Return updated user data
        updated_user = get_user(api_key)
        return updated_user

    except Exception as e:
        logger.error(f"Failed to update user profile: {e}")
        raise RuntimeError(f"Failed to update user profile: {e}")


def get_user_profile(api_key: str) -> dict[str, Any]:
    """Get user profile information"""
    try:
        logger.info(f"get_user_profile called for API key: {api_key[:10]}...")
        user = get_user(api_key)
        if not user:
            logger.warning(f"get_user returned None for API key: {api_key[:10]}...")
            return None

        logger.info(f"Building profile for user {user.get('id')}")

        # Map tier to display-friendly name
        tier = user.get("tier")
        tier_display_map = {"basic": "Basic", "pro": "Pro", "max": "MAX"}
        tier_display_name = tier_display_map.get(tier) if tier else None

        # Return profile data
        profile = {
            "user_id": user["id"],
            "api_key": f"{api_key[:10]}...",
            "credits": user["credits"],
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
            "username": user.get("username"),
            "email": user.get("email"),
            "auth_method": user.get("auth_method"),
            "subscription_status": user.get("subscription_status"),
            "tier": tier,  # Include subscription tier (basic, pro, max)
            "tier_display_name": tier_display_name,  # Display-friendly name (Basic, Pro, MAX)
            "trial_expires_at": user.get("trial_expires_at"),
            "subscription_end_date": user.get("subscription_end_date"),  # Unix timestamp
            "is_active": user.get("is_active"),
            "registration_date": user.get("registration_date"),
        }

        logger.info(f"Profile built successfully for user {user.get('id')}")
        return profile

    except Exception as e:
        logger.error(f"Failed to get user profile: {e}", exc_info=True)
        return None


def mark_welcome_email_sent(user_id: int) -> bool:
    """Mark welcome email as sent for a user"""
    try:
        client = get_supabase_client()

        result = (
            client.table("users")
            .update({"welcome_email_sent": True, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", user_id)
            .execute()
        )

        if not result.data:
            raise ValueError(f"User with ID {user_id} not found")

        logger.info(f"Welcome email marked as sent for user {user_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to mark welcome email as sent: {e}")
        raise RuntimeError(f"Failed to mark welcome email as sent: {e}")


def delete_user_account(api_key: str) -> bool:
    """Delete user account and all associated data"""
    try:
        client = get_supabase_client()

        # Get user first to verify existence
        user = get_user(api_key)
        if not user:
            raise ValueError(f"User with API key {api_key} not found")

        user_id = user["id"]

        # Delete user (this will cascade delete all related records due to CASCADE constraints)
        result = client.table("users").delete().eq("api_key", api_key).execute()

        if not result.data:
            raise ValueError("Failed to delete user account")

        logger.info(f"Successfully deleted user account {user_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete user account: {e}")
        raise RuntimeError(f"Failed to delete user account: {e}")
