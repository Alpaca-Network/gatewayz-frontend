#!/usr/bin/env python3
"""
Enhanced Database Functions with Advanced Security
Implements secure key storage, audit logging, and advanced security features.
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from src.supabase_config import get_supabase_client
from src.security.security import get_security_manager, get_audit_logger, generate_secure_api_key, hash_api_key, \
    validate_ip_allowlist, validate_domain_referrers

logger = logging.getLogger(__name__)

def create_secure_api_key(user_id: int, key_name: str, environment_tag: str = 'live', 
                         scope_permissions: Optional[Dict[str, Any]] = None, 
                         expiration_days: Optional[int] = None, max_requests: Optional[int] = None, 
                         ip_allowlist: Optional[List[str]] = None, domain_referrers: Optional[List[str]] = None, 
                         is_primary: bool = False) -> str:
    """Create a new API key with enhanced security features"""
    try:
        client = get_supabase_client()
        security_manager = get_security_manager()
        audit_logger = get_audit_logger()
        
        # Check for name uniqueness within user scope
        if not check_key_name_uniqueness(user_id, key_name):
            raise ValueError(f"Key name '{key_name}' already exists for this user. Please choose a different name.")
        
        # Generate secure API key
        api_key = generate_secure_api_key(environment_tag)
        
        # Create hash for secure storage
        key_hash = hash_api_key(api_key)
        
        # Encrypt the API key for storage
        encrypted_key = security_manager.encrypt_api_key(api_key)
        
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
        
        # Create the API key record with enhanced security fields
        result = client.table('api_keys_new').insert({
            'user_id': user_id,
            'key_name': key_name,
            'api_key': encrypted_key,  # Store encrypted version
            'key_hash': key_hash,      # Store hash for validation
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
            'last_used_at': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }).execute()
        
        if not result.data:
            raise ValueError("Failed to create API key")
        
        key_id = result.data[0]['id']
        
        # Log the creation
        audit_logger.log_api_key_creation(user_id, key_id, key_name, environment_tag, "user")
        
        # Create rate limit configuration
        try:
            rate_limit_config = {
                'api_key_id': key_id,
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
            logger.warning(f"Failed to create rate limit config for API key {key_id}: {rate_limit_error}")
        
        # Create audit log entry
        try:
            client.table('api_key_audit_logs').insert({
                'user_id': user_id,
                'action': 'create',
                'api_key_id': key_id,
                'details': {
                    'key_name': key_name,
                    'environment_tag': environment_tag,
                    'scope_permissions': scope_permissions,
                    'expiration_days': expiration_days,
                    'max_requests': max_requests,
                    'is_primary': is_primary,
                    'ip_allowlist': ip_allowlist,
                    'domain_referrers': domain_referrers
                },
                'timestamp': datetime.utcnow().isoformat()
            }).execute()
        except Exception as audit_error:
            logger.warning(f"Failed to create audit log for API key {key_id}: {audit_error}")
        
        return api_key  # Return the plain text key to user
        
    except Exception as e:
        logger.error(f"Failed to create secure API key: {e}")
        raise RuntimeError(f"Failed to create secure API key: {e}")

def validate_secure_api_key(api_key: str, client_ip: str = None, referer: str = None, user_agent: str = None) -> Optional[Dict[str, Any]]:
    """Validate an API key with enhanced security checks"""
    try:
        client = get_supabase_client()
        security_manager = get_security_manager()
        audit_logger = get_audit_logger()
        
        # Get all API keys and validate against hashes
        result = client.table('api_keys_new').select('*').execute()
        
        if not result.data:
            return None
        
        # Find matching key by comparing hashes
        for key_data in result.data:
            try:
                stored_key = None
                
                # Try to decrypt first (for new encrypted keys)
                try:
                    stored_key = security_manager.decrypt_api_key(key_data['api_key'])
                except Exception as decrypt_error:
                    # If decryption fails, check if it's a plain text key
                    if key_data['api_key'].startswith(('gw_live_', 'gw_test_', 'gw_staging_', 'gw_dev_')):
                        # This is a plain text key, use it directly
                        stored_key = key_data['api_key']
                    else:
                        # Not a valid key format, skip
                        continue
                
                # Compare with provided key
                if stored_key == api_key:
                    # Found matching key, now validate
                    key_id = key_data['id']
                    user_id = key_data['user_id']
                    
                    # Check if key is active
                    if not key_data.get('is_active', True):
                        audit_logger.log_security_violation("INACTIVE_KEY", user_id, key_id, f"Key {key_id} is inactive", client_ip)
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
                                    audit_logger.log_security_violation("EXPIRED_KEY", user_id, key_id, f"Key {key_id} has expired", client_ip)
                                    return None
                        except Exception as date_error:
                            logger.warning(f"Error checking expiration for key {key_id}: {date_error}")
                    
                    # Check request limits
                    if key_data.get('max_requests'):
                        if key_data.get('requests_used', 0) >= key_data['max_requests']:
                            audit_logger.log_security_violation("REQUEST_LIMIT_EXCEEDED", user_id, key_id, f"Key {key_id} request limit reached", client_ip)
                            return None
                    
                    # Validate IP allowlist
                    if client_ip and key_data.get('ip_allowlist'):
                        if not validate_ip_allowlist(client_ip, key_data['ip_allowlist']):
                            audit_logger.log_security_violation("IP_NOT_ALLOWED", user_id, key_id, f"IP {client_ip} not in allowlist", client_ip)
                            return None
                    
                    # Validate domain referrers
                    if referer and key_data.get('domain_referrers'):
                        if not validate_domain_referrers(referer, key_data['domain_referrers']):
                            audit_logger.log_security_violation("DOMAIN_NOT_ALLOWED", user_id, key_id, f"Referer {referer} not in allowlist", client_ip)
                            return None
                    
                    # Update last used timestamp
                    try:
                        client.table('api_keys_new').update({
                            'last_used_at': datetime.utcnow().isoformat(),
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', key_id).execute()
                    except Exception as update_error:
                        logger.warning(f"Failed to update last_used_at for key {key_id}: {update_error}")
                    
                    # Log successful usage
                    audit_logger.log_api_key_usage(user_id, key_id, "api_request", client_ip or "unknown", user_agent)
                    
                    return {
                        'user_id': user_id,
                        'api_key': api_key,
                        'key_id': key_id,
                        'key_name': key_data['key_name'],
                        'is_active': key_data['is_active'],
                        'expiration_date': key_data['expiration_date'],
                        'max_requests': key_data['max_requests'],
                        'requests_used': key_data.get('requests_used', 0),
                        'environment_tag': key_data.get('environment_tag', 'live'),
                        'scope_permissions': key_data.get('scope_permissions', {}),
                        'ip_allowlist': key_data.get('ip_allowlist', []),
                        'domain_referrers': key_data.get('domain_referrers', [])
                    }
                    
            except Exception as decrypt_error:
                logger.warning(f"Error decrypting key {key_data.get('id', 'unknown')}: {decrypt_error}")
                continue
        
        # Key not found or validation failed
        audit_logger.log_security_violation("INVALID_KEY", None, None, f"Invalid API key provided", client_ip)
        return None
        
    except Exception as e:
        logger.error(f"Failed to validate secure API key: {e}")
        return None

def rotate_api_key(key_id: int, user_id: int, new_key_name: str = None) -> Optional[str]:
    """Rotate an existing API key with a new one"""
    try:
        client = get_supabase_client()
        security_manager = get_security_manager()
        audit_logger = get_audit_logger()
        
        # Get current key data
        current_key = client.table('api_keys_new').select('*').eq('id', key_id).eq('user_id', user_id).execute()
        
        if not current_key.data:
            raise ValueError("API key not found or not owned by user")
        
        key_data = current_key.data[0]
        old_key_name = key_data['key_name']
        
        # Generate new API key
        new_api_key = generate_secure_api_key(
            key_data.get('environment_tag', 'live')
        )
        
        # Create hash and encrypt new key
        new_key_hash = hash_api_key(new_api_key)
        new_encrypted_key = security_manager.encrypt_api_key(new_api_key)
        
        # Update the key record
        update_data = {
            'api_key': new_encrypted_key,
            'key_hash': new_key_hash,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        if new_key_name:
            update_data['key_name'] = new_key_name
        
        result = client.table('api_keys_new').update(update_data).eq('id', key_id).execute()
        
        if not result.data:
            raise ValueError("Failed to rotate API key")
        
        # Log the rotation
        audit_logger.log_api_key_creation(user_id, key_id, new_key_name or old_key_name, key_data.get('environment_tag', 'live'), "rotation")
        
        # Create audit log entry
        try:
            client.table('api_key_audit_logs').insert({
                'user_id': user_id,
                'action': 'rotate',
                'api_key_id': key_id,
                'details': {
                    'old_key_name': old_key_name,
                    'new_key_name': new_key_name or old_key_name,
                    'rotated_at': datetime.utcnow().isoformat()
                },
                'timestamp': datetime.utcnow().isoformat()
            }).execute()
        except Exception as audit_error:
            logger.warning(f"Failed to create audit log for key rotation: {audit_error}")
        
        return new_api_key
        
    except Exception as e:
        logger.error(f"Failed to rotate API key: {e}")
        raise RuntimeError(f"Failed to rotate API key: {e}")

def get_audit_logs(user_id: int = None, key_id: int = None, action: str = None, 
                  start_date: datetime = None, end_date: datetime = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Get audit logs with filtering options"""
    try:
        client = get_supabase_client()
        
        query = client.table('api_key_audit_logs').select('*')
        
        if user_id:
            query = query.eq('user_id', user_id)
        if key_id:
            query = query.eq('api_key_id', key_id)
        if action:
            query = query.eq('action', action)
        if start_date:
            query = query.gte('timestamp', start_date.isoformat())
        if end_date:
            query = query.lte('timestamp', end_date.isoformat())
        
        result = query.order('timestamp', desc=True).limit(limit).execute()
        
        return result.data or []
        
    except Exception as e:
        logger.error(f"Failed to get audit logs: {e}")
        return []

def bulk_rotate_user_keys(user_id: int, environment_tag: str = None) -> Dict[str, Any]:
    """Bulk rotate all API keys for a user"""
    try:
        client = get_supabase_client()
        audit_logger = get_audit_logger()
        
        # Get user's keys
        query = client.table('api_keys_new').select('*').eq('user_id', user_id).eq('is_active', True)
        if environment_tag:
            query = query.eq('environment_tag', environment_tag)
        
        result = query.execute()
        
        if not result.data:
            return {'rotated_count': 0, 'new_keys': []}
        
        rotated_keys = []
        for key_data in result.data:
            try:
                new_key = rotate_api_key(key_data['id'], user_id)
                rotated_keys.append({
                    'key_id': key_data['id'],
                    'key_name': key_data['key_name'],
                    'new_api_key': new_key
                })
            except Exception as key_error:
                logger.error(f"Failed to rotate key {key_data['id']}: {key_error}")
                continue
        
        # Log bulk rotation
        audit_logger.log_api_key_creation(user_id, 0, f"Bulk rotation ({len(rotated_keys)} keys)", environment_tag or "all", "admin")
        
        return {
            'rotated_count': len(rotated_keys),
            'new_keys': rotated_keys
        }
        
    except Exception as e:
        logger.error(f"Failed to bulk rotate user keys: {e}")
        raise RuntimeError(f"Failed to bulk rotate user keys: {e}")

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
