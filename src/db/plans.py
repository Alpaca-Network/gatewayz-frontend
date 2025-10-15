import logging
import datetime
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from src.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)

# Default entitlements used when a plan cannot be resolved from the database.
DEFAULT_DAILY_REQUEST_LIMIT = 100
DEFAULT_MONTHLY_REQUEST_LIMIT = 1000
DEFAULT_DAILY_TOKEN_LIMIT = 500_000
DEFAULT_MONTHLY_TOKEN_LIMIT = 15_000_000
DEFAULT_TRIAL_FEATURES = ['basic_models']

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


    """Get current active plan for user (robust: never silently falls back to trial)"""
    try:
        client = get_supabase_client()

        user_plan_result = client.table('user_plans').select('*') \
            .eq('user_id', user_id).eq('is_active', True).execute()
        if not user_plan_result.data:
            return None

        user_plan = user_plan_result.data[0]

        # Reuse helper so feature normalization is consistent
        plan = get_plan_by_id(user_plan['plan_id'])

        if not plan:
            # Fallback: still surface the existence of an active user_plan
            return {
                'user_plan_id': user_plan['id'],
                'user_id': user_id,
                'plan_id': user_plan['plan_id'],
                'plan_name': 'Unknown',
                'plan_description': '',
                'daily_request_limit': DEFAULT_DAILY_REQUEST_LIMIT,
                'monthly_request_limit': DEFAULT_MONTHLY_REQUEST_LIMIT,
                'daily_token_limit': DEFAULT_DAILY_TOKEN_LIMIT,
                'monthly_token_limit': DEFAULT_MONTHLY_TOKEN_LIMIT,
                'price_per_month': 0,
                'features': [],
                'start_date': user_plan['start_date'],
                'end_date': user_plan['end_date'],
                'is_active': True
            }

        features = plan.get('features', [])
        if isinstance(features, dict):
            features = list(features.keys())
        elif not isinstance(features, list):
            features = []

        logger.info("get_user_plan: user=%s", user_id)
        logger.info(" -> found active user_plans: %s", bool(user_plan_result.data))
        if user_plan_result.data:
            logger.info(" -> plan lookup id=%s", user_plan_result.data[0]['plan_id'])
            logger.info(" -> plan found: %s", bool(plan))
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
        start_date = datetime.now(timezone.utc)
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
            'updated_at': datetime.now(timezone.utc).isoformat()
        }).eq('id', user_id).execute()

        return True

    except Exception as e:
        logger.error(f"Error assigning plan {plan_id} to user {user_id}: {e}")
        raise RuntimeError(f"Failed to assign plan: {e}")


def check_plan_entitlements(user_id: int, required_feature: str = None) -> Dict[str, Any]:
    """Check if user's current plan allows certain usage"""
    try:
        user_plan = get_user_plan(user_id)

        # If get_user_plan() failed, inspect user_plans directly to avoid dropping to trial by mistake
        if not user_plan:
            client = get_supabase_client()
            up_rs = client.table('user_plans').select('*').eq('user_id', user_id).eq('is_active', True).execute()

            if up_rs.data:
                up = up_rs.data[0]
                end_str = up.get('end_date')
                end_dt = None
                if end_str:
                    try:
                        end_dt = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                    except Exception:
                        end_dt = None

                now = datetime.now(timezone.utc)

                # If expired, mark expired and return the expired payload
                if end_dt and end_dt < now:
                    client.table('user_plans').update({'is_active': False}).eq('id', up['id']).execute()
                    client.table('users').update({'subscription_status': 'expired'}).eq('id', user_id).execute()
                    return {
                        'has_plan': False,
                        'plan_expired': True,
                        'daily_request_limit': DEFAULT_DAILY_REQUEST_LIMIT,
                        'monthly_request_limit': DEFAULT_MONTHLY_REQUEST_LIMIT,
                        'daily_token_limit': DEFAULT_DAILY_TOKEN_LIMIT,
                        'monthly_token_limit': DEFAULT_MONTHLY_TOKEN_LIMIT,
                        'features': DEFAULT_TRIAL_FEATURES.copy(),
                        'plan_name': 'Expired',
                        'can_access_feature': required_feature in DEFAULT_TRIAL_FEATURES if required_feature else True
                    }

                # ACTIVE PLAN FALLBACK: try to load the plan and return has_plan=True
                plan = get_plan_by_id(up['plan_id'])
                if plan:
                    features = plan.get('features', [])
                    if isinstance(features, dict):
                        features = list(features.keys())
                    elif not isinstance(features, list):
                        features = []

                    return {
                        'has_plan': True,
                        'plan_name': plan['name'],
                        'daily_request_limit': plan['daily_request_limit'],
                        'monthly_request_limit': plan['monthly_request_limit'],
                        'daily_token_limit': plan['daily_token_limit'],
                        'monthly_token_limit': plan['monthly_token_limit'],
                        'features': features,
                        'can_access_feature': (required_feature in features) if required_feature else True,
                        'plan_expires': up['end_date'],
                    }

                # If we still can't get the plan row, assume an active-but-unknown plan with conservative defaults
                return {
                    'has_plan': True,
                    'plan_name': 'Unknown',
                    'daily_request_limit': DEFAULT_DAILY_REQUEST_LIMIT,
                    'monthly_request_limit': DEFAULT_MONTHLY_REQUEST_LIMIT,
                    'daily_token_limit': DEFAULT_DAILY_TOKEN_LIMIT,
                    'monthly_token_limit': DEFAULT_MONTHLY_TOKEN_LIMIT,
                    'features': [],
                    'can_access_feature': (required_feature is None),  # no features to gate
                    'plan_expires': up.get('end_date'),
                }

            # Truly no active plan → trial defaults
            return {
                'has_plan': False,
                'daily_request_limit': DEFAULT_DAILY_REQUEST_LIMIT,
                'monthly_request_limit': DEFAULT_MONTHLY_REQUEST_LIMIT,
                'daily_token_limit': DEFAULT_DAILY_TOKEN_LIMIT,
                'monthly_token_limit': DEFAULT_MONTHLY_TOKEN_LIMIT,
                'features': DEFAULT_TRIAL_FEATURES.copy(),
                'plan_name': 'Trial',
                'can_access_feature': required_feature in DEFAULT_TRIAL_FEATURES if required_feature else True
            }

        # We have a combined user_plan (happy path)
        end_date = datetime.fromisoformat(user_plan['end_date'].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        if end_date < now:
            client = get_supabase_client()
            client.table('user_plans').update({'is_active': False}).eq('id', user_plan['user_plan_id']).execute()
            client.table('users').update({'subscription_status': 'expired'}).eq('id', user_id).execute()
            return {
                'has_plan': False,
                'plan_expired': True,
                'daily_request_limit': DEFAULT_DAILY_REQUEST_LIMIT,
                'monthly_request_limit': DEFAULT_MONTHLY_REQUEST_LIMIT,
                'daily_token_limit': DEFAULT_DAILY_TOKEN_LIMIT,
                'monthly_token_limit': DEFAULT_MONTHLY_TOKEN_LIMIT,
                'features': DEFAULT_TRIAL_FEATURES.copy(),
                'plan_name': 'Expired',
                'can_access_feature': required_feature in DEFAULT_TRIAL_FEATURES if required_feature else True
            }

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
            'can_access_feature': (required_feature in features) if required_feature else True,
            'plan_expires': user_plan['end_date']
        }

    except Exception as e:
        logger.error(f"Error checking plan entitlements for user {user_id}: {e}")
        # Safe defaults on error
        return {
            'has_plan': False,
            'daily_request_limit': DEFAULT_DAILY_REQUEST_LIMIT,
            'monthly_request_limit': DEFAULT_MONTHLY_REQUEST_LIMIT,
            'daily_token_limit': DEFAULT_DAILY_TOKEN_LIMIT,
            'monthly_token_limit': DEFAULT_MONTHLY_TOKEN_LIMIT,
            'features': DEFAULT_TRIAL_FEATURES.copy(),
            'plan_name': 'Error',
            'can_access_feature': False
        }


def get_user_usage_within_plan_limits(user_id: int) -> Dict[str, Any]:
    """Get user's current usage against their plan limits"""
    try:
        client = get_supabase_client()
        entitlements = check_plan_entitlements(user_id)

        # Get usage for today and this month
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Get daily usage
        daily_usage_result = client.table('usage_records').select('tokens_used').eq('user_id', user_id).gte('timestamp',
                                                                                                            today_start.isoformat()).execute()
        daily_tokens = sum(record['tokens_used'] for record in (daily_usage_result.data or []))

        # Get monthly usage
        monthly_usage_result = client.table('usage_records').select('tokens_used').eq('user_id', user_id).gte(
            'timestamp', month_start.isoformat()).execute()
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
            return {'allowed': False,
                    'reason': f"Daily request limit exceeded ({effective_daily_request_limit}) for {environment_tag} environment"}

        if new_monthly_requests > effective_monthly_request_limit:
            return {'allowed': False,
                    'reason': f"Monthly request limit exceeded ({effective_monthly_request_limit}) for {environment_tag} environment"}

        if new_daily_tokens > effective_daily_token_limit:
            return {'allowed': False,
                    'reason': f"Daily token limit exceeded ({effective_daily_token_limit}) for {environment_tag} environment"}

        if new_monthly_tokens > effective_monthly_token_limit:
            return {'allowed': False,
                    'reason': f"Monthly token limit exceeded ({effective_monthly_token_limit}) for {environment_tag} environment"}

        return {'allowed': True, 'reason': 'Within plan limits'}

    except Exception as e:
        logger.error(f"Error enforcing plan limits for user {user_id}: {e}")
        return {'allowed': False, 'reason': 'Error checking plan limits'}


def get_subscription_plans() -> List[Dict[str, Any]]:
    """Get available subscription plans"""
    try:
        client = get_supabase_client()
        result = client.table('subscription_plans').select('*').eq('is_active', True).execute()
        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error getting subscription plans: {e}")
        return []
