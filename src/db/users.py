import logging
import datetime
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from src.db.api_keys import create_api_key
from src.supabase_config import get_supabase_client
import secrets

logger = logging.getLogger(__name__)


def create_enhanced_user(username: str, email: str, auth_method: str, credits: int = 10) -> Dict[str, Any]:
    """Create a new user with automatic 3-day trial and $10 credits"""
    try:
        client = get_supabase_client()

        # Prepare user data with trial setup
        trial_start = datetime.now(datetime.UTC)
        trial_end = trial_start + timedelta(days=3)

        user_data = {
            'username': username,
            'email': email,
            'credits': credits,  # $10 trial credits
            'is_active': True,
            'registration_date': trial_start.isoformat(),
            'auth_method': auth_method,
            'subscription_status': 'trial',
            'trial_expires_at': trial_end.isoformat()
        }

        # Create user account with a temporary API key (will be replaced)
        user_data['api_key'] = f"gw_temp_{secrets.token_urlsafe(16)}"
        user_result = client.table('users').insert(user_data).execute()

        if not user_result.data:
            raise ValueError("Failed to create user account")

        user = user_result.data[0]
        user_id = user['id']

        # Generate primary API key
        primary_key = create_api_key(
            user_id=user_id,
            key_name='Primary Key',
            environment_tag='live',
            is_primary=True
        )

        # Update user with the actual API key
        client.table('users').update({
            'api_key': primary_key
        }).eq('id', user_id).execute()

        # Return user info with primary key
        return {
            'user_id': user_id,
            'username': username,
            'email': email,
            'credits': credits,
            'primary_api_key': primary_key
        }

    except Exception as e:
        logger.error(f"Failed to create enhanced user: {e}")
        raise RuntimeError(f"Failed to create enhanced user: {e}")


def get_user(api_key: str) -> Optional[Dict[str, Any]]:
    """Get user by API key from unified system"""
    try:
        client = get_supabase_client()

        # First, try to get user from the new api_keys table
        key_result = client.table('api_keys_new').select('*').eq('api_key', api_key).execute()

        if key_result.data:
            key_data = key_result.data[0]
            user_id = key_data['user_id']

            # Get user info from users table
            user_result = client.table('users').select('*').eq('id', user_id).execute()

            if user_result.data:
                user = user_result.data[0]
                # Add key information to user data
                user['key_id'] = key_data['id']
                user['key_name'] = key_data['key_name']
                user['environment_tag'] = key_data['environment_tag']
                user['scope_permissions'] = key_data['scope_permissions']
                user['is_primary'] = key_data['is_primary']
                return user

        # Fallback: Check if this is a legacy key (for backward compatibility during migration)
        legacy_result = client.table('users').select('*').eq('api_key', api_key).execute()
        if legacy_result.data:
            logger.warning(f"Legacy API key {api_key} detected - should be migrated")
            return legacy_result.data[0]

        return None

    except Exception as e:
        logger.error(f"Error getting user: {e}")
        return None


def add_credits_to_user(user_id: int, credits: int) -> None:
    """Add credits to user account by user ID"""
    if credits <= 0:
        raise ValueError("Credits must be positive")

    try:
        client = get_supabase_client()
        result = client.table('users').update({
            'credits': client.table('users').select('credits').eq('id', user_id).execute().data[0]['credits'] + credits,
            'updated_at': datetime.now(datetime.UTC).isoformat()
        }).eq('id', user_id).execute()

        if not result.data:
            raise ValueError(f"User with ID {user_id} not found")

    except Exception as e:
        logger.error(f"Failed to add credits: {e}")
        raise RuntimeError(f"Failed to add credits: {e}")


def add_credits(api_key: str, credits: int) -> None:
    """Legacy function for backward compatibility"""
    user = get_user(api_key)
    if not user:
        raise ValueError(f"User with API key {api_key} not found")

    add_credits_to_user(user['id'], credits)


def deduct_credits(api_key: str, tokens: int) -> None:
    """Deduct credits from user account by API key"""
    if tokens <= 0:
        raise ValueError("Tokens must be positive")

    try:
        user = get_user(api_key)
        if not user:
            raise ValueError(f"User with API key {api_key} not found")

        user_id = user['id']
        current_credits = user['credits']

        if current_credits < tokens:
            raise ValueError(f"Insufficient credits. Current: {current_credits}, Required: {tokens}")

        client = get_supabase_client()
        result = client.table('users').update({
            'credits': current_credits - tokens,
            'updated_at': datetime.now(datetime.UTC).isoformat()
        }).eq('id', user_id).execute()

    except Exception as e:
        logger.error(f"Failed to deduct credits: {e}")
        raise RuntimeError(f"Failed to deduct credits: {e}")


def get_all_users() -> List[Dict[str, Any]]:
    try:
        client = get_supabase_client()
        result = client.table('users').select('*').execute()
        return result.data

    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        return []


def delete_user(api_key: str) -> None:
    try:
        client = get_supabase_client()
        result = client.table('users').delete().eq('api_key', api_key).execute()

        if not result.data:
            raise ValueError(f"User with API key {api_key} not found")

    except Exception as e:
        logger.error(f"Failed to delete user: {e}")
        raise RuntimeError(f"Failed to delete user: {e}")


def get_user_count() -> int:
    try:
        client = get_supabase_client()
        result = client.table('users').select('*', count='exact').execute()
        return result.count or 0

    except Exception as e:
        logger.error(f"Error getting user count: {e}")
        return 0


def record_usage(user_id: int, api_key: str, model: str, tokens_used: int, cost: float = 0.0) -> None:
    try:
        client = get_supabase_client()

        # Generate a unique request ID
        import uuid
        request_id = str(uuid.uuid4())

        # Ensure timestamp is timezone-aware
        from datetime import timezone
        timestamp = datetime.now(datetime.UTC).replace(tzinfo=timezone.utc).isoformat()

        result = client.table('usage_records').insert({
            'user_id': user_id,
            'api_key': api_key,
            'model': model,
            'tokens_used': tokens_used,
            'cost': cost,
            'request_id': request_id,
            'timestamp': timestamp
        }).execute()

        logger.info(
            f"Usage recorded successfully: user_id={user_id}, api_key={api_key[:20]}..., model={model}, tokens={tokens_used}, cost={cost}, request_id={request_id}")

    except Exception as e:
        logger.error(f"Failed to record usage: {e}")
        # Don't raise the exception to avoid breaking the main flow


def get_user_usage_metrics(api_key: str) -> Dict[str, Any]:
    try:
        client = get_supabase_client()

        # Get user info from api_keys_new table first
        key_result = client.table('api_keys_new').select('user_id').eq('api_key', api_key).execute()
        if not key_result.data:
            # Fallback to legacy users table
            user_result = client.table('users').select('id, credits').eq('api_key', api_key).execute()
            if not user_result.data:
                return None
            user_id = user_result.data[0]['id']
        else:
            user_id = key_result.data[0]['user_id']

        # Get user credits
        user_result = client.table('users').select('credits').eq('id', user_id).execute()
        if not user_result.data:
            return None

        current_credits = user_result.data[0]['credits']

        # Use the database function to get usage metrics
        result = client.rpc('get_user_usage_metrics', {'user_api_key': api_key}).execute()

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
                    "last_request_time": None
                }
            }

        metrics = result.data[0]

        return {
            "user_id": user_id,
            "current_credits": current_credits,
            "usage_metrics": {
                "total_requests": metrics['total_requests'],
                "total_tokens": metrics['total_tokens'],
                "total_cost": float(metrics['total_cost']),
                "requests_today": metrics['requests_today'],
                "tokens_today": metrics['tokens_today'],
                "cost_today": float(metrics['cost_today']),
                "requests_this_month": metrics['requests_this_month'],
                "tokens_this_month": metrics['tokens_this_month'],
                "cost_this_month": float(metrics['cost_this_month']),
                "average_tokens_per_request": float(metrics['average_tokens_per_request']),
                "most_used_model": metrics['most_used_model'] or "No models used",
                "last_request_time": metrics['last_request_time']
            }
        }

    except Exception as e:
        logger.error(f"Error getting user usage metrics: {e}")
        return None


def get_admin_monitor_data() -> Dict[str, Any]:
    """Get admin monitoring data with robust error handling"""
    try:
        client = get_supabase_client()

        # Get users data with error handling
        users = []
        try:
            users_result = client.table('users').select('*').execute()
            users = users_result.data or []
        except Exception as e:
            logger.error(f"Error retrieving users: {e}")
            users = []

        # Get usage records data with error handling
        usage_records = []
        try:
            usage_result = client.table('usage_records').select('*').execute()
            usage_records = usage_result.data or []
        except Exception as e:
            logger.error(f"Error retrieving usage records: {e}")
            usage_records = []

        # Calculate basic statistics
        total_users = len(users)
        total_credits = sum(user.get('credits', 0) for user in users)
        active_users = len([user for user in users if user.get('credits', 0) > 0])

        # Calculate time-based statistics
        now = datetime.now(datetime.UTC)
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # Filter usage records by time periods with error handling
        day_usage = []
        week_usage = []
        month_usage = []

        for record in usage_records:
            try:
                timestamp_str = record.get('timestamp', '')
                if timestamp_str:
                    # Handle different timestamp formats
                    if 'Z' in timestamp_str:
                        timestamp_str = timestamp_str.replace('Z', '+00:00')
                    record_time = datetime.fromisoformat(timestamp_str)

                    if record_time > day_ago:
                        day_usage.append(record)
                    if record_time > week_ago:
                        week_usage.append(record)
                    if record_time > month_ago:
                        month_usage.append(record)
            except Exception as e:
                logger.warning(f"Error parsing timestamp for record {record.get('id', 'unknown')}: {e}")
                continue

        # Calculate totals with safe aggregation
        def safe_sum(records, field):
            return sum(record.get(field, 0) for record in records)

        total_tokens_day = safe_sum(day_usage, 'tokens_used')
        total_tokens_week = safe_sum(week_usage, 'tokens_used')
        total_tokens_month = safe_sum(month_usage, 'tokens_used')
        total_tokens_all = safe_sum(usage_records, 'tokens_used')

        total_cost_day = safe_sum(day_usage, 'cost')
        total_cost_week = safe_sum(week_usage, 'cost')
        total_cost_month = safe_sum(month_usage, 'cost')
        total_cost_all = safe_sum(usage_records, 'cost')

        requests_day = len(day_usage)
        requests_week = len(week_usage)
        requests_month = len(month_usage)
        requests_all = len(usage_records)

        # Get top users by usage
        user_usage = {}
        for record in usage_records:
            api_key = record.get('api_key', 'unknown')
            if api_key not in user_usage:
                user_usage[api_key] = {'tokens_used': 0, 'cost': 0, 'requests': 0}
            user_usage[api_key]['tokens_used'] += record.get('tokens_used', 0)
            user_usage[api_key]['cost'] += record.get('cost', 0)
            user_usage[api_key]['requests'] += 1

        top_users = sorted(user_usage.items(), key=lambda x: x[1]['tokens_used'], reverse=True)[:10]
        top_users_data = [{'api_key': k, **v} for k, v in top_users]

        # Get recent activity
        recent_activity = sorted(usage_records, key=lambda x: x.get('timestamp', ''), reverse=True)[:20]
        recent_activity_data = [
            {
                'api_key': record.get('api_key', 'unknown'),
                'model': record.get('model', 'unknown'),
                'tokens_used': record.get('tokens_used', 0),
                'timestamp': record.get('timestamp', '')
            }
            for record in recent_activity
        ]

        # Calculate most used model safely
        most_used_model = "No models used"
        if usage_records:
            model_counts = {}
            for record in usage_records:
                model = record.get('model', 'unknown')
                model_counts[model] = model_counts.get(model, 0) + 1

            if model_counts:
                most_used_model = max(model_counts.items(), key=lambda x: x[1])[0]

        # Calculate last request time safely
        last_request_time = None
        if usage_records:
            timestamps = [record.get('timestamp', '') for record in usage_records if record.get('timestamp')]
            if timestamps:
                last_request_time = max(timestamps)

        # Build response data
        response_data = {
            "total_users": total_users,
            "active_users_today": len(set(record.get('api_key', '') for record in day_usage)),
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
                "average_tokens_per_request": total_tokens_all / requests_all if requests_all > 0 else 0,
                "most_used_model": most_used_model,
                "last_request_time": last_request_time
            },
            "top_users_by_usage": top_users_data,
            "recent_activity": recent_activity_data
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
                "last_request_time": None
            },
            "top_users_by_usage": [],
            "recent_activity": [],
            "error": str(e)
        }


def update_user_profile(api_key: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """Update user profile information"""
    try:
        client = get_supabase_client()

        # Get current user
        user = get_user(api_key)
        if not user:
            raise ValueError(f"User with API key {api_key} not found")

        # Prepare update data
        update_data = {}
        allowed_fields = ['name', 'email', 'preferences', 'settings']

        for field, value in profile_data.items():
            if field in allowed_fields:
                update_data[field] = value

        if not update_data:
            raise ValueError("No valid profile fields to update")

        update_data['updated_at'] = datetime.now(datetime.UTC).isoformat()

        # Update user profile
        result = client.table('users').update(update_data).eq('api_key', api_key).execute()

        if not result.data:
            raise ValueError(f"Failed to update user profile")

        # Return updated user data
        updated_user = get_user(api_key)
        return updated_user

    except Exception as e:
        logger.error(f"Failed to update user profile: {e}")
        raise RuntimeError(f"Failed to update user profile: {e}")


def get_user_profile(api_key: str) -> Dict[str, Any]:
    """Get user profile information"""
    try:
        user = get_user(api_key)
        if not user:
            return None

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
            "trial_expires_at": user.get("trial_expires_at"),
            "is_active": user.get("is_active"),
            "registration_date": user.get("registration_date")
        }

        return profile

    except Exception as e:
        logger.error(f"Failed to get user profile: {e}")
        return None


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
        result = client.table('users').delete().eq('api_key', api_key).execute()

        if not result.data:
            raise ValueError(f"Failed to delete user account")

        logger.info(f"Successfully deleted user account {user_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete user account: {e}")
        raise RuntimeError(f"Failed to delete user account: {e}")
