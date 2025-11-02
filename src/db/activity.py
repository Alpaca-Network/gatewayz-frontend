"""
Activity Tracking Database Operations
Handles logging and retrieval of user API activity
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def log_activity(
    user_id: int,
    model: str,
    provider: str,
    tokens: int,
    cost: float,
    speed: float = 0.0,
    finish_reason: str = "stop",
    app: str = "API",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """
    Log an API activity event

    Args:
        user_id: User ID
        model: Model name (e.g., "gpt-4", "claude-3-sonnet")
        provider: Provider name (e.g., "OpenAI", "Anthropic", "Google")
        tokens: Total tokens used
        cost: Cost in dollars
        speed: Tokens per second
        finish_reason: Completion reason (stop, length, etc.)
        app: Application name or "API"
        metadata: Additional metadata (prompt_tokens, completion_tokens, etc.)

    Returns:
        Created activity record or None on error
    """
    try:
        client = get_supabase_client()

        activity_data = {
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "provider": provider,
            "tokens": tokens,
            "cost": cost,
            "speed": speed,
            "finish_reason": finish_reason,
            "app": app,
            "metadata": metadata or {},
        }

        result = client.table("activity_log").insert(activity_data).execute()

        if result.data:
            logger.info(f"Activity logged for user {user_id}: {model} ({tokens} tokens)")
            return result.data[0]

        return None

    except Exception as e:
        logger.error(f"Failed to log activity: {e}")
        # Don't raise - activity logging should not break the main flow
        return None


def get_user_activity_stats(
    user_id: int, from_date: str | None = None, to_date: str | None = None, days: int | None = None
) -> dict[str, Any]:
    """
    Get aggregated activity statistics for a user

    Args:
        user_id: User ID
        from_date: Start date (YYYY-MM-DD format)
        to_date: End date (YYYY-MM-DD format)
        days: Number of days to look back (alternative to from_date/to_date)

    Returns:
        Dictionary with date-aggregated stats
    """
    try:
        client = get_supabase_client()

        # Calculate date range
        if from_date and to_date:
            start_date = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc).isoformat()
            end_date = (
                datetime.fromisoformat(to_date)
                .replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                .isoformat()
            )
        elif days:
            start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            end_date = datetime.now(timezone.utc).isoformat()
        else:
            # Default to last 30 days
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            end_date = datetime.now(timezone.utc).isoformat()

        # Fetch activity records
        result = (
            client.table("activity_log")
            .select("*")
            .eq("user_id", user_id)
            .gte("timestamp", start_date)
            .lte("timestamp", end_date)
            .order("timestamp", desc=False)
            .execute()
        )

        if not result.data:
            return {
                "total_requests": 0,
                "total_tokens": 0,
                "total_spend": 0.0,
                "total_cost": 0.0,
                "daily_stats": [],
                "by_date": [],
                "by_model": {},
                "by_provider": {},
            }

        # Aggregate by date
        by_date = {}
        by_model = {}
        by_provider = {}
        total_requests = 0
        total_tokens = 0
        total_cost = 0.0

        for record in result.data:
            # Parse date
            timestamp = datetime.fromisoformat(record["timestamp"].replace("Z", "+00:00"))
            date_key = timestamp.strftime("%Y-%m-%d")

            # Aggregate by date
            if date_key not in by_date:
                by_date[date_key] = {"date": date_key, "requests": 0, "tokens": 0, "cost": 0.0}

            by_date[date_key]["requests"] += 1
            by_date[date_key]["tokens"] += record.get("tokens", 0)
            by_date[date_key]["cost"] += record.get("cost", 0.0)

            # Aggregate by model
            model = record.get("model", "unknown")
            if model not in by_model:
                by_model[model] = {"requests": 0, "tokens": 0, "cost": 0.0}
            by_model[model]["requests"] += 1
            by_model[model]["tokens"] += record.get("tokens", 0)
            by_model[model]["cost"] += record.get("cost", 0.0)

            # Aggregate by provider
            provider = record.get("provider", "unknown")
            if provider not in by_provider:
                by_provider[provider] = {"requests": 0, "tokens": 0, "cost": 0.0}
            by_provider[provider]["requests"] += 1
            by_provider[provider]["tokens"] += record.get("tokens", 0)
            by_provider[provider]["cost"] += record.get("cost", 0.0)

            # Totals
            total_requests += 1
            total_tokens += record.get("tokens", 0)
            total_cost += record.get("cost", 0.0)

        # Convert by_date dict to sorted list and format for frontend
        by_date_list = sorted(by_date.values(), key=lambda x: x["date"])

        # Format daily_stats for frontend charts
        daily_stats = [
            {
                "date": item["date"],
                "spend": round(item["cost"], 4),
                "tokens": item["tokens"],
                "requests": item["requests"],
            }
            for item in by_date_list
        ]

        return {
            "total_requests": total_requests,
            "total_tokens": total_tokens,
            "total_spend": round(total_cost, 4),
            "total_cost": round(total_cost, 4),
            "daily_stats": daily_stats,
            "by_date": by_date_list,
            "by_model": by_model,
            "by_provider": by_provider,
        }

    except Exception as e:
        logger.error(f"Failed to get activity stats: {e}")
        return {
            "total_requests": 0,
            "total_tokens": 0,
            "total_spend": 0.0,
            "total_cost": 0.0,
            "daily_stats": [],
            "by_date": [],
            "by_model": {},
            "by_provider": {},
            "error": str(e),
        }


def get_user_activity_log(
    user_id: int,
    limit: int = 50,
    offset: int = 0,
    from_date: str | None = None,
    to_date: str | None = None,
    model_filter: str | None = None,
    provider_filter: str | None = None,
) -> list[dict[str, Any]]:
    """
    Get paginated activity log for a user

    Args:
        user_id: User ID
        limit: Maximum number of records to return
        offset: Number of records to skip
        from_date: Start date (YYYY-MM-DD format)
        to_date: End date (YYYY-MM-DD format)
        model_filter: Optional model name filter
        provider_filter: Optional provider name filter

    Returns:
        List of activity records
    """
    try:
        client = get_supabase_client()

        # Build query
        query = client.table("activity_log").select("*").eq("user_id", user_id)

        # Apply date filters
        if from_date:
            start_date = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc).isoformat()
            query = query.gte("timestamp", start_date)
        if to_date:
            end_date = (
                datetime.fromisoformat(to_date)
                .replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                .isoformat()
            )
            query = query.lte("timestamp", end_date)

        # Apply filters
        if model_filter:
            query = query.eq("model", model_filter)
        if provider_filter:
            query = query.eq("provider", provider_filter)

        # Execute with pagination
        result = query.order("timestamp", desc=True).range(offset, offset + limit - 1).execute()

        if not result.data:
            logger.info(f"No activity found for user {user_id}")
            return []

        logger.info(f"Retrieved {len(result.data)} activity records for user {user_id}")
        return result.data

    except Exception as e:
        logger.error(f"Failed to get activity log: {e}")
        return []


def get_provider_from_model(model: str) -> str:
    """
    Determine provider from model name

    Args:
        model: Model name

    Returns:
        Provider name
    """
    model_lower = model.lower()

    if "gpt" in model_lower or "openai" in model_lower:
        return "OpenAI"
    elif "claude" in model_lower or "anthropic" in model_lower:
        return "Anthropic"
    elif "gemini" in model_lower or "palm" in model_lower or "bard" in model_lower:
        return "Google"
    elif "llama" in model_lower or "meta" in model_lower:
        return "Meta"
    elif "mistral" in model_lower or "mixtral" in model_lower:
        return "Mistral AI"
    elif "qwen" in model_lower:
        return "Alibaba"
    elif "deepseek" in model_lower:
        return "DeepSeek"
    else:
        return "Other"
