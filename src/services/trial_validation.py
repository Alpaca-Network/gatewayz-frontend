#!/usr/bin/.env python3
"""
Simplified Trial Validation
Direct trial validation without complex service layer
"""

import logging
import datetime
from datetime import datetime, timezone
from typing import Dict, Any
from src.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)

def _parse_trial_end_utc(s: str) -> datetime:
    s = s.strip()
    if "T" not in s:
        # Date-only -> use end of that day UTC (friendliest interpretation)
        d = datetime.fromisoformat(s)
        return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)
    # Full datetime
    if s.endswith("Z"):
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(s)
    # Ensure UTC-aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt

def validate_trial_access(api_key: str) -> Dict[str, Any]:
    """Validate trial access for an API key - simplified version"""
    try:
        client = get_supabase_client()
        
        # Get API key data
        result = client.table('api_keys_new').select('*').eq('api_key', api_key).execute()
        
        if not result.data:
            return {
                'is_valid': False,
                'is_trial': False,
                'error': 'API key not found'
            }
        
        key_data = result.data[0]
        
        # Debug logging
        logger.info(f"Trial validation for key: {api_key[:20]}...")
        logger.info(f"Key data: is_trial={key_data.get('is_trial')}, trial_end_date={key_data.get('trial_end_date')}")
        
        # Check if it's a trial key
        if not key_data.get('is_trial', False):
            return {
                'is_valid': True,
                'is_trial': False,
                'message': 'Not a trial key - full access'
            }
        
        # Check if trial is expired
        trial_end_date = key_data.get('trial_end_date')
        trial_end_date = key_data.get('trial_end_date')
        if trial_end_date:
            try:
                trial_end = _parse_trial_end_utc(trial_end_date)
                now = datetime.now(timezone.utc)
                if trial_end <= now:
                    return {
                        'is_valid': False,
                        'is_trial': True,
                        'is_expired': True,
                        'error': 'Trial has expired. Please upgrade to a paid plan to continue using the API.',
                        'trial_end_date': trial_end_date
                    }
            except Exception as e:
                logger.warning(f"Error parsing trial end date '{trial_end_date}': {e}")
                # Keep previous behavior: assume not expired on parse failure
        
        # Check trial limits
        trial_used_tokens = key_data.get('trial_used_tokens', 0)
        trial_used_requests = key_data.get('trial_used_requests', 0)
        trial_used_credits = key_data.get('trial_used_credits', 0.0)
        
        trial_max_tokens = key_data.get('trial_max_tokens', 100000)
        trial_max_requests = key_data.get('trial_max_requests', 1000)
        trial_credits = key_data.get('trial_credits', 10.0)
        
        # Check if any limits are exceeded
        if trial_used_tokens >= trial_max_tokens:
            return {
                'is_valid': False,
                'is_trial': True,
                'is_expired': False,
                'error': 'Trial token limit exceeded. Please upgrade to a paid plan.',
                'remaining_tokens': 0,
                'remaining_requests': max(0, trial_max_requests - trial_used_requests),
                'remaining_credits': max(0, trial_credits - trial_used_credits)
            }
        
        if trial_used_requests >= trial_max_requests:
            return {
                'is_valid': False,
                'is_trial': True,
                'is_expired': False,
                'error': 'Trial request limit exceeded. Please upgrade to a paid plan.',
                'remaining_tokens': max(0, trial_max_tokens - trial_used_tokens),
                'remaining_requests': 0,
                'remaining_credits': max(0, trial_credits - trial_used_credits)
            }
        
        if trial_used_credits >= trial_credits:
            return {
                'is_valid': False,
                'is_trial': True,
                'is_expired': False,
                'error': 'Trial credit limit exceeded. Please upgrade to a paid plan.',
                'remaining_tokens': max(0, trial_max_tokens - trial_used_tokens),
                'remaining_requests': max(0, trial_max_requests - trial_used_requests),
                'remaining_credits': 0
            }
        
        # Trial is valid
        return {
            'is_valid': True,
            'is_trial': True,
            'is_expired': False,
            'remaining_tokens': trial_max_tokens - trial_used_tokens,
            'remaining_requests': trial_max_requests - trial_used_requests,
            'remaining_credits': trial_credits - trial_used_credits,
            'trial_end_date': trial_end_date
        }
        
    except Exception as e:
        logger.error(f"Error validating trial access: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            'is_valid': False,
            'is_trial': False,
            'error': f'Validation error: {str(e)}'
        }

def track_trial_usage(api_key: str, tokens_used: int, requests_used: int = 1) -> bool:
    """Track trial usage - simplified version"""
    try:
        client = get_supabase_client()
        
        # Calculate credit cost (standard pricing: $20 for 1M tokens = $0.00002 per token)
        credit_cost = tokens_used * 0.00002
        
        logger.info(f"Tracking usage: {tokens_used} tokens, {requests_used} requests, ${credit_cost:.6f} credits")
        
        # Get current usage first
        current_result = client.table('api_keys_new').select('trial_used_tokens, trial_used_requests, trial_used_credits').eq('api_key', api_key).execute()
        
        if not current_result.data:
            logger.warning(f"API key not found for usage tracking: {api_key[:20]}...")
            return False
        
        current_data = current_result.data[0]
        old_tokens = current_data.get('trial_used_tokens', 0)
        old_requests = current_data.get('trial_used_requests', 0)
        old_credits = current_data.get('trial_used_credits', 0.0)
        
        new_tokens = old_tokens + tokens_used
        new_requests = old_requests + requests_used
        new_credits = old_credits + credit_cost
        
        logger.info(f"Usage update: tokens {old_tokens} -> {new_tokens}, requests {old_requests} -> {new_requests}, credits {old_credits:.6f} -> {new_credits:.6f}")
        
        # Update trial usage
        result = client.table('api_keys_new').update({
            'trial_used_tokens': new_tokens,
            'trial_used_requests': new_requests,
            'trial_used_credits': new_credits
        }).eq('api_key', api_key).execute()
        
        success = len(result.data) > 0 if result.data else False
        logger.info(f"Usage tracking result: {success}")
        return success
        
    except Exception as e:
        logger.error(f"Error tracking trial usage: {e}")
        return False
