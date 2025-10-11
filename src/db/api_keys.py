import logging
import datetime
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone

from src.db.plans import check_plan_entitlements
from src.supabase_config import get_supabase_client
import secrets

logger = logging.getLogger(__name__)

# near the top of the module
def _pct(used: int, limit: Optional[int]) -> Optional[float]:
    if not limit:
        return None
    return round(min(100.0, (used / float(limit)) * 100.0), 6)


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


def create_api_key(user_id: int, key_name: str, environment_tag: str = 'live',
                   scope_permissions: Optional[Dict[str, Any]] = None, expiration_days: Optional[int] = None,
                   max_requests: Optional[int] = None, ip_allowlist: Optional[List[str]] = None,
                   domain_referrers: Optional[List[str]] = None, is_primary: bool = False) -> str:
    """Create a new API key for a user"""
    try:
        client = get_supabase_client()

        # Check for name uniqueness within user scope
        if not check_key_name_uniqueness(user_id, key_name):
            raise ValueError(f"Key name '{key_name}' already exists for this user. Please choose a different name.")

        # Enforce plan limits on key creation
        entitlements = check_plan_entitlements(user_id)
        if max_requests and max_requests > entitlements['monthly_request_limit']:
            logger.warning(
                f"User {user_id} attempted to create key with max_requests {max_requests} exceeding plan limit {entitlements['monthly_request_limit']}")
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
            expiration_date = (datetime.now(timezone.utc) + timedelta(days=expiration_days)).isoformat()

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
            trial_start = datetime.now(timezone.utc)
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
            'last_used_at': datetime.now(timezone.utc).isoformat()
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
                'timestamp': datetime.now(timezone.utc).isoformat()
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
        result = client.table('api_keys_new').select('*').eq('user_id', user_id).order('created_at',
                                                                                       desc=True).execute()

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
                            now = datetime.now(timezone.utc).replace(tzinfo=expiration.tzinfo)
                            days_remaining = max(0, (expiration - now).days)
                    except Exception as date_error:
                        logger.warning(
                            f"Error calculating days remaining for key {key.get('id', 'unknown')}: {date_error}")
                        days_remaining = None

                # Calculate requests remaining
                requests_remaining = None
                if key.get('max_requests'):
                    requests_remaining = max(0, key['max_requests'] - key['requests_used'])

                # Calculate usage percentage (rounded)
                usage_percentage = None
                if key.get('max_requests') and key.get('requests_used'):
                    usage_percentage = _pct(key.get('requests_used', 0), key['max_requests'])

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
                            'deleted_at': datetime.now(timezone.utc).isoformat(),
                            'key_name': result.data[0].get('key_name', 'Unknown'),
                            'environment_tag': result.data[0].get('environment_tag', 'unknown')
                        },
                        'timestamp': datetime.now(timezone.utc).isoformat()
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
    # Lazy import to avoid circular dependency
    from src.db.users import get_user

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
                            now = datetime.now(timezone.utc).replace(tzinfo=expiration.tzinfo)

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
                        'max_requests': None,  # No request limit for legacy keys
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
    # Lazy import to avoid circular dependency
    from src.db.users import get_user

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
                    'last_used_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
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
                    'updated_at': datetime.now(timezone.utc).isoformat()
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
            requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_used', 0))
            usage_percentage = _pct(key_data.get('requests_used', 0), key_data['max_requests'])

            if key_data.get('max_requests'):
                requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_used', 0))
                usage_percentage = _pct(key_data.get('requests_used', 0), key_data['max_requests'])

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
            requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_used', 0))
            usage_percentage = _pct(key_data.get('requests_used', 0), key_data['max_requests'])

            if key_data.get('max_requests'):
                requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_count', 0))
                usage_percentage = _pct(key_data.get('requests_count', 0), key_data['max_requests'])

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
                raise ValueError(
                    f"Key name '{update_data['key_name']}' already exists for this user. Please choose a different name.")

        # Special handling for expiration_days
        if 'expiration_days' in update_data:
            if update_data['expiration_days'] is not None:
                update_data['expiration_date'] = (
                            datetime.now(timezone.utc) + timedelta(days=update_data['expiration_days'])).isoformat()
            else:
                update_data['expiration_date'] = None
            # Remove the days field as we store the actual date
            del update_data['expiration_days']

        # Add timestamp
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()

        # Update the API key
        result = client.table('api_keys_new').update(update_data).eq('id', key_id).execute()

        if not result.data:
            raise ValueError("Failed to update API key")

        # Update rate limit config if max_requests changed
        if 'max_requests' in updates and updates['max_requests'] is not None:
            try:
                client.table('rate_limit_configs').update({
                    'max_requests': updates['max_requests'],
                    'updated_at': datetime.now(timezone.utc).isoformat()
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
                    'update_timestamp': datetime.now(timezone.utc).isoformat()
                },
                'timestamp': datetime.now(timezone.utc).isoformat()
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
        logger.info(f"Validating permissions for API key {api_key[:15]}... - Required: {required_permission} on {resource}")

        # Temporary session keys (gw_temp_*) have full permissions
        if api_key.startswith('gw_temp_'):
            logger.info(f"Granting full permissions to session key: {api_key[:15]}...")
            return True

        client = get_supabase_client()

        # Get the API key record with is_primary flag
        key_result = client.table('api_keys_new').select('scope_permissions, is_active, is_primary').eq('api_key',
                                                                                            api_key).execute()

        if not key_result.data:
            # Fallback to legacy key check
            logger.info(f"API key {api_key[:15]}... not found in api_keys_new, checking legacy table")
            legacy_result = client.table('api_keys').select('scope_permissions, is_active').eq('api_key',
                                                                                               api_key).execute()
            if not legacy_result.data:
                logger.warning(f"API key not found in any table: {api_key[:10]}...")
                return False
            key_data = legacy_result.data[0]
            logger.info(f"Found in legacy table - is_active: {key_data.get('is_active')}, has is_primary: False (legacy)")
        else:
            key_data = key_result.data[0]
            logger.info(f"Found in api_keys_new - is_active: {key_data.get('is_active')}, is_primary: {key_data.get('is_primary', False)}")

        # Check if key is active
        if not key_data.get('is_active', True):
            logger.warning(f"API key is inactive: {api_key[:10]}...")
            return False

        # Primary keys (auto-generated for new users) have full permissions
        if key_data.get('is_primary', False):
            logger.info(f"Granting full permissions to primary key: {api_key[:15]}...")
            return True
        else:
            logger.info(f"Not a primary key, checking scope_permissions: {key_data.get('scope_permissions', {})}")

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
                    now = datetime.now(timezone.utc).replace(tzinfo=expiration.tzinfo)
                    days_remaining = max(0, (expiration - now).days)
            except Exception as date_error:
                logger.warning(f"Error calculating days remaining for key {key_id}: {date_error}")
                days_remaining = None

        # Calculate requests remaining
        requests_remaining = None
        if key_data.get('max_requests'):
            requests_remaining = max(0, key_data['max_requests'] - key_data.get('requests_used', 0))

        # Calculate usage percentage (rounded)
        usage_percentage = None
        if key_data.get('max_requests') and key_data.get('requests_used'):
            usage_percentage = _pct(key_data.get('requests_used', 0), key_data['max_requests'])

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
                usage_percentage = _pct(key_data.get('requests_used', 0), key_data['max_requests'])

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
