import logging
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from supabase_config import get_supabase_client
import secrets
import json

logger = logging.getLogger(__name__)



def create_enhanced_user(username: str, email: str, auth_method: str, credits: int = 10) -> Dict[str, Any]:
    """Create a new user with automatic 3-day trial and $10 credits"""
    try:
        client = get_supabase_client()
        
        # Prepare user data with trial setup
        trial_start = datetime.utcnow()
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
            'updated_at': datetime.utcnow().isoformat()
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
            'updated_at': datetime.utcnow().isoformat()
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
        timestamp = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
        
        result = client.table('usage_records').insert({
            'user_id': user_id,
            'api_key': api_key,
            'model': model,
            'tokens_used': tokens_used,
            'cost': cost,
            'request_id': request_id,
            'timestamp': timestamp
        }).execute()
        
        logger.info(f"Usage recorded successfully: user_id={user_id}, api_key={api_key[:20]}..., model={model}, tokens={tokens_used}, cost={cost}, request_id={request_id}")
        
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
        now = datetime.utcnow()
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

def get_user_rate_limits(api_key: str) -> Optional[Dict[str, Any]]:
    """Get rate limits for a user"""
    try:
        client = get_supabase_client()
        
        # First try to get rate limits from the new system (rate_limit_configs table)
        try:
            # Get the API key record from api_keys_new
            key_record = client.table('api_keys_new').select('*').eq('api_key', api_key).execute()
            
            if key_record.data:
                # Get rate limit config for this key
                rate_config = client.table('rate_limit_configs').select('*').eq('api_key_id', key_record.data[0]['id']).execute()
                
                if rate_config.data:
                    config = rate_config.data[0]
                    return {
                        'requests_per_minute': config.get('max_requests', 1000) // 60,  # Convert hourly to per-minute
                        'requests_per_hour': config.get('max_requests', 1000),
                        'requests_per_day': config.get('max_requests', 1000) * 24,  # Convert hourly to per-day
                        'tokens_per_minute': config.get('max_tokens', 1000000) // 60,
                        'tokens_per_hour': config.get('max_tokens', 1000000),
                        'tokens_per_day': config.get('max_tokens', 1000000) * 24
                    }
        except Exception as e:
            logger.warning(f"Failed to get rate limits from new system: {e}")
        
        # Fallback to old system (rate_limits table)
        result = client.table('rate_limits').select('*').eq('api_key', api_key).execute()
        
        if not result.data:
            return None
        
        rate_limits = result.data[0]
        return {
            'requests_per_minute': rate_limits.get('requests_per_minute', 60),
            'requests_per_hour': rate_limits.get('requests_per_hour', 1000),
            'requests_per_day': rate_limits.get('requests_per_day', 10000),
            'tokens_per_minute': rate_limits.get('tokens_per_minute', 10000),
            'tokens_per_hour': rate_limits.get('tokens_per_hour', 100000),
            'tokens_per_day': rate_limits.get('tokens_per_day', 1000000)
        }
        
    except Exception as e:
        logger.error(f"Error getting user rate limits: {e}")
        return None

def set_user_rate_limits(api_key: str, rate_limits: Dict[str, int]) -> None:
    try:
        client = get_supabase_client()
        
        user = get_user(api_key)
        if not user:
            raise ValueError(f"User with API key {api_key} not found")
        
        rate_limit_data = {
            'api_key': api_key,
            'user_id': user['id'],
            'requests_per_minute': rate_limits.get('requests_per_minute', 60),
            'requests_per_hour': rate_limits.get('requests_per_hour', 1000),
            'requests_per_day': rate_limits.get('requests_per_day', 10000),
            'tokens_per_minute': rate_limits.get('tokens_per_minute', 10000),
            'tokens_per_hour': rate_limits.get('tokens_per_hour', 100000),
            'tokens_per_day': rate_limits.get('tokens_per_day', 1000000),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        existing = client.table('rate_limits').select('*').eq('api_key', api_key).execute()
        
        if existing.data:
            result = client.table('rate_limits').update(rate_limit_data).eq('api_key', api_key).execute()
        else:
            result = client.table('rate_limits').insert(rate_limit_data).execute()
        
    except Exception as e:
        logger.error(f"Failed to set user rate limits: {e}")
        raise RuntimeError(f"Failed to set user rate limits: {e}")

def check_rate_limit(api_key: str, tokens_used: int = 0) -> Dict[str, Any]:
    try:
        client = get_supabase_client()
        
        rate_limits = get_user_rate_limits(api_key)
        if not rate_limits:
            return {'allowed': True, 'reason': 'No rate limits configured'}
        
        now = datetime.utcnow()
        minute_start = now.replace(second=0, microsecond=0)
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get current usage for all windows
        usage_result = client.table('rate_limit_usage').select('*').eq('api_key', api_key).execute()
        usage_records = usage_result.data
        
        # Find current window records
        minute_usage = next((u for u in usage_records if u['window_type'] == 'minute' and u['window_start'] == minute_start.isoformat()), None)
        hour_usage = next((u for u in usage_records if u['window_type'] == 'hour' and u['window_start'] == hour_start.isoformat()), None)
        day_usage = next((u for u in usage_records if u['window_type'] == 'day' and u['window_start'] == day_start.isoformat()), None)
        
        requests_minute = (minute_usage['requests_count'] if minute_usage else 0) + 1
        requests_hour = (hour_usage['requests_count'] if hour_usage else 0) + 1
        requests_day = (day_usage['requests_count'] if day_usage else 0) + 1
        
        tokens_minute = (minute_usage['tokens_count'] if minute_usage else 0) + tokens_used
        tokens_hour = (hour_usage['tokens_count'] if hour_usage else 0) + tokens_used
        tokens_day = (day_usage['tokens_count'] if day_usage else 0) + tokens_used
        
        if requests_minute > rate_limits['requests_per_minute']:
            return {'allowed': False, 'reason': f'Rate limit exceeded: {requests_minute} requests per minute'}
        
        if requests_hour > rate_limits['requests_per_hour']:
            return {'allowed': False, 'reason': f'Rate limit exceeded: {requests_hour} requests per hour'}
        
        if requests_day > rate_limits['requests_per_day']:
            return {'allowed': False, 'reason': f'Rate limit exceeded: {requests_day} requests per day'}
        
        if tokens_minute > rate_limits['tokens_per_minute']:
            return {'allowed': False, 'reason': f'Token limit exceeded: {tokens_minute} tokens per minute'}
        
        if tokens_hour > rate_limits['tokens_per_hour']:
            return {'allowed': False, 'reason': f'Token limit exceeded: {tokens_hour} tokens per hour'}
        
        if tokens_day > rate_limits['tokens_per_day']:
            return {'allowed': False, 'reason': f'Token limit exceeded: {tokens_day} tokens per day'}
        
        return {'allowed': True, 'reason': 'Within rate limits'}
        
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        return {'allowed': True, 'reason': 'Error checking rate limits'}

def update_rate_limit_usage(api_key: str, tokens_used: int) -> None:
    try:
        client = get_supabase_client()
        
        # Get user info
        user = get_user(api_key)
        if not user:
            logger.error(f"User not found for API key: {api_key}")
            return
        
        user_id = user['id']
        now = datetime.utcnow()
        
        # Ensure timestamp is timezone-aware
        from datetime import timezone
        timestamp = now.replace(tzinfo=timezone.utc).isoformat()
        
        # Calculate window starts
        minute_start = now.replace(second=0, microsecond=0).replace(tzinfo=timezone.utc).isoformat()
        hour_start = now.replace(minute=0, second=0, microsecond=0).replace(tzinfo=timezone.utc).isoformat()
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).replace(tzinfo=timezone.utc).isoformat()
        
        # Check if this is a new API key (gw_ prefix)
        is_new_key = api_key.startswith('gw_')
        
        # Update minute window
        minute_data = {
            'user_id': user_id,
            'api_key': api_key,
            'window_type': 'minute',
            'window_start': minute_start,
            'requests_count': 1,
            'tokens_count': tokens_used,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        # Update hour window
        hour_data = {
            'user_id': user_id,
            'api_key': api_key,
            'window_type': 'hour',
            'window_start': hour_start,
            'requests_count': 1,
            'tokens_count': tokens_used,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        # Update day window
        day_data = {
            'user_id': user_id,
            'api_key': api_key,
            'window_type': 'day',
            'window_start': day_start,
            'requests_count': 1,
            'tokens_count': tokens_used,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        # Try to update existing records, insert if they don't exist
        for window_data in [minute_data, hour_data, day_data]:
            try:
                # Check if record exists
                existing = client.table('rate_limit_usage').select('*').eq('api_key', api_key).eq('window_type', window_data['window_type']).eq('window_start', window_data['window_start']).execute()
                
                if existing.data:
                    # Update existing record
                    current = existing.data[0]
                    updated_data = {
                        'requests_count': current['requests_count'] + 1,
                        'tokens_count': current['tokens_count'] + tokens_used,
                        'updated_at': timestamp
                    }
                    client.table('rate_limit_usage').update(updated_data).eq('id', current['id']).execute()
                else:
                    # Insert new record
                    client.table('rate_limit_usage').insert(window_data).execute()
                    
            except Exception as e:
                logger.error(f"Failed to update rate limit usage for {window_data['window_type']}: {e}")
        
        # If this is a new key, also update the api_keys_new table
        if is_new_key:
            try:
                # Update last_used_at in api_keys_new
                client.table('api_keys_new').update({
                    'last_used_at': timestamp
                }).eq('api_key', api_key).execute()
            except Exception as e:
                logger.warning(f"Failed to update last_used_at in api_keys_new: {e}")
        
    except Exception as e:
        logger.error(f"Failed to update rate limit usage: {e}")

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
        
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
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

# API Key Management Functions
def check_key_name_uniqueness(user_id: int, key_name: str, exclude_key_id: Optional[int] = None) -> bool:
    """Check if a key name is unique within the user's scope"""
    try:
        client = get_supabase_client()
        
        # Build query to check for existing keys with same name
        query = client.table('api_keys_new').select('id').eq('user_id', user_id).eq('key_name', key_name)
        
        # If we're editing an existing key, exclude it from the check
        if exclude_key_id:
            query = query.neq('id', exclude_key_id)
        
        result = query.execute()
        
        # If no results, the name is unique
        return len(result.data) == 0
        
    except Exception as e:
        logger.error(f"Error checking key name uniqueness: {e}")
        # In case of error, assume name is not unique to be safe
        return False

def create_api_key(user_id: int, key_name: str, environment_tag: str = 'live', scope_permissions: Optional[Dict[str, Any]] = None, expiration_days: Optional[int] = None, max_requests: Optional[int] = None, ip_allowlist: Optional[List[str]] = None, domain_referrers: Optional[List[str]] = None, is_primary: bool = False) -> str:
    """Create a new API key for a user"""
    try:
        client = get_supabase_client()
        
        # Check for name uniqueness within user scope
        if not check_key_name_uniqueness(user_id, key_name):
            raise ValueError(f"Key name '{key_name}' already exists for this user. Please choose a different name.")
        
        # Enforce plan limits on key creation
        entitlements = check_plan_entitlements(user_id)
        if max_requests and max_requests > entitlements['monthly_request_limit']:
            logger.warning(f"User {user_id} attempted to create key with max_requests {max_requests} exceeding plan limit {entitlements['monthly_request_limit']}")
            max_requests = entitlements['monthly_request_limit']
        
        # Generate new API key with environment tag
        if environment_tag == 'test':
            prefix = 'gw_test_'
        elif environment_tag == 'staging':
            prefix = 'gw_staging_'
        elif environment_tag == 'development':
            prefix = 'gw_dev_'
        else:
            prefix = 'gw_live_'
        
        # Generate random part (32 characters for security)
        random_part = secrets.token_urlsafe(32)
        api_key = prefix + random_part
        
        # Calculate expiration date if specified
        expiration_date = None
        if expiration_days:
            expiration_date = (datetime.utcnow() + timedelta(days=expiration_days)).isoformat()
        
        # Set default permissions if none provided
        if scope_permissions is None:
            scope_permissions = {
                'read': ['*'],
                'write': ['*'],
                'admin': ['*']
            }
        
        # Create the API key record with new fields
        # Set up trial for new users (if this is their first key)
        trial_data = {}
        if is_primary:
            trial_start = datetime.utcnow()
            trial_end = trial_start + timedelta(days=3)
            trial_data = {
                'is_trial': True,
                'trial_start_date': trial_start.isoformat(),
                'trial_end_date': trial_end.isoformat(),
                'trial_used_tokens': 0,
                'trial_used_requests': 0,
                'trial_used_credits': 0.0,
                'trial_max_tokens': 100000,
                'trial_max_requests': 1000,
                'trial_credits': 10.0,
                'trial_converted': False,
                'subscription_status': 'trial',
                'subscription_plan': 'free_trial'
            }
        
        # Combine base data with trial data
        api_key_data = {
            'user_id': user_id,
            'key_name': key_name,
            'api_key': api_key,
            'is_active': True,
            'is_primary': is_primary,
            'expiration_date': expiration_date,
            'max_requests': max_requests,
            'requests_used': 0,
            'environment_tag': environment_tag,
            'scope_permissions': scope_permissions,
            'ip_allowlist': ip_allowlist or [],
            'domain_referrers': domain_referrers or [],
            'created_by_user_id': user_id,
            'last_used_at': datetime.utcnow().isoformat()
        }
        
        # Add trial data if this is a primary key
        api_key_data.update(trial_data)
        
        result = client.table('api_keys_new').insert(api_key_data).execute()
        
        if not result.data:
            raise ValueError("Failed to create API key")
        
        # Create rate limit configuration for the new key
        try:
            rate_limit_config = {
                'api_key_id': result.data[0]['id'],
                'window_type': 'sliding',
                'window_size': 3600,  # 1 hour
                'max_requests': max_requests or 1000,
                'max_tokens': 1000000,  # 1M tokens per hour
                'burst_limit': 100,
                'concurrency_limit': 10,
                'is_active': True
            }
            
            client.table('rate_limit_configs').insert(rate_limit_config).execute()
            
        except Exception as rate_limit_error:
            logger.warning(f"Failed to create rate limit config for API key {api_key}: {rate_limit_error}")
        
        # Create audit log entry
        try:
            client.table('api_key_audit_logs').insert({
                'user_id': user_id,
                'action': 'create',
                'api_key_id': result.data[0]['id'],
                'details': {
                    'key_name': key_name,
                    'environment_tag': environment_tag,
                    'scope_permissions': scope_permissions,
                    'expiration_days': expiration_days,
                    'max_requests': max_requests,
                    'is_primary': is_primary
                },
                'timestamp': datetime.utcnow().isoformat()
            }).execute()
        except Exception as audit_error:
            logger.warning(f"Failed to create audit log for API key {api_key}: {audit_error}")
        
        return api_key
        
    except Exception as e:
        logger.error(f"Failed to create API key: {e}")
        raise RuntimeError(f"Failed to create API key: {e}")

def get_user_api_keys(user_id: int) -> List[Dict[str, Any]]:
    """Get all API keys for a user"""
    try:
        client = get_supabase_client()
        
        # Query the new api_keys_new table
        result = client.table('api_keys_new').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        
        if not result.data:
            return []
        
        keys = []
        for key in result.data:
            try:
                # Calculate days remaining
                days_remaining = None
                if key.get('expiration_date'):
                    try:
                        expiration_str = key['expiration_date']
                        if expiration_str:
                            # Handle different datetime formats
                            if 'Z' in expiration_str:
                                expiration_str = expiration_str.replace('Z', '+00:00')
                            elif expiration_str.endswith('+00:00'):
                                pass  # Already timezone-aware
                            else:
                                # Make naive datetime timezone-aware
                                expiration_str = expiration_str + '+00:00'
                            
                            expiration = datetime.fromisoformat(expiration_str)
                            now = datetime.utcnow().replace(tzinfo=expiration.tzinfo)
                            days_remaining = max(0, (expiration - now).days)
                    except Exception as date_error:
                        logger.warning(f"Error calculating days remaining for key {key.get('id', 'unknown')}: {date_error}")
                        days_remaining = None
                
                # Calculate requests remaining
                requests_remaining = None
                if key.get('max_requests'):
                    requests_remaining = max(0, key['max_requests'] - key['requests_used'])
                
                # Calculate usage percentage
                usage_percentage = None
                if key.get('max_requests') and key.get('requests_used'):
                    usage_percentage = min(100, (key['requests_used'] / key['max_requests']) * 100)
                
                key_data = {
                    'id': key['id'],
                    'key_name': key['key_name'],
                    'api_key': key['api_key'],
                    'environment_tag': key.get('environment_tag', 'live'),
                    'scope_permissions': key.get('scope_permissions', {}),
                    'is_active': key['is_active'],
                    'is_primary': key.get('is_primary', False),
                    'expiration_date': key.get('expiration_date'),
                    'days_remaining': days_remaining,
                    'max_requests': key.get('max_requests'),
                    'requests_used': key.get('requests_used', 0),
                    'requests_remaining': requests_remaining,
                    'usage_percentage': usage_percentage,
                    'ip_allowlist': key.get('ip_allowlist', []),
                    'domain_referrers': key.get('domain_referrers', []),
                    'created_at': key.get('created_at'),
                    'updated_at': key.get('updated_at'),
                    'last_used_at': key.get('last_used_at')
                }
                
                keys.append(key_data)
                
            except Exception as e:
                logger.error(f"Error processing API key {key.get('id', 'unknown')}: {e}")
                continue
        
        return keys
        
    except Exception as e:
        logger.error(f"Error getting user API keys: {e}")
        return []

def delete_api_key(api_key: str, user_id: int) -> bool:
    """Delete an API key for a user"""
    try:
        client = get_supabase_client()
        
        # Check if this is a new API key (gw_ prefix)
        is_new_key = api_key.startswith('gw_')
        
        if is_new_key:
            # Delete from the new api_keys_new table
            result = client.table('api_keys_new').delete().eq('api_key', api_key).eq('user_id', user_id).execute()
            
            if result.data:
                # Also delete associated rate limit configs
                try:
                    client.table('rate_limit_configs').delete().eq('api_key_id', result.data[0]['id']).execute()
                except Exception as e:
                    logger.warning(f"Failed to delete rate limit configs for key {api_key}: {e}")
                
                # Create audit log entry
                try:
                    client.table('api_key_audit_logs').insert({
                        'user_id': user_id,
                        'action': 'delete',
                        'api_key_id': result.data[0]['id'],
                        'details': {
                            'deleted_at': datetime.utcnow().isoformat(),
                            'key_name': result.data[0].get('key_name', 'Unknown'),
                            'environment_tag': result.data[0].get('environment_tag', 'unknown')
                        },
                        'timestamp': datetime.utcnow().isoformat()
                    }).execute()
                except Exception as e:
                    logger.warning(f"Failed to create audit log for key deletion: {e}")
                
                return True
            else:
                return False
        else:
            # Fallback to old system for legacy keys
            result = client.table('api_keys').delete().eq('api_key', api_key).eq('user_id', user_id).execute()
            return bool(result.data)
            
    except Exception as e:
        logger.error(f"Failed to delete API key: {e}")
        return False

def validate_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """Validate an API key and return user info if valid"""
    try:
        client = get_supabase_client()
        
        # First, try to get the key from the new api_keys table
        try:
            # Check if key exists in api_keys table first
            key_result = client.table('api_keys').select('*').eq('api_key', api_key).execute()
            
            if key_result.data:
                key_data = key_result.data[0]
                
                # Check if key is active
                if not key_data.get('is_active', True):
                    logger.warning(f"API key {api_key} is inactive")
                    return None
                
                # Check expiration date
                if key_data.get('expiration_date'):
                    try:
                        expiration_str = key_data['expiration_date']
                        if expiration_str:
                            if 'Z' in expiration_str:
                                expiration_str = expiration_str.replace('Z', '+00:00')
                            elif not expiration_str.endswith('+00:00'):
                                expiration_str = expiration_str + '+00:00'
                            
                            expiration = datetime.fromisoformat(expiration_str)
                            now = datetime.utcnow().replace(tzinfo=expiration.tzinfo)
                            
                            if expiration < now:
                                logger.warning(f"API key {api_key} has expired")
                                return None
                    except Exception as date_error:
                        logger.warning(f"Error checking expiration for key {api_key}: {date_error}")
                
                # Check request limits
                if key_data.get('max_requests'):
                    if key_data['requests_used'] >= key_data['max_requests']:
                        logger.warning(f"API key {api_key} has reached request limit")
                        return None
                
                # Get user info
                user = get_user(api_key)
                if user:
                    return {
                        'user_id': user['id'],
                        'api_key': api_key,
                        'key_id': key_data['id'],
                        'key_name': key_data['key_name'],
                        'is_active': key_data['is_active'],
                        'expiration_date': key_data['expiration_date'],
                        'max_requests': key_data['max_requests'],
                        'requests_used': key_data['requests_used']
                    }
                    
        except Exception as e:
            logger.warning(f"New API key validation failed, falling back to old system: {e}")
        
        # Fallback: Check if key exists in the old users table (for backward compatibility)
        user = get_user(api_key)
        if user:
            # This is a legacy key, create a default entry in api_keys table
            try:
                # Check if key already exists in api_keys table
                existing_key = client.table('api_keys').select('*').eq('api_key', api_key).execute()
                
                if not existing_key.data:
                    # Create a default entry for this legacy key
                    client.table('api_keys').insert({
                        'user_id': user['id'],
                        'key_name': 'Legacy Key',
                        'api_key': api_key,
                        'is_active': True,
                        'expiration_date': None,  # No expiration for legacy keys
                        'max_requests': None,     # No request limit for legacy keys
                        'requests_used': 0
                    }).execute()
                    
                    logger.info(f"Created legacy key entry for user {user['id']}")
                
                # Return legacy key info
                return {
                    'user_id': user['id'],
                    'api_key': api_key,
                    'key_id': 0,  # Legacy key
                    'key_name': 'Legacy Key',
                    'is_active': True,
                    'expiration_date': None,
                    'max_requests': None,
                    'requests_used': 0
                }
                
            except Exception as e:
                logger.error(f"Failed to create legacy key entry: {e}")
                # Still return user info even if we can't create the entry
                return {
                    'user_id': user['id'],
                    'api_key': api_key,
                    'key_id': 0,
                    'key_name': 'Legacy Key',
                    'is_active': True,
                    'expiration_date': None,
                    'max_requests': None,
                    'requests_used': 0
                }
        
        return None
        
    except Exception as e:
        logger.error(f"Failed to validate API key: {e}")
        return None

def increment_api_key_usage(api_key: str) -> None:
    """Increment the request count for an API key"""
    try:
        client = get_supabase_client()
        
        # Try to increment in the new system first (api_keys_new table)
        try:
            # Check if key exists in api_keys_new table
            existing_key = client.table('api_keys_new').select('*').eq('api_key', api_key).execute()
            
            if existing_key.data:
                # Update existing entry in new system
                current_usage = existing_key.data[0]['requests_used']
                client.table('api_keys_new').update({
                    'requests_used': current_usage + 1,
                    'last_used_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('api_key', api_key).execute()
                return
                
        except Exception as e:
            logger.warning(f"Failed to update usage in api_keys_new table: {e}")
        
        # Fallback to old system (api_keys table)
        try:
            # Check if key exists in api_keys table
            existing_key = client.table('api_keys').select('*').eq('api_key', api_key).execute()
            
            if existing_key.data:
                # Update existing entry
                current_usage = existing_key.data[0]['requests_used']
                client.table('api_keys').update({
                    'requests_count': current_usage + 1,
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('api_key', api_key).execute()
            else:
                # Key doesn't exist, create entry
                user = get_user(api_key)
                if user:
                    client.table('api_keys').insert({
                        'user_id': user['id'],
                        'key_name': 'Legacy Key',
                        'api_key': api_key,
                        'is_active': True,
                        'expiration_date': None,
                        'max_requests': None,
                        'requests_count': 1
                    }).execute()
                    
        except Exception as e:
            logger.error(f"Failed to update usage in api_keys table: {e}")
            
    except Exception as e:
        logger.error(f"Failed to increment API key usage: {e}")

def get_api_key_usage_stats(api_key: str) -> Dict[str, Any]:
    """Get usage statistics for a specific API key"""
    try:
        client = get_supabase_client()
        
        # Check if this is a new API key (gw_ prefix)
        is_new_key = api_key.startswith('gw_')
        
        if is_new_key:
            # Query the new api_keys_new table
            key_result = client.table('api_keys_new').select('*').eq('api_key', api_key).execute()
            
            if not key_result.data:
                logger.warning(f"API key not found in api_keys_new table: {api_key[:20]}...")
                return {
                    'api_key': api_key,
                    'key_name': 'Unknown',
                    'is_active': False,
                    'requests_used': 0,
                    'max_requests': None,
                    'requests_remaining': None,
                    'usage_percentage': None,
                    'environment_tag': 'unknown',
                    'created_at': None,
                    'last_used_at': None
                }
            
            key_data = key_result.data[0]
            
            # Calculate requests remaining and usage percentage
            requests_remaining = None
            usage_percentage = None
            
            if key_data.get('max_requests'):
                requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_used', 0))
                usage_percentage = min(100, (key_data.get('requests_used', 0) / key_data['max_requests']) * 100)
            
            return {
                'api_key': api_key,
                'key_name': key_data.get('key_name', 'Unnamed Key'),
                'is_active': key_data.get('is_active', False),
                'requests_used': key_data.get('requests_used', 0),
                'max_requests': key_data.get('max_requests'),
                'requests_remaining': requests_remaining,
                'usage_percentage': usage_percentage,
                'environment_tag': key_data.get('environment_tag', 'live'),
                'created_at': key_data.get('created_at'),
                'last_used_at': key_data.get('last_used_at')
            }
        else:
            # Fallback to old system for legacy keys
            key_result = client.table('api_keys').select('*').eq('api_key', api_key).execute()
            
            if not key_result.data:
                return {
                    'api_key': api_key,
                    'key_name': 'Legacy Key',
                    'is_active': True,
                    'requests_used': 0,
                    'max_requests': None,
                    'requests_remaining': None,
                    'usage_percentage': None,
                    'environment_tag': 'legacy',
                    'created_at': None,
                    'last_used_at': None
                }
            
            key_data = key_result.data[0]
            
            # Calculate requests remaining and usage percentage
            requests_remaining = None
            usage_percentage = None
            
            if key_data.get('max_requests'):
                requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_count', 0))
                usage_percentage = min(100, (key_data.get('requests_count', 0) / key_data['max_requests']) * 100)
            
            return {
                'api_key': api_key,
                'key_name': key_data.get('key_name', 'Legacy Key'),
                'is_active': key_data.get('is_active', True),
                'requests_used': key_data.get('requests_count', 0),
                'max_requests': key_data.get('max_requests'),
                'requests_remaining': requests_remaining,
                'usage_percentage': usage_percentage,
                'environment_tag': 'legacy',
                'created_at': key_data.get('created_at'),
                'last_used_at': key_data.get('updated_at')
            }
            
    except Exception as e:
        logger.error(f"Error getting API key usage stats for {api_key[:20]}...: {e}")
        return {
            'api_key': api_key,
            'key_name': 'Error',
            'is_active': False,
            'requests_used': 0,
            'max_requests': None,
            'requests_remaining': None,
            'usage_percentage': None,
            'environment_tag': 'error',
            'created_at': None,
            'last_used_at': None
        }

def update_api_key(api_key: str, user_id: int, updates: Dict[str, Any]) -> bool:
    """Update an API key's details"""
    try:
        client = get_supabase_client()
        
        # First, get the key to verify ownership and get key_id
        key_result = client.table('api_keys_new').select('*').eq('api_key', api_key).eq('user_id', user_id).execute()
        
        if not key_result.data:
            raise ValueError("API key not found or not owned by user")
        
        key_data = key_result.data[0]
        key_id = key_data['id']
        
        # Prepare update data
        update_data = {}
        allowed_fields = [
            'key_name', 'scope_permissions', 'expiration_days', 'max_requests',
            'ip_allowlist', 'domain_referrers', 'is_active'
        ]
        
        for field, value in updates.items():
            if field in allowed_fields:
                update_data[field] = value
        
        # Special handling for key_name uniqueness
        if 'key_name' in update_data:
            if not check_key_name_uniqueness(user_id, update_data['key_name'], exclude_key_id=key_id):
                raise ValueError(f"Key name '{update_data['key_name']}' already exists for this user. Please choose a different name.")
        
        # Special handling for expiration_days
        if 'expiration_days' in update_data:
            if update_data['expiration_days'] is not None:
                update_data['expiration_date'] = (datetime.utcnow() + timedelta(days=update_data['expiration_days'])).isoformat()
            else:
                update_data['expiration_date'] = None
            # Remove the days field as we store the actual date
            del update_data['expiration_days']
        
        # Add timestamp
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
        # Update the API key
        result = client.table('api_keys_new').update(update_data).eq('id', key_id).execute()
        
        if not result.data:
            raise ValueError("Failed to update API key")
        
        # Update rate limit config if max_requests changed
        if 'max_requests' in updates and updates['max_requests'] is not None:
            try:
                client.table('rate_limit_configs').update({
                    'max_requests': updates['max_requests'],
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('api_key_id', key_id).execute()
            except Exception as e:
                logger.warning(f"Failed to update rate limit config: {e}")
        
        # Create audit log entry
        try:
            client.table('api_key_audit_logs').insert({
                'user_id': user_id,
                'action': 'update',
                'api_key_id': key_id,
                'details': {
                    'updated_fields': list(updates.keys()),
                    'old_values': {k: key_data.get(k) for k in updates.keys() if k in key_data},
                    'new_values': updates,
                    'update_timestamp': datetime.utcnow().isoformat()
                },
                'timestamp': datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to create audit log for key update: {e}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to update API key: {e}")
        raise RuntimeError(f"Failed to update API key: {e}")

def validate_api_key_permissions(api_key: str, required_permission: str, resource: str) -> bool:
    """Validate if an API key has the required permission for a resource"""
    try:
        client = get_supabase_client()
        
        # Get the API key record
        key_result = client.table('api_keys_new').select('scope_permissions, is_active').eq('api_key', api_key).execute()
        
        if not key_result.data:
            # Fallback to legacy key check
            legacy_result = client.table('api_keys').select('scope_permissions, is_active').eq('api_key', api_key).execute()
            if not legacy_result.data:
                logger.warning(f"API key not found: {api_key[:10]}...")
                return False
            key_data = legacy_result.data[0]
        else:
            key_data = key_result.data[0]
        
        # Check if key is active
        if not key_data.get('is_active', True):
            logger.warning(f"API key is inactive: {api_key[:10]}...")
            return False
        
        # Get scope permissions
        scope_permissions = key_data.get('scope_permissions', {})
        
        # If no permissions set, grant default access (for backward compatibility)
        if not scope_permissions or scope_permissions == {}:
    
            return True
        
        # Check if the required permission exists
        if required_permission in scope_permissions:
            # Check if the resource is in the allowed list for this permission
            allowed_resources = scope_permissions[required_permission]
            if isinstance(allowed_resources, list):
                # Check if resource is in the allowed list or if wildcard (*) is allowed
                has_permission = '*' in allowed_resources or resource in allowed_resources
                return has_permission
            elif isinstance(allowed_resources, str):
                # Single resource or wildcard
                has_permission = allowed_resources == '*' or allowed_resources == resource
                return has_permission
        
        return False
        return False
        
    except Exception as e:
        logger.error(f"Error validating API key permissions: {e}")
        return False

def get_api_key_by_id(key_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    """Get API key details by ID, ensuring user ownership"""
    try:
        client = get_supabase_client()
        
        result = client.table('api_keys_new').select('*').eq('id', key_id).eq('user_id', user_id).execute()
        
        if not result.data:
            return None
        
        key_data = result.data[0]
        
        # Calculate days remaining
        days_remaining = None
        if key_data.get('expiration_date'):
            try:
                expiration_str = key_data['expiration_date']
                if expiration_str:
                    # Handle different datetime formats
                    if 'Z' in expiration_str:
                        expiration_str = expiration_str.replace('Z', '+00:00')
                    elif expiration_str.endswith('+00:00'):
                        pass  # Already timezone-aware
                    else:
                        # Make naive datetime timezone-aware
                        expiration_str = expiration_str + '+00:00'
                    
                    expiration = datetime.fromisoformat(expiration_str)
                    now = datetime.utcnow().replace(tzinfo=expiration.tzinfo)
                    days_remaining = max(0, (expiration - now).days)
            except Exception as date_error:
                logger.warning(f"Error calculating days remaining for key {key_id}: {date_error}")
                days_remaining = None
        
        # Calculate requests remaining
        requests_remaining = None
        if key_data.get('max_requests'):
            requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_used', 0))
        
        # Calculate usage percentage
        usage_percentage = None
        if key_data.get('max_requests') and key_data.get('requests_used'):
            usage_percentage = min(100, (key_data.get('requests_used', 0) / key_data['max_requests']) * 100)
        
        return {
            'id': key_data['id'],
            'key_name': key_data['key_name'],
            'api_key': key_data['api_key'],
            'environment_tag': key_data.get('environment_tag', 'live'),
            'scope_permissions': key_data.get('scope_permissions', {}),
            'is_active': key_data['is_active'],
            'is_primary': key_data.get('is_primary', False),
            'expiration_date': key_data.get('expiration_date'),
            'days_remaining': days_remaining,
            'max_requests': key_data.get('max_requests'),
            'requests_used': key_data.get('requests_used', 0),
            'requests_remaining': requests_remaining,
            'usage_percentage': usage_percentage,
            'ip_allowlist': key_data.get('ip_allowlist', []),
            'domain_referrers': key_data.get('domain_referrers', []),
            'created_at': key_data.get('created_at'),
            'updated_at': key_data.get('updated_at'),
            'last_used_at': key_data.get('last_used_at')
        }
        
    except Exception as e:
        logger.error(f"Error getting API key by ID: {e}")
        return None

def get_user_all_api_keys_usage(user_id: int) -> Dict[str, Any]:
    """Get usage statistics for all API keys of a user"""
    try:
        client = get_supabase_client()
        
        # Get all API keys for the user
        keys_result = client.table('api_keys_new').select('*').eq('user_id', user_id).execute()
        
        if not keys_result.data:
            return {
                'user_id': user_id,
                'total_keys': 0,
                'keys': []
            }
        
        keys_usage = []
        for key_data in keys_result.data:
            # Calculate requests remaining and usage percentage
            requests_remaining = None
            usage_percentage = None
            
            if key_data.get('max_requests'):
                requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_used', 0))
                usage_percentage = min(100, (key_data.get('requests_used', 0) / key_data['max_requests']) * 100)
            
            key_usage = {
                'key_id': key_data['id'],
                'api_key': key_data['api_key'][:10] + '...',  # Truncate for security
                'key_name': key_data.get('key_name', 'Unnamed Key'),
                'is_active': key_data.get('is_active', False),
                'is_primary': key_data.get('is_primary', False),
                'requests_used': key_data.get('requests_used', 0),
                'max_requests': key_data.get('max_requests'),
                'requests_remaining': requests_remaining,
                'usage_percentage': usage_percentage,
                'environment_tag': key_data.get('environment_tag', 'live'),
                'created_at': key_data.get('created_at'),
                'last_used_at': key_data.get('last_used_at')
            }
            keys_usage.append(key_usage)
        
        return {
            'user_id': user_id,
            'total_keys': len(keys_usage),
            'keys': keys_usage
        }
        
    except Exception as e:
        logger.error(f"Error getting all API keys usage for user {user_id}: {e}")
        return None

# Plan Management Functions
def get_all_plans() -> List[Dict[str, Any]]:
    """Get all available subscription plans"""
    try:
        logger.info("Getting all plans from database...")
        client = get_supabase_client()
        logger.info("Supabase client obtained successfully")
        
        result = client.table('plans').select('*').eq('is_active', True).order('price_per_month').execute()
        logger.info(f"Database query executed, got {len(result.data) if result.data else 0} plans")
        
        if result.data:
            logger.info(f"First plan sample: {result.data[0] if result.data else 'None'}")
        
        return result.data or []
    except Exception as e:
        logger.error(f"Error getting plans: {e}", exc_info=True)
        return []

def get_plan_by_id(plan_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific plan by ID"""
    try:
        client = get_supabase_client()
        result = client.table('plans').select('*').eq('id', plan_id).eq('is_active', True).execute()
        
        if not result.data:
            return None
        
        plan = result.data[0]
        
        # Handle features field - convert from dict to list if needed
        features = plan.get('features', [])
        if isinstance(features, dict):
            # Convert dict to list of feature names
            features = list(features.keys())
        elif not isinstance(features, list):
            features = []
        
        # Return plan with converted features
        plan['features'] = features
        return plan
        
    except Exception as e:
        logger.error(f"Error getting plan {plan_id}: {e}")
        return None

def get_user_plan(user_id: int) -> Optional[Dict[str, Any]]:
    """Get current active plan for user"""
    try:
        client = get_supabase_client()
        
        # Get active user plan
        user_plan_result = client.table('user_plans').select('*').eq('user_id', user_id).eq('is_active', True).execute()
        
        if not user_plan_result.data:
            return None
        
        user_plan = user_plan_result.data[0]
        
        # Get plan details
        plan_result = client.table('plans').select('*').eq('id', user_plan['plan_id']).execute()
        
        if not plan_result.data:
            return None
        
        plan = plan_result.data[0]
        
        # Handle features field - convert from dict to list if needed
        features = plan.get('features', [])
        if isinstance(features, dict):
            # Convert dict to list of feature names
            features = list(features.keys())
        elif not isinstance(features, list):
            features = []
        
        # Combine user plan and plan data
        return {
            'user_plan_id': user_plan['id'],
            'user_id': user_id,
            'plan_id': plan['id'],
            'plan_name': plan['name'],
            'plan_description': plan['description'],
            'daily_request_limit': plan['daily_request_limit'],
            'monthly_request_limit': plan['monthly_request_limit'],
            'daily_token_limit': plan['daily_token_limit'],
            'monthly_token_limit': plan['monthly_token_limit'],
            'price_per_month': plan['price_per_month'],
            'features': features,
            'start_date': user_plan['start_date'],
            'end_date': user_plan['end_date'],
            'is_active': user_plan['is_active']
        }
        
    except Exception as e:
        logger.error(f"Error getting user plan for user {user_id}: {e}")
        return None

def assign_user_plan(user_id: int, plan_id: int, duration_months: int = 1) -> bool:
    """Assign a plan to a user"""
    try:
        client = get_supabase_client()
        
        # Verify plan exists
        plan = get_plan_by_id(plan_id)
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")
        
        # Deactivate existing plans
        client.table('user_plans').update({'is_active': False}).eq('user_id', user_id).execute()
        
        # Create new plan assignment
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(days=30 * duration_months)
        
        user_plan_data = {
            'user_id': user_id,
            'plan_id': plan_id,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'is_active': True
        }
        
        result = client.table('user_plans').insert(user_plan_data).execute()
        
        if not result.data:
            raise ValueError("Failed to assign plan to user")
        
        # Update user subscription status
        client.table('users').update({
            'subscription_status': 'active',
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', user_id).execute()
        
        return True
        
    except Exception as e:
        logger.error(f"Error assigning plan {plan_id} to user {user_id}: {e}")
        raise RuntimeError(f"Failed to assign plan: {e}")

def check_plan_entitlements(user_id: int, required_feature: str = None) -> Dict[str, Any]:
    """Check if user's current plan allows certain usage"""
    try:
        user_plan = get_user_plan(user_id)
        
        if not user_plan:
            # No active plan - trial limits
            return {
                'has_plan': False,
                'daily_request_limit': 100,
                'monthly_request_limit': 1000,
                'daily_token_limit': 10000,
                'monthly_token_limit': 100000,
                'features': ['basic_models'],
                'plan_name': 'Trial',
                'can_access_feature': required_feature in ['basic_models'] if required_feature else True
            }
        
        # Check if plan is expired
        end_date = datetime.fromisoformat(user_plan['end_date'].replace('Z', '+00:00'))
        now = datetime.utcnow().replace(tzinfo=end_date.tzinfo)
        
        if end_date < now:
            # Expired plan - revert to trial
            client = get_supabase_client()
            client.table('user_plans').update({'is_active': False}).eq('id', user_plan['user_plan_id']).execute()
            client.table('users').update({'subscription_status': 'expired'}).eq('id', user_id).execute()
            
            return {
                'has_plan': False,
                'plan_expired': True,
                'daily_request_limit': 100,
                'monthly_request_limit': 1000,
                'daily_token_limit': 10000,
                'monthly_token_limit': 100000,
                'features': ['basic_models'],
                'plan_name': 'Expired',
                'can_access_feature': required_feature in ['basic_models'] if required_feature else True
            }
        
        # Active plan - handle features field conversion
        features = user_plan.get('features', [])
        if isinstance(features, dict):
            features = list(features.keys())
        elif not isinstance(features, list):
            features = []
        
        return {
            'has_plan': True,
            'plan_name': user_plan['plan_name'],
            'daily_request_limit': user_plan['daily_request_limit'],
            'monthly_request_limit': user_plan['monthly_request_limit'],
            'daily_token_limit': user_plan['daily_token_limit'],
            'monthly_token_limit': user_plan['monthly_token_limit'],
            'features': features,
            'can_access_feature': required_feature in features if required_feature else True,
            'plan_expires': user_plan['end_date']
        }
        
    except Exception as e:
        logger.error(f"Error checking plan entitlements for user {user_id}: {e}")
        # Return safe defaults on error
        return {
            'has_plan': False,
            'daily_request_limit': 100,
            'monthly_request_limit': 1000,
            'daily_token_limit': 10000,
            'monthly_token_limit': 100000,
            'features': ['basic_models'],
            'plan_name': 'Error',
            'can_access_feature': False
        }

def get_user_usage_within_plan_limits(user_id: int) -> Dict[str, Any]:
    """Get user's current usage against their plan limits"""
    try:
        client = get_supabase_client()
        entitlements = check_plan_entitlements(user_id)
        
        # Get usage for today and this month
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Get daily usage
        daily_usage_result = client.table('usage_records').select('tokens_used').eq('user_id', user_id).gte('timestamp', today_start.isoformat()).execute()
        daily_tokens = sum(record['tokens_used'] for record in (daily_usage_result.data or []))
        
        # Get monthly usage
        monthly_usage_result = client.table('usage_records').select('tokens_used').eq('user_id', user_id).gte('timestamp', month_start.isoformat()).execute()
        monthly_tokens = sum(record['tokens_used'] for record in (monthly_usage_result.data or []))
        
        # Get daily requests
        daily_requests = len(daily_usage_result.data or [])
        monthly_requests = len(monthly_usage_result.data or [])
        
        return {
            'plan_name': entitlements['plan_name'],
            'usage': {
                'daily_requests': daily_requests,
                'daily_tokens': daily_tokens,
                'monthly_requests': monthly_requests,
                'monthly_tokens': monthly_tokens
            },
            'limits': {
                'daily_request_limit': entitlements['daily_request_limit'],
                'daily_token_limit': entitlements['daily_token_limit'],
                'monthly_request_limit': entitlements['monthly_request_limit'],
                'monthly_token_limit': entitlements['monthly_token_limit']
            },
            'remaining': {
                'daily_requests': max(0, entitlements['daily_request_limit'] - daily_requests),
                'daily_tokens': max(0, entitlements['daily_token_limit'] - daily_tokens),
                'monthly_requests': max(0, entitlements['monthly_request_limit'] - monthly_requests),
                'monthly_tokens': max(0, entitlements['monthly_token_limit'] - monthly_tokens)
            },
            'at_limit': {
                'daily_requests': daily_requests >= entitlements['daily_request_limit'],
                'daily_tokens': daily_tokens >= entitlements['daily_token_limit'],
                'monthly_requests': monthly_requests >= entitlements['monthly_request_limit'],
                'monthly_tokens': monthly_tokens >= entitlements['monthly_token_limit']
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting usage within plan limits for user {user_id}: {e}")
        return None

def enforce_plan_limits(user_id: int, tokens_requested: int = 0, environment_tag: str = 'live') -> Dict[str, Any]:
    """Check if user can make a request within their plan limits"""
    try:
        usage_data = get_user_usage_within_plan_limits(user_id)
        if not usage_data:
            return {'allowed': False, 'reason': 'Unable to check plan limits'}
        
        # Apply environment-specific limits (test environments get lower limits)
        env_multiplier = 1.0
        if environment_tag in ['test', 'staging', 'development']:
            env_multiplier = 0.5  # Test environments get 50% of plan limits
        
        effective_daily_request_limit = int(usage_data['limits']['daily_request_limit'] * env_multiplier)
        effective_monthly_request_limit = int(usage_data['limits']['monthly_request_limit'] * env_multiplier)
        effective_daily_token_limit = int(usage_data['limits']['daily_token_limit'] * env_multiplier)
        effective_monthly_token_limit = int(usage_data['limits']['monthly_token_limit'] * env_multiplier)
        
        # Check if adding this request would exceed limits
        new_daily_tokens = usage_data['usage']['daily_tokens'] + tokens_requested
        new_monthly_tokens = usage_data['usage']['monthly_tokens'] + tokens_requested
        new_daily_requests = usage_data['usage']['daily_requests'] + 1
        new_monthly_requests = usage_data['usage']['monthly_requests'] + 1
        
        if new_daily_requests > effective_daily_request_limit:
            return {'allowed': False, 'reason': f"Daily request limit exceeded ({effective_daily_request_limit}) for {environment_tag} environment"}
        
        if new_monthly_requests > effective_monthly_request_limit:
            return {'allowed': False, 'reason': f"Monthly request limit exceeded ({effective_monthly_request_limit}) for {environment_tag} environment"}
        
        if new_daily_tokens > effective_daily_token_limit:
            return {'allowed': False, 'reason': f"Daily token limit exceeded ({effective_daily_token_limit}) for {environment_tag} environment"}
        
        if new_monthly_tokens > effective_monthly_token_limit:
            return {'allowed': False, 'reason': f"Monthly token limit exceeded ({effective_monthly_token_limit}) for {environment_tag} environment"}
        
        return {'allowed': True, 'reason': 'Within plan limits'}
        
    except Exception as e:
        logger.error(f"Error enforcing plan limits for user {user_id}: {e}")
        return {'allowed': False, 'reason': 'Error checking plan limits'}

def get_environment_usage_summary(user_id: int) -> Dict[str, Any]:
    """Get usage breakdown by environment"""
    try:
        client = get_supabase_client()
        
        # Get all API keys for the user with their environment tags
        keys_result = client.table('api_keys_new').select('environment_tag, requests_used, max_requests').eq('user_id', user_id).execute()
        
        env_summary = {}
        for key in (keys_result.data or []):
            env_tag = key.get('environment_tag', 'unknown')
            if env_tag not in env_summary:
                env_summary[env_tag] = {
                    'total_requests': 0,
                    'total_max_requests': 0,
                    'key_count': 0
                }
            
            env_summary[env_tag]['total_requests'] += key.get('requests_used', 0)
            if key.get('max_requests'):
                env_summary[env_tag]['total_max_requests'] += key['max_requests']
            env_summary[env_tag]['key_count'] += 1
        
        return env_summary
        
    except Exception as e:
        logger.error(f"Error getting environment usage summary for user {user_id}: {e}")
        return {}

# =============================================================================
# ADVANCED RATE LIMITING FUNCTIONS
# =============================================================================

def get_rate_limit_config(api_key: str) -> Optional[Dict[str, Any]]:
    """Get rate limit configuration for a specific API key"""
    try:
        client = get_supabase_client()
        
        # Get rate limit config from api_keys table
        result = client.table('api_keys').select('rate_limit_config').eq('api_key', api_key).execute()
        
        if result.data and result.data[0].get('rate_limit_config'):
            return result.data[0]['rate_limit_config']
        
        # Fallback to default config
        return {
            'requests_per_minute': 60,
            'requests_per_hour': 1000,
            'requests_per_day': 10000,
            'tokens_per_minute': 10000,
            'tokens_per_hour': 100000,
            'tokens_per_day': 1000000,
            'burst_limit': 10,
            'concurrency_limit': 5,
            'window_size_seconds': 60
        }
        
    except Exception as e:
        logger.error(f"Error getting rate limit config for key {api_key[:10]}...: {e}")
        return None

def update_rate_limit_config(api_key: str, config: Dict[str, Any]) -> bool:
    """Update rate limit configuration for a specific API key"""
    try:
        client = get_supabase_client()
        
        result = client.table('api_keys').update({
            'rate_limit_config': config,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('api_key', api_key).execute()
        
        return len(result.data) > 0
        
    except Exception as e:
        logger.error(f"Error updating rate limit config for key {api_key[:10]}...: {e}")
        return False

def get_user_rate_limit_configs(user_id: int) -> List[Dict[str, Any]]:
    """Get all rate limit configurations for a user's API keys"""
    try:
        client = get_supabase_client()
        
        result = client.table('api_keys').select(
            'api_key, key_name, rate_limit_config, environment_tag'
        ).eq('user_id', user_id).execute()
        
        configs = []
        for key in (result.data or []):
            config = key.get('rate_limit_config', {})
            configs.append({
                'api_key': key['api_key'],
                'key_name': key['key_name'],
                'environment_tag': key['environment_tag'],
                'rate_limit_config': config
            })
        
        return configs
        
    except Exception as e:
        logger.error(f"Error getting rate limit configs for user {user_id}: {e}")
        return []

def bulk_update_rate_limit_configs(user_id: int, config: Dict[str, Any]) -> int:
    """Bulk update rate limit configurations for all user's API keys"""
    try:
        client = get_supabase_client()
        
        result = client.table('api_keys').update({
            'rate_limit_config': config,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('user_id', user_id).execute()
        
        return len(result.data)
        
    except Exception as e:
        logger.error(f"Error bulk updating rate limit configs for user {user_id}: {e}")
        return 0

def get_rate_limit_usage_stats(api_key: str, time_window: str = 'minute') -> Dict[str, Any]:
    """Get current rate limit usage statistics for an API key"""
    try:
        client = get_supabase_client()
        
        now = datetime.utcnow()
        
        if time_window == 'minute':
            start_time = now.replace(second=0, microsecond=0)
            end_time = start_time + timedelta(minutes=1)
        elif time_window == 'hour':
            start_time = now.replace(minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(hours=1)
        elif time_window == 'day':
            start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(days=1)
        else:
            raise ValueError(f"Invalid time window: {time_window}")
        
        # Get usage records for the time window
        result = client.table('usage_records').select(
            'tokens_used, created_at'
        ).eq('api_key', api_key).gte('created_at', start_time.isoformat()).lt('created_at', end_time.isoformat()).execute()
        
        total_requests = len(result.data or [])
        total_tokens = sum(record.get('tokens_used', 0) for record in (result.data or []))
        
        return {
            'time_window': time_window,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'total_requests': total_requests,
            'total_tokens': total_tokens,
            'requests_per_second': total_requests / (end_time - start_time).total_seconds() if (end_time - start_time).total_seconds() > 0 else 0
        }
        
    except Exception as e:
        logger.error(f"Error getting rate limit usage stats for key {api_key[:10]}...: {e}")
        return {
            'time_window': time_window,
            'total_requests': 0,
            'total_tokens': 0,
            'requests_per_second': 0
        }

def get_system_rate_limit_stats() -> Dict[str, Any]:
    """Get system-wide rate limiting statistics"""
    try:
        client = get_supabase_client()
        
        now = datetime.utcnow()
        minute_ago = now - timedelta(minutes=1)
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)
        
        # Get usage stats for different time windows
        minute_result = client.table('usage_records').select('api_key, tokens_used').gte('created_at', minute_ago.isoformat()).execute()
        hour_result = client.table('usage_records').select('api_key, tokens_used').gte('created_at', hour_ago.isoformat()).execute()
        day_result = client.table('usage_records').select('api_key, tokens_used').gte('created_at', day_ago.isoformat()).execute()
        
        # Calculate stats
        minute_requests = len(minute_result.data or [])
        minute_tokens = sum(record.get('tokens_used', 0) for record in (minute_result.data or []))
        
        hour_requests = len(hour_result.data or [])
        hour_tokens = sum(record.get('tokens_used', 0) for record in (hour_result.data or []))
        
        day_requests = len(day_result.data or [])
        day_tokens = sum(record.get('tokens_used', 0) for record in (day_result.data or []))
        
        # Get unique active keys
        active_keys_minute = len(set(record['api_key'] for record in (minute_result.data or [])))
        active_keys_hour = len(set(record['api_key'] for record in (hour_result.data or [])))
        active_keys_day = len(set(record['api_key'] for record in (day_result.data or [])))
        
        return {
            'timestamp': now.isoformat(),
            'minute': {
                'requests': minute_requests,
                'tokens': minute_tokens,
                'active_keys': active_keys_minute,
                'requests_per_second': minute_requests / 60
            },
            'hour': {
                'requests': hour_requests,
                'tokens': hour_tokens,
                'active_keys': active_keys_hour,
                'requests_per_minute': hour_requests / 60
            },
            'day': {
                'requests': day_requests,
                'tokens': day_tokens,
                'active_keys': active_keys_day,
                'requests_per_hour': day_requests / 24
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting system rate limit stats: {e}")
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'minute': {'requests': 0, 'tokens': 0, 'active_keys': 0, 'requests_per_second': 0},
            'hour': {'requests': 0, 'tokens': 0, 'active_keys': 0, 'requests_per_minute': 0},
            'day': {'requests': 0, 'tokens': 0, 'active_keys': 0, 'requests_per_hour': 0}
        }

def create_rate_limit_alert(api_key: str, alert_type: str, details: Dict[str, Any]) -> bool:
    """Create a rate limit alert for monitoring (optional - table may not exist)"""
    try:
        client = get_supabase_client()
        
        # Check if rate_limit_alerts table exists
        try:
            # Try to query the table to see if it exists
            client.table('rate_limit_alerts').select('id').limit(1).execute()
        except Exception:
            # Table doesn't exist, skip alert creation
            logger.info("Rate limit alerts table not available, skipping alert creation")
            return True
        
        alert_data = {
            'api_key': api_key,
            'alert_type': alert_type,
            'details': details,
            'created_at': datetime.utcnow().isoformat(),
            'resolved': False
        }
        
        result = client.table('rate_limit_alerts').insert(alert_data).execute()
        return len(result.data) > 0
        
    except Exception as e:
        logger.warning(f"Rate limit alert creation failed (non-critical): {e}")
        return True  # Return True to not block the main flow

def get_rate_limit_alerts(api_key: Optional[str] = None, resolved: bool = False, limit: int = 100) -> List[Dict[str, Any]]:
    """Get rate limit alerts with optional filtering"""
    try:
        client = get_supabase_client()
        
        query = client.table('rate_limit_alerts').select('*').eq('resolved', resolved).order('created_at', desc=True).limit(limit)
        
        if api_key:
            query = query.eq('api_key', api_key)
        
        result = query.execute()
        return result.data or []
        
    except Exception as e:
        logger.error(f"Error getting rate limit alerts: {e}")
        return []

# Trial Management Functions

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

def get_subscription_plans() -> List[Dict[str, Any]]:
    """Get available subscription plans"""
    try:
        client = get_supabase_client()
        result = client.table('subscription_plans').select('*').eq('is_active', True).execute()
        return result.data if result.data else []
        
    except Exception as e:
        logger.error(f"Error getting subscription plans: {e}")
        return []

def get_trial_analytics() -> Dict[str, Any]:
    """Get trial analytics and conversion metrics"""
    try:
        client = get_supabase_client()
        
        # Get trial statistics
        trial_stats = client.table('api_keys').select('is_trial, trial_converted, trial_start_date, trial_end_date').execute()
        
        if not trial_stats.data:
            return {"error": "No data available"}
        
        total_trials = len([k for k in trial_stats.data if k['is_trial']])
        active_trials = len([k for k in trial_stats.data if k['is_trial'] and k['trial_end_date'] and datetime.fromisoformat(k['trial_end_date'].replace('Z', '+00:00')) > datetime.now()])
        converted_trials = len([k for k in trial_stats.data if k['trial_converted']])
        
        conversion_rate = (converted_trials / total_trials * 100) if total_trials > 0 else 0
        
        return {
            "total_trials": total_trials,
            "active_trials": active_trials,
            "expired_trials": total_trials - active_trials,
            "converted_trials": converted_trials,
            "conversion_rate": round(conversion_rate, 2)
        }
        
    except Exception as e:
        logger.error(f"Error getting trial analytics: {e}")
        return {"error": str(e)}
