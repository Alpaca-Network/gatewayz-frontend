import logging
import secrets
import string
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone

from src.supabase_config import get_supabase_client
from src.db.credit_transactions import add_credits

logger = logging.getLogger(__name__)

# Constants
REFERRAL_CODE_LENGTH = 8
MAX_REFERRAL_USES = 10  # Each referral code can be used by 10 different users
MIN_PURCHASE_AMOUNT = 10.0  # $10 minimum
REFERRAL_BONUS = 10.0  # $10 bonus for both users


def generate_referral_code() -> str:
    """Generate a unique 8-character referral code"""
    characters = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(characters) for _ in range(REFERRAL_CODE_LENGTH))


def create_user_referral_code(user_id: int) -> str:
    """Create a unique referral code for a user"""
    try:
        client = get_supabase_client()

        # Generate unique code
        max_attempts = 10
        for _ in range(max_attempts):
            code = generate_referral_code()

            # Check if code already exists
            existing = client.table('users').select('id').eq('referral_code', code).execute()

            if not existing.data:
                # Update user with new referral code
                result = client.table('users').update({
                    'referral_code': code
                }).eq('id', user_id).execute()

                if result.data:
                    logger.info(f"Created referral code {code} for user {user_id}")
                    return code

        raise RuntimeError("Failed to generate unique referral code after max attempts")

    except Exception as e:
        logger.error(f"Failed to create referral code: {e}")
        raise


def validate_referral_code(referral_code: str, user_id: int) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validate if a referral code can be used by a user.

    Returns: (is_valid, error_message, referrer_data)
    """
    try:
        client = get_supabase_client()

        # Get the referrer
        referrer_result = client.table('users').select('*').eq('referral_code', referral_code).execute()

        if not referrer_result.data:
            return False, "Invalid referral code", None

        referrer = referrer_result.data[0]

        # Get the user trying to use the code
        user_result = client.table('users').select('*').eq('id', user_id).execute()

        if not user_result.data:
            return False, "User not found", None

        user = user_result.data[0]

        # Check if user is trying to use their own code
        if user.get('referral_code') == referral_code:
            return False, "Cannot use your own referral code", None

        # Check if user has already made a purchase
        if user.get('has_made_first_purchase', False):
            return False, "Referral code can only be used on first purchase", None

        # Check if user already used a referral code
        if user.get('referred_by_code'):
            return False, "You have already used a referral code", None

        # Check how many times this referral code has been used
        usage_count_result = client.table('referrals').select('id', count='exact').eq(
            'referral_code', referral_code
        ).eq('status', 'completed').execute()

        usage_count = usage_count_result.count if usage_count_result.count else 0

        if usage_count >= MAX_REFERRAL_USES:
            return False, f"This referral code has reached its usage limit ({MAX_REFERRAL_USES} uses)", None

        return True, None, referrer

    except Exception as e:
        logger.error(f"Error validating referral code: {e}")
        return False, f"Validation error: {str(e)}", None


def apply_referral_bonus(
    user_id: int,
    referral_code: str,
    purchase_amount: float
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Apply referral bonus to both user and referrer after a qualifying purchase.

    Returns: (success, error_message, bonus_data)
    """
    try:
        client = get_supabase_client()

        # Validate purchase amount
        if purchase_amount < MIN_PURCHASE_AMOUNT:
            return False, f"Referral code requires a minimum purchase of ${MIN_PURCHASE_AMOUNT}", None

        # Validate referral code
        is_valid, error_message, referrer = validate_referral_code(referral_code, user_id)

        if not is_valid:
            return False, error_message, None

        # Get user
        user_result = client.table('users').select('*').eq('id', user_id).execute()
        if not user_result.data:
            return False, "User not found", None

        user = user_result.data[0]

        # Create referral record
        referral_data = {
            'referrer_id': referrer['id'],
            'referred_user_id': user_id,
            'referral_code': referral_code,
            'bonus_amount': REFERRAL_BONUS,
            'status': 'completed',
            'completed_at': datetime.now(timezone.utc).isoformat()
        }

        referral_result = client.table('referrals').insert(referral_data).execute()

        if not referral_result.data:
            return False, "Failed to create referral record", None

        # Add credits to both users using the credit transaction system
        # Add $10 to the new user (refereed)
        add_credits(
            user['api_key'],
            REFERRAL_BONUS,
            f"Referral bonus - using code {referral_code}",
            metadata={
                'referral_code': referral_code,
                'referrer_id': referrer['id'],
                'type': 'referral_bonus_referee'
            }
        )

        # Add $10 to the referrer
        add_credits(
            referrer['api_key'],
            REFERRAL_BONUS,
            f"Referral bonus - user referred by code {referral_code}",
            metadata={
                'referral_code': referral_code,
                'referred_user_id': user_id,
                'type': 'referral_bonus_referrer'
            }
        )

        # Update referred_by_code for the new user
        client.table('users').update({
            'referred_by_code': referral_code
        }).eq('id', user_id).execute()

        # Update balances (for tracking)
        client.table('users').update({
            'balance': (user.get('balance', 0) or 0) + REFERRAL_BONUS
        }).eq('id', user_id).execute()

        client.table('users').update({
            'balance': (referrer.get('balance', 0) or 0) + REFERRAL_BONUS
        }).eq('id', referrer['id']).execute()

        logger.info(
            f"Applied referral bonus: ${REFERRAL_BONUS} to user {user_id} and "
            f"${REFERRAL_BONUS} to referrer {referrer['id']}"
        )

        bonus_data = {
            'user_bonus': REFERRAL_BONUS,
            'referrer_bonus': REFERRAL_BONUS,
            'user_new_balance': (user.get('balance', 0) or 0) + REFERRAL_BONUS,
            'referrer_new_balance': (referrer.get('balance', 0) or 0) + REFERRAL_BONUS,
            'referrer_username': referrer.get('username', 'Unknown'),
            'referrer_email': referrer.get('email', 'Unknown')
        }

        return True, None, bonus_data

    except Exception as e:
        logger.error(f"Error applying referral bonus: {e}", exc_info=True)
        return False, f"Failed to apply referral bonus: {str(e)}", None


def get_referral_stats(user_id: int) -> Optional[Dict[str, Any]]:
    """Get referral statistics for a user"""
    try:
        client = get_supabase_client()

        # Get user
        user_result = client.table('users').select('*').eq('id', user_id).execute()

        if not user_result.data:
            return None

        user = user_result.data[0]
        referral_code = user.get('referral_code')

        # If user doesn't have a referral code, create one
        if not referral_code:
            referral_code = create_user_referral_code(user_id)
            user['referral_code'] = referral_code

        # Get successful referrals
        referrals_result = client.table('referrals').select('*').eq(
            'referrer_id', user_id
        ).eq('status', 'completed').execute()

        referrals = referrals_result.data if referrals_result.data else []

        total_uses = len(referrals)
        remaining_uses = max(0, MAX_REFERRAL_USES - total_uses)
        total_earned = sum(r.get('bonus_amount', 0) for r in referrals)

        # Get details of referred users
        referral_details = []
        for ref in referrals:
            ref_user_result = client.table('users').select('username', 'email').eq(
                'id', ref['referred_user_id']
            ).execute()

            ref_user = ref_user_result.data[0] if ref_user_result.data else {}

            referral_details.append({
                'user_id': ref['referred_user_id'],
                'username': ref_user.get('username', 'Unknown'),
                'used_at': ref.get('completed_at', ref.get('created_at')),
                'bonus_earned': ref.get('bonus_amount', 0)
            })

        return {
            'referral_code': referral_code,
            'total_uses': total_uses,
            'remaining_uses': remaining_uses,
            'max_uses': MAX_REFERRAL_USES,
            'total_earned': float(total_earned),
            'current_balance': float(user.get('balance', 0) or 0),
            'referred_by_code': user.get('referred_by_code'),
            'referrals': referral_details
        }

    except Exception as e:
        logger.error(f"Error getting referral stats: {e}")
        return None


def mark_first_purchase(user_id: int) -> bool:
    """Mark that a user has made their first purchase"""
    try:
        client = get_supabase_client()

        result = client.table('users').update({
            'has_made_first_purchase': True
        }).eq('id', user_id).execute()

        if result.data:
            logger.info(f"Marked first purchase for user {user_id}")
            return True

        return False

    except Exception as e:
        logger.error(f"Error marking first purchase: {e}")
        return False