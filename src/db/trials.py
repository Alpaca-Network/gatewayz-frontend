import logging
import datetime
from typing import Dict, Any
from datetime import datetime, timezone
from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def start_trial_for_key(api_key: str, trial_days: int = 14) -> Dict[str, Any]:
    """Start a free trial for an API key"""
    try:
        client = get_supabase_client()

        # Get API key ID
        key_result = client.table('api_keys').select('id').eq('key', api_key).execute()
        if not key_result.data:
            return {"success": False, "error": "API key not found"}

        api_key_id = key_result.data[0]['id']

        # Call database function
        result = client.rpc('start_trial', {
            'api_key_id': api_key_id,
            'trial_days': trial_days
        }).execute()

        return result.data if result.data else {"success": False, "error": "Database error"}

    except Exception as e:
        logger.error(f"Error starting trial: {e}")
        return {"success": False, "error": str(e)}


def get_trial_status_for_key(api_key: str) -> Dict[str, Any]:
    """Get trial status for an API key"""
    try:
        client = get_supabase_client()

        # Get API key ID
        key_result = client.table('api_keys').select('id').eq('key', api_key).execute()
        if not key_result.data:
            return {"success": False, "error": "API key not found"}

        api_key_id = key_result.data[0]['id']

        # Call database function
        result = client.rpc('check_trial_status', {
            'api_key_id': api_key_id
        }).execute()

        return result.data if result.data else {"success": False, "error": "Database error"}

    except Exception as e:
        logger.error(f"Error getting trial status: {e}")
        return {"success": False, "error": str(e)}


def convert_trial_to_paid_for_key(api_key: str, plan_name: str) -> Dict[str, Any]:
    """Convert trial to paid subscription for an API key"""
    try:
        client = get_supabase_client()

        # Get API key ID
        key_result = client.table('api_keys').select('id').eq('key', api_key).execute()
        if not key_result.data:
            return {"success": False, "error": "API key not found"}

        api_key_id = key_result.data[0]['id']

        # Call database function
        result = client.rpc('convert_trial_to_paid', {
            'api_key_id': api_key_id,
            'plan_name': plan_name
        }).execute()

        return result.data if result.data else {"success": False, "error": "Database error"}

    except Exception as e:
        logger.error(f"Error converting trial: {e}")
        return {"success": False, "error": str(e)}


def track_trial_usage_for_key(api_key: str, tokens_used: int, requests_used: int = 1) -> Dict[str, Any]:
    """Track trial usage for an API key"""
    try:
        client = get_supabase_client()

        # Get API key ID
        key_result = client.table('api_keys').select('id').eq('key', api_key).execute()
        if not key_result.data:
            return {"success": False, "error": "API key not found"}

        api_key_id = key_result.data[0]['id']

        # Call database function
        result = client.rpc('track_trial_usage', {
            'api_key_id': api_key_id,
            'tokens_used': tokens_used,
            'requests_used': requests_used
        }).execute()

        return result.data if result.data else {"success": False, "error": "Database error"}

    except Exception as e:
        logger.error(f"Error tracking trial usage: {e}")
        return {"success": False, "error": str(e)}


def get_trial_analytics() -> Dict[str, Any]:
    """Get trial analytics and conversion metrics"""
    try:
        client = get_supabase_client()

        # Get trial statistics from api_keys_new table
        trial_stats = client.table('api_keys_new').select(
            'is_trial, trial_converted, trial_start_date, trial_end_date, trial_used_tokens, trial_used_requests, trial_used_credits, trial_credits, subscription_status').execute()

        if not trial_stats.data:
            return {"error": "No data available"}

        # Filter trial keys
        trial_keys = [k for k in trial_stats.data if k.get('is_trial', False)]
        total_trials = len(trial_keys)

        # Calculate active trials (not expired)
        active_trials = 0
        expired_trials = 0
        current_time = datetime.now(timezone.utc)

        for key in trial_keys:
            trial_end_date = key.get('trial_end_date')
            if trial_end_date:
                try:
                    if trial_end_date.endswith('Z'):
                        end_date = datetime.fromisoformat(trial_end_date.replace('Z', '+00:00'))
                    else:
                        end_date = datetime.fromisoformat(trial_end_date)

                    # Ensure both datetimes have timezone info for comparison
                    if end_date.tzinfo is None:
                        # If end_date is naive, assume it's UTC
                        end_date = end_date.replace(tzinfo=timezone.utc)

                    if end_date > current_time:
                        active_trials += 1
                    else:
                        expired_trials += 1
                except Exception as e:
                    logger.warning(f"Error parsing trial end date: {e}")
                    expired_trials += 1
            else:
                expired_trials += 1

        # Calculate conversions
        converted_trials = len([k for k in trial_keys if k.get('trial_converted', False)])
        conversion_rate = (converted_trials / total_trials * 100) if total_trials > 0 else 0

        # Calculate usage statistics
        total_tokens_used = sum(k.get('trial_used_tokens', 0) for k in trial_keys)
        total_requests_used = sum(k.get('trial_used_requests', 0) for k in trial_keys)
        total_credits_used = sum(float(k.get('trial_used_credits', 0)) for k in trial_keys)
        total_credits_allocated = sum(float(k.get('trial_credits', 0)) for k in trial_keys)

        # Calculate average usage per trial
        avg_tokens_per_trial = total_tokens_used / total_trials if total_trials > 0 else 0
        avg_requests_per_trial = total_requests_used / total_trials if total_trials > 0 else 0
        avg_credits_per_trial = total_credits_used / total_trials if total_trials > 0 else 0

        return {
            "total_trials": total_trials,
            "active_trials": active_trials,
            "expired_trials": expired_trials,
            "converted_trials": converted_trials,
            "conversion_rate": round(conversion_rate, 2),
            "usage_statistics": {
                "total_tokens_used": total_tokens_used,
                "total_requests_used": total_requests_used,
                "total_credits_used": round(total_credits_used, 2),
                "total_credits_allocated": round(total_credits_allocated, 2),
                "credits_utilization_rate": round(
                    (total_credits_used / total_credits_allocated * 100) if total_credits_allocated > 0 else 0, 2)
            },
            "average_usage_per_trial": {
                "tokens": round(avg_tokens_per_trial, 2),
                "requests": round(avg_requests_per_trial, 2),
                "credits": round(avg_credits_per_trial, 2)
            },
            "trial_status_breakdown": {
                "active": active_trials,
                "expired": expired_trials,
                "converted": converted_trials,
                "pending_conversion": total_trials - active_trials - converted_trials
            }
        }

    except Exception as e:
        logger.error(f"Error getting trial analytics: {e}")
        return {"error": str(e)}
