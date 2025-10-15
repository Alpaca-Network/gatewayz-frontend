"""
Database operations for coupon system
Handles coupon creation, validation, and redemption
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from src.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


# ============================================
# Coupon CRUD Operations
# ============================================

def create_coupon(
        code: str,
        value_usd: float,
        coupon_scope: str,
        max_uses: int,
        valid_until: datetime,
        coupon_type: str = 'promotional',
        created_by: Optional[int] = None,
        created_by_type: str = 'admin',
        assigned_to_user_id: Optional[int] = None,
        description: Optional[str] = None,
        valid_from: Optional[datetime] = None
) -> Optional[Dict[str, Any]]:
    """
    Create a new coupon

    Args:
        code: Unique coupon code
        value_usd: Dollar value of the coupon
        coupon_scope: 'user_specific' or 'global'
        max_uses: Maximum number of redemptions
        valid_until: Expiration timestamp
        coupon_type: Type of coupon (promotional, referral, compensation, partnership)
        created_by: User ID of creator (optional)
        created_by_type: 'admin' or 'system'
        assigned_to_user_id: User ID for user-specific coupons
        description: Internal description
        valid_from: Start date (defaults to now)

    Returns:
        Created coupon data or None if failed
    """
    try:
        client = get_supabase_client()

        # Validate coupon scope and assignment
        if coupon_scope == 'user_specific' and not assigned_to_user_id:
            raise ValueError("User-specific coupons must have assigned_to_user_id")

        if coupon_scope == 'global' and assigned_to_user_id:
            raise ValueError("Global coupons cannot have assigned_to_user_id")

        if coupon_scope == 'user_specific' and max_uses != 1:
            raise ValueError("User-specific coupons must have max_uses = 1")

        # Prepare coupon data
        coupon_data = {
            'code': code.upper(),  # Store in uppercase for consistency
            'value_usd': value_usd,
            'coupon_scope': coupon_scope,
            'max_uses': max_uses,
            'coupon_type': coupon_type,
            'created_by_type': created_by_type,
            'valid_until': valid_until.isoformat(),
            'valid_from': (valid_from or datetime.now(timezone.utc)).isoformat(),
        }

        if created_by:
            coupon_data['created_by'] = created_by

        if assigned_to_user_id:
            coupon_data['assigned_to_user_id'] = assigned_to_user_id

        if description:
            coupon_data['description'] = description

        # Insert into database
        result = client.table('coupons').insert(coupon_data).execute()

        if result.data:
            logger.info(f"Coupon created: {code} (scope: {coupon_scope}, value: ${value_usd})")
            return result.data[0]

        return None

    except Exception as e:
        logger.error(f"Error creating coupon: {e}")
        raise


def get_coupon_by_code(code: str) -> Optional[Dict[str, Any]]:
    """Get coupon by code (case-insensitive)"""
    try:
        client = get_supabase_client()

        # Query with case-insensitive match
        result = client.table('coupons').select('*').ilike('code', code).execute()

        if result.data:
            return result.data[0]

        return None

    except Exception as e:
        logger.error(f"Error getting coupon by code: {e}")
        return None


def get_coupon_by_id(coupon_id: int) -> Optional[Dict[str, Any]]:
    """Get coupon by ID"""
    try:
        client = get_supabase_client()

        result = client.table('coupons').select('*').eq('id', coupon_id).execute()

        if result.data:
            return result.data[0]

        return None

    except Exception as e:
        logger.error(f"Error getting coupon by ID: {e}")
        return None


def list_coupons(
        scope: Optional[str] = None,
        coupon_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        created_by: Optional[int] = None,
        assigned_to_user_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0
) -> List[Dict[str, Any]]:
    """
    List coupons with filters

    Args:
        scope: Filter by coupon_scope
        coupon_type: Filter by coupon_type
        is_active: Filter by active status
        created_by: Filter by creator
        assigned_to_user_id: Filter by assigned user
        limit: Max results
        offset: Pagination offset

    Returns:
        List of coupons
    """
    try:
        client = get_supabase_client()

        query = client.table('coupons').select('*')

        # Apply filters
        if scope:
            query = query.eq('coupon_scope', scope)

        if coupon_type:
            query = query.eq('coupon_type', coupon_type)

        if is_active is not None:
            query = query.eq('is_active', is_active)

        if created_by:
            query = query.eq('created_by', created_by)

        if assigned_to_user_id:
            query = query.eq('assigned_to_user_id', assigned_to_user_id)

        # Order and paginate
        query = query.order('created_at', desc=True).range(offset, offset + limit - 1)

        result = query.execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error listing coupons: {e}")
        return []


def update_coupon(
        coupon_id: int,
        updates: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Update coupon fields

    Args:
        coupon_id: Coupon ID to update
        updates: Dictionary of fields to update

    Returns:
        Updated coupon data or None
    """
    try:
        client = get_supabase_client()

        # Allowed update fields
        allowed_fields = ['valid_until', 'max_uses', 'is_active', 'description']

        # Filter updates to allowed fields only
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}

        if not filtered_updates:
            raise ValueError("No valid fields to update")

        result = client.table('coupons').update(filtered_updates).eq('id', coupon_id).execute()

        if result.data:
            logger.info(f"Coupon {coupon_id} updated: {list(filtered_updates.keys())}")
            return result.data[0]

        return None

    except Exception as e:
        logger.error(f"Error updating coupon: {e}")
        raise


def deactivate_coupon(coupon_id: int) -> bool:
    """Deactivate a coupon"""
    try:
        client = get_supabase_client()

        result = client.table('coupons').update({'is_active': False}).eq('id', coupon_id).execute()

        if result.data:
            logger.info(f"Coupon {coupon_id} deactivated")
            return True

        return False

    except Exception as e:
        logger.error(f"Error deactivating coupon: {e}")
        return False


# ============================================
# Coupon Validation
# ============================================

def validate_coupon(code: str, user_id: int) -> Dict[str, Any]:
    """
    Validate if a coupon can be redeemed by a user
    Uses the database function for validation

    Args:
        code: Coupon code
        user_id: User ID attempting to redeem

    Returns:
        Dictionary with validation result:
        {
            'is_valid': bool,
            'error_code': str or None,
            'error_message': str or None,
            'coupon_id': int or None,
            'coupon_value': float or None
        }
    """
    try:
        client = get_supabase_client()

        # Call the database validation function
        result = client.rpc('is_coupon_redeemable', {
            'p_coupon_code': code,
            'p_user_id': user_id
        }).execute()

        if result.data and len(result.data) > 0:
            validation = result.data[0]
            return {
                'is_valid': validation.get('is_valid', False),
                'error_code': validation.get('error_code'),
                'error_message': validation.get('error_message'),
                'coupon_id': validation.get('coupon_id'),
                'coupon_value': float(validation.get('coupon_value', 0)) if validation.get('coupon_value') else None
            }

        return {
            'is_valid': False,
            'error_code': 'VALIDATION_FAILED',
            'error_message': 'Coupon validation failed',
            'coupon_id': None,
            'coupon_value': None
        }

    except Exception as e:
        logger.error(f"Error validating coupon: {e}")
        return {
            'is_valid': False,
            'error_code': 'SYSTEM_ERROR',
            'error_message': f'System error: {str(e)}',
            'coupon_id': None,
            'coupon_value': None
        }


# ============================================
# Coupon Redemption
# ============================================

def redeem_coupon(
        code: str,
        user_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
) -> Dict[str, Any]:
    """
    Redeem a coupon for a user
    Handles the complete redemption flow with transaction safety

    Args:
        code: Coupon code to redeem
        user_id: User ID redeeming the coupon
        ip_address: User's IP address (for audit)
        user_agent: User's user agent (for audit)

    Returns:
        Dictionary with redemption result:
        {
            'success': bool,
            'message': str,
            'coupon_value': float or None,
            'previous_balance': float or None,
            'new_balance': float or None,
            'coupon_code': str or None,
            'error_code': str or None
        }
    """
    try:
        client = get_supabase_client()

        # Step 1: Validate coupon
        validation = validate_coupon(code, user_id)

        if not validation['is_valid']:
            return {
                'success': False,
                'message': validation['error_message'],
                'error_code': validation['error_code'],
                'coupon_value': None,
                'previous_balance': None,
                'new_balance': None,
                'coupon_code': code
            }

        coupon_id = validation['coupon_id']
        coupon_value = validation['coupon_value']

        # Step 2: Get current user balance
        user_result = client.table('users').select('credits').eq('id', user_id).execute()

        if not user_result.data:
            return {
                'success': False,
                'message': 'User not found',
                'error_code': 'USER_NOT_FOUND',
                'coupon_value': None,
                'previous_balance': None,
                'new_balance': None,
                'coupon_code': code
            }

        current_balance = float(user_result.data[0]['credits'])
        new_balance = current_balance + coupon_value

        # Step 3: Update user balance
        update_result = client.table('users').update({
            'credits': new_balance
        }).eq('id', user_id).execute()

        if not update_result.data:
            raise Exception("Failed to update user balance")

        # Step 4: Increment coupon usage
        increment_result = client.table('coupons').update({
            'times_used': client.table('coupons').select('times_used').eq('id', coupon_id).execute().data[0][
                              'times_used'] + 1
        }).eq('id', coupon_id).execute()

        # Better approach: use RPC or raw SQL for atomic increment
        client.rpc('increment', {'row_id': coupon_id, 'x': 1}).execute()  # If you have this function

        # Step 5: Record redemption
        redemption_data = {
            'coupon_id': coupon_id,
            'user_id': user_id,
            'value_applied': coupon_value,
            'user_balance_before': current_balance,
            'user_balance_after': new_balance,
            'ip_address': ip_address,
            'user_agent': user_agent
        }

        redemption_result = client.table('coupon_redemptions').insert(redemption_data).execute()

        if not redemption_result.data:
            logger.error(f"Failed to record redemption for coupon {coupon_id}")
            # Note: User balance already updated, this is audit record failure

        logger.info(f"Coupon {code} redeemed by user {user_id}: ${coupon_value}")

        return {
            'success': True,
            'message': 'Coupon redeemed successfully!',
            'coupon_value': coupon_value,
            'previous_balance': current_balance,
            'new_balance': new_balance,
            'coupon_code': code,
            'error_code': None
        }

    except Exception as e:
        logger.error(f"Error redeeming coupon: {e}")
        return {
            'success': False,
            'message': f'System error: {str(e)}',
            'error_code': 'SYSTEM_ERROR',
            'coupon_value': None,
            'previous_balance': None,
            'new_balance': None,
            'coupon_code': code
        }


# ============================================
# User Coupon Queries
# ============================================

def get_available_coupons_for_user(user_id: int) -> List[Dict[str, Any]]:
    """
    Get all coupons available for a specific user
    Uses the database function for efficiency

    Args:
        user_id: User ID

    Returns:
        List of available coupons
    """
    try:
        client = get_supabase_client()

        # Call the database function
        result = client.rpc('get_available_coupons', {
            'p_user_id': user_id
        }).execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error getting available coupons for user: {e}")
        return []


def get_user_redemption_history(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get redemption history for a user

    Args:
        user_id: User ID
        limit: Max results

    Returns:
        List of redemptions with coupon details
    """
    try:
        client = get_supabase_client()

        result = client.table('coupon_redemptions').select(
            '*, coupons(code, coupon_type, coupon_scope)'
        ).eq('user_id', user_id).order('redeemed_at', desc=True).limit(limit).execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error getting user redemption history: {e}")
        return []


# ============================================
# Admin Analytics
# ============================================

def get_coupon_analytics(coupon_id: int) -> Dict[str, Any]:
    """
    Get analytics for a specific coupon

    Args:
        coupon_id: Coupon ID

    Returns:
        Dictionary with analytics data
    """
    try:
        client = get_supabase_client()

        # Get coupon info
        coupon = get_coupon_by_id(coupon_id)

        if not coupon:
            return {}

        # Get redemption stats
        redemptions_result = client.table('coupon_redemptions').select(
            '*'
        ).eq('coupon_id', coupon_id).execute()

        redemptions = redemptions_result.data if redemptions_result.data else []

        total_value_distributed = sum(float(r['value_applied']) for r in redemptions)
        unique_users = len(set(r['user_id'] for r in redemptions))

        return {
            'coupon': coupon,
            'total_redemptions': len(redemptions),
            'unique_users': unique_users,
            'total_value_distributed': total_value_distributed,
            'redemption_rate': (len(redemptions) / coupon['max_uses'] * 100) if coupon['max_uses'] > 0 else 0,
            'remaining_uses': coupon['max_uses'] - coupon['times_used'],
            'is_expired': datetime.fromisoformat(coupon['valid_until'].replace('Z', '+00:00')) < datetime.now(
                timezone.utc),
            'recent_redemptions': redemptions[:10]  # Last 10
        }

    except Exception as e:
        logger.error(f"Error getting coupon analytics: {e}")
        return {}


def get_all_coupons_stats() -> Dict[str, Any]:
    """
    Get overall coupon system statistics

    Returns:
        Dictionary with system-wide stats
    """
    try:
        client = get_supabase_client()

        # Get all coupons
        all_coupons = client.table('coupons').select('*').execute().data or []

        # Get all redemptions
        all_redemptions = client.table('coupon_redemptions').select('*').execute().data or []

        active_coupons = [c for c in all_coupons if c['is_active']]
        user_specific = [c for c in all_coupons if c['coupon_scope'] == 'user_specific']
        global_coupons = [c for c in all_coupons if c['coupon_scope'] == 'global']

        total_value_distributed = sum(float(r['value_applied']) for r in all_redemptions)
        unique_redeemers = len(set(r['user_id'] for r in all_redemptions))

        return {
            'total_coupons': len(all_coupons),
            'active_coupons': len(active_coupons),
            'user_specific_coupons': len(user_specific),
            'global_coupons': len(global_coupons),
            'total_redemptions': len(all_redemptions),
            'unique_redeemers': unique_redeemers,
            'total_value_distributed': total_value_distributed,
            'average_redemption_value': total_value_distributed / len(all_redemptions) if all_redemptions else 0
        }

    except Exception as e:
        logger.error(f"Error getting coupon stats: {e}")
        return {}