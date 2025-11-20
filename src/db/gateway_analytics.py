"""
Gateway Analytics Database Layer
Provides functions to analyze usage across different gateways and providers
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def get_provider_stats(
    provider_name: str,
    gateway: Optional[str] = None,
    time_range: str = "24h",
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Get comprehensive statistics for a specific provider

    Args:
        provider_name: Provider name (e.g., 'openai', 'anthropic')
        gateway: Optional gateway filter
        time_range: Time range: '1h', '24h', '7d', '30d', 'all'
        user_id: Optional user filter

    Returns:
        Dictionary with provider statistics
    """
    try:
        supabase = get_supabase_client()

        # Calculate time filter
        time_filter = _get_time_filter(time_range)

        # Build query
        query = supabase.table("activity_log").select("*")

        # Apply filters
        if time_filter:
            query = query.gte("created_at", time_filter)

        if user_id:
            query = query.eq("user_id", user_id)

        # Execute query
        response = query.execute()

        if not response.data:
            return _empty_provider_stats(provider_name)

        # Filter by provider (case-insensitive)
        provider_lower = provider_name.lower()
        filtered_data = [
            log
            for log in response.data
            if (
                log.get("provider", "").lower() == provider_lower
                or log.get("model", "").lower().startswith(f"{provider_lower}/")
            )
        ]

        # Further filter by gateway if specified
        if gateway:
            gateway_lower = gateway.lower()
            filtered_data = [
                log
                for log in filtered_data
                if log.get("metadata", {}).get("gateway", "").lower() == gateway_lower
            ]

        if not filtered_data:
            return _empty_provider_stats(provider_name)

        # Calculate statistics
        stats = _calculate_provider_statistics(filtered_data, provider_name, gateway)

        return stats

    except Exception as e:
        logger.error(f"Error getting provider stats for {provider_name}: {e}")
        return {"error": str(e), "provider": provider_name}


def get_gateway_stats(
    gateway: str, time_range: str = "24h", user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Get comprehensive statistics for a specific gateway

    Args:
        gateway: Gateway name (e.g., 'openrouter', 'featherless', 'deepinfra')
        time_range: Time range: '1h', '24h', '7d', '30d', 'all'
        user_id: Optional user filter

    Returns:
        Dictionary with gateway statistics
    """
    try:
        supabase = get_supabase_client()

        # Calculate time filter
        time_filter = _get_time_filter(time_range)

        # Build query
        query = supabase.table("activity_log").select("*")

        # Apply filters
        if time_filter:
            query = query.gte("created_at", time_filter)

        if user_id:
            query = query.eq("user_id", user_id)

        # Execute query
        response = query.execute()

        if not response.data:
            return _empty_gateway_stats(gateway)

        # Filter by gateway (from metadata)
        gateway_lower = gateway.lower()
        filtered_data = [
            log
            for log in response.data
            if log.get("metadata", {}).get("gateway", "").lower() == gateway_lower
        ]

        if not filtered_data:
            return _empty_gateway_stats(gateway)

        # Calculate statistics
        stats = _calculate_gateway_statistics(filtered_data, gateway)

        return stats

    except Exception as e:
        logger.error(f"Error getting gateway stats for {gateway}: {e}")
        return {"error": str(e), "gateway": gateway}


def get_trending_models(
    gateway: Optional[str] = "all",
    time_range: str = "24h",
    limit: int = 10,
    sort_by: str = "requests",
) -> List[Dict[str, Any]]:
    """
    Get trending models based on usage

    Args:
        gateway: Gateway filter ('all' for all gateways)
        time_range: Time range for trending calculation
        limit: Number of models to return
        sort_by: Sort criteria: 'requests', 'tokens', 'users'

    Returns:
        List of trending models with statistics
    """
    try:
        supabase = get_supabase_client()

        # Calculate time filter
        time_filter = _get_time_filter(time_range)

        # Build query
        query = supabase.table("activity_log").select("*")

        if time_filter:
            query = query.gte("created_at", time_filter)

        # Execute query
        response = query.execute()

        if not response.data:
            return []

        # Filter by gateway if specified
        data = response.data
        if gateway and gateway.lower() != "all":
            gateway_lower = gateway.lower()
            data = [
                log
                for log in data
                if log.get("metadata", {}).get("gateway", "").lower() == gateway_lower
            ]

        # Aggregate by model
        model_stats = {}
        for log in data:
            model = log.get("model")
            if not model:
                continue

            if model not in model_stats:
                model_stats[model] = {
                    "model": model,
                    "provider": log.get("provider", "unknown"),
                    "requests": 0,
                    "total_tokens": 0,
                    "unique_users": set(),
                    "total_cost": 0.0,
                    "avg_speed": [],
                    "gateway": log.get("metadata", {}).get("gateway", "unknown"),
                }

            stats = model_stats[model]
            stats["requests"] += 1
            stats["total_tokens"] += log.get("tokens", 0)
            stats["unique_users"].add(log.get("user_id"))
            stats["total_cost"] += log.get("cost", 0.0)

            speed = log.get("speed")
            if speed and speed > 0:
                stats["avg_speed"].append(speed)

        # Convert sets to counts and calculate averages
        trending = []
        for _model, stats in model_stats.items():
            stats["unique_users"] = len(stats["unique_users"])
            stats["avg_speed"] = (
                sum(stats["avg_speed"]) / len(stats["avg_speed"]) if stats["avg_speed"] else 0
            )
            trending.append(stats)

        # Sort by specified criteria
        if sort_by == "tokens":
            trending.sort(key=lambda x: x["total_tokens"], reverse=True)
        elif sort_by == "users":
            trending.sort(key=lambda x: x["unique_users"], reverse=True)
        else:  # default: requests
            trending.sort(key=lambda x: x["requests"], reverse=True)

        return trending[:limit]

    except Exception as e:
        logger.error(f"Error getting trending models: {e}")
        return []


def get_all_gateways_summary(
    time_range: str = "24h", user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Get summary statistics for all gateways

    Args:
        time_range: Time range for statistics
        user_id: Optional user filter

    Returns:
        Dictionary with statistics for each gateway
    """
    try:
        gateways = ["openrouter", "featherless", "deepinfra", "chutes"]

        summary = {
            "time_range": time_range,
            "gateways": {},
            "totals": {
                "requests": 0,
                "tokens": 0,
                "cost": 0.0,
                "unique_users": set(),
                "models": set(),
            },
        }

        for gateway in gateways:
            stats = get_gateway_stats(gateway, time_range, user_id)
            if "error" not in stats:
                summary["gateways"][gateway] = stats

                # Update totals
                summary["totals"]["requests"] += stats.get("total_requests", 0)
                summary["totals"]["tokens"] += stats.get("total_tokens", 0)
                summary["totals"]["cost"] += stats.get("total_cost", 0.0)

        # Convert sets to counts
        summary["totals"]["unique_users"] = len(summary["totals"]["unique_users"])
        summary["totals"]["models"] = len(summary["totals"]["models"])

        return summary

    except Exception as e:
        logger.error(f"Error getting all gateways summary: {e}")
        return {"error": str(e)}


def get_top_models_by_provider(
    provider_name: str, limit: int = 5, time_range: str = "24h"
) -> List[Dict[str, Any]]:
    """
    Get top models for a specific provider

    Args:
        provider_name: Provider name
        limit: Number of models to return
        time_range: Time range for statistics

    Returns:
        List of top models with usage statistics
    """
    try:
        supabase = get_supabase_client()

        # Calculate time filter
        time_filter = _get_time_filter(time_range)

        # Build query
        query = supabase.table("activity_log").select("*")

        if time_filter:
            query = query.gte("created_at", time_filter)

        # Execute query
        response = query.execute()

        if not response.data:
            return []

        # Filter by provider
        provider_lower = provider_name.lower()
        filtered_data = [
            log
            for log in response.data
            if (
                log.get("provider", "").lower() == provider_lower
                or log.get("model", "").lower().startswith(f"{provider_lower}/")
            )
        ]

        # Aggregate by model
        model_stats = {}
        for log in filtered_data:
            model = log.get("model")
            if not model:
                continue

            if model not in model_stats:
                model_stats[model] = {"model": model, "requests": 0, "tokens": 0, "cost": 0.0}

            model_stats[model]["requests"] += 1
            model_stats[model]["tokens"] += log.get("tokens", 0)
            model_stats[model]["cost"] += log.get("cost", 0.0)

        # Sort by requests
        top_models = sorted(model_stats.values(), key=lambda x: x["requests"], reverse=True)[:limit]

        return top_models

    except Exception as e:
        logger.error(f"Error getting top models for {provider_name}: {e}")
        return []


# Helper functions


def _get_time_filter(time_range: str) -> Optional[str]:
    """Convert time range string to ISO timestamp"""
    try:
        now = datetime.now(timezone.utc)

        if time_range == "1h":
            delta = timedelta(hours=1)
        elif time_range == "24h":
            delta = timedelta(hours=24)
        elif time_range == "7d":
            delta = timedelta(days=7)
        elif time_range == "30d":
            delta = timedelta(days=30)
        elif time_range == "all":
            return None
        else:
            delta = timedelta(hours=24)  # default

        return (now - delta).isoformat()

    except Exception as e:
        logger.error(f"Error calculating time filter: {e}")
        return None


def _calculate_provider_statistics(
    logs: List[Dict[str, Any]], provider_name: str, gateway: Optional[str] = None
) -> Dict[str, Any]:
    """Calculate comprehensive statistics from activity logs"""

    total_requests = len(logs)
    total_tokens = sum(log.get("tokens", 0) for log in logs)
    total_cost = sum(log.get("cost", 0.0) for log in logs)
    unique_users = len({log.get("user_id") for log in logs if log.get("user_id")})
    unique_models = len({log.get("model") for log in logs if log.get("model")})

    # Calculate speed metrics
    speeds = [log.get("speed") for log in logs if log.get("speed") and log.get("speed") > 0]
    avg_speed = sum(speeds) / len(speeds) if speeds else 0

    # Get model breakdown
    model_usage = {}
    for log in logs:
        model = log.get("model")
        if model:
            if model not in model_usage:
                model_usage[model] = {"requests": 0, "tokens": 0}
            model_usage[model]["requests"] += 1
            model_usage[model]["tokens"] += log.get("tokens", 0)

    # Get top model
    top_model = None
    if model_usage:
        top_model = max(model_usage.items(), key=lambda x: x[1]["requests"])[0]

    return {
        "provider": provider_name,
        "gateway": gateway or "all",
        "total_requests": total_requests,
        "total_tokens": total_tokens,
        "total_cost": round(total_cost, 4),
        "unique_users": unique_users,
        "unique_models": unique_models,
        "avg_speed_tokens_per_sec": round(avg_speed, 2),
        "top_model": top_model,
        "model_breakdown": model_usage,
        "avg_tokens_per_request": (
            round(total_tokens / total_requests, 2) if total_requests > 0 else 0
        ),
        "avg_cost_per_request": round(total_cost / total_requests, 4) if total_requests > 0 else 0,
    }


def _calculate_gateway_statistics(logs: List[Dict[str, Any]], gateway: str) -> Dict[str, Any]:
    """Calculate comprehensive statistics for a gateway"""

    total_requests = len(logs)
    total_tokens = sum(log.get("tokens", 0) for log in logs)
    total_cost = sum(log.get("cost", 0.0) for log in logs)
    unique_users = len({log.get("user_id") for log in logs if log.get("user_id")})
    unique_models = len({log.get("model") for log in logs if log.get("model")})
    unique_providers = len({log.get("provider") for log in logs if log.get("provider")})

    # Calculate speed metrics
    speeds = [log.get("speed") for log in logs if log.get("speed") and log.get("speed") > 0]
    avg_speed = sum(speeds) / len(speeds) if speeds else 0

    # Get provider breakdown
    provider_usage = {}
    for log in logs:
        provider = log.get("provider", "unknown")
        if provider not in provider_usage:
            provider_usage[provider] = {"requests": 0, "tokens": 0, "cost": 0.0}
        provider_usage[provider]["requests"] += 1
        provider_usage[provider]["tokens"] += log.get("tokens", 0)
        provider_usage[provider]["cost"] += log.get("cost", 0.0)

    # Get top provider
    top_provider = None
    if provider_usage:
        top_provider = max(provider_usage.items(), key=lambda x: x[1]["requests"])[0]

    return {
        "gateway": gateway,
        "total_requests": total_requests,
        "total_tokens": total_tokens,
        "total_cost": round(total_cost, 4),
        "unique_users": unique_users,
        "unique_models": unique_models,
        "unique_providers": unique_providers,
        "avg_speed_tokens_per_sec": round(avg_speed, 2),
        "top_provider": top_provider,
        "provider_breakdown": provider_usage,
        "avg_tokens_per_request": (
            round(total_tokens / total_requests, 2) if total_requests > 0 else 0
        ),
        "avg_cost_per_request": round(total_cost / total_requests, 4) if total_requests > 0 else 0,
    }


def _empty_provider_stats(provider_name: str) -> Dict[str, Any]:
    """Return empty statistics structure for a provider"""
    return {
        "provider": provider_name,
        "total_requests": 0,
        "total_tokens": 0,
        "total_cost": 0.0,
        "unique_users": 0,
        "unique_models": 0,
        "avg_speed_tokens_per_sec": 0.0,
        "top_model": None,
        "model_breakdown": {},
        "avg_tokens_per_request": 0.0,
        "avg_cost_per_request": 0.0,
    }


def _empty_gateway_stats(gateway: str) -> Dict[str, Any]:
    """Return empty statistics structure for a gateway"""
    return {
        "gateway": gateway,
        "total_requests": 0,
        "total_tokens": 0,
        "total_cost": 0.0,
        "unique_users": 0,
        "unique_models": 0,
        "unique_providers": 0,
        "avg_speed_tokens_per_sec": 0.0,
        "top_provider": None,
        "provider_breakdown": {},
        "avg_tokens_per_request": 0.0,
        "avg_cost_per_request": 0.0,
    }
