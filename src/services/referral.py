import logging
import secrets
import string
from datetime import datetime, timezone
from typing import Any

from src.config.supabase_config import get_supabase_client
from src.db.credit_transactions import add_credits

logger = logging.getLogger(__name__)


def send_referral_signup_notification(
    referrer_id: int, referrer_email: str, referrer_username: str, referee_username: str
) -> bool:
    """Send email notification to referrer when someone signs up with their code"""
    try:
        from src.enhanced_notification_service import enhanced_notification_service

        subject = "Someone used your referral code! - AI Gateway"

        content = f"""
            <h2>🎉 Great News!</h2>
            <p>Hi <strong>{referrer_username}</strong>,</p>
            <p><strong>{referee_username}</strong> just signed up using your referral code!</p>

            <div class="highlight-box" style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
                <h3 style="margin-bottom: 12px; color: #1e40af;">What's Next?</h3>
                <p style="margin-bottom: 8px;">When <strong>{referee_username}</strong> makes their first purchase of $10 or more, you'll both receive:</p>
                <ul style="margin-left: 20px;">
                    <li><strong>$10 in credits</strong> added to your account</li>
                    <li>Email notification confirming the bonus</li>
                </ul>
            </div>

            <p>Keep sharing your referral code to earn more credits!</p>
        """

        from src.services.professional_email_templates import email_templates

        html_content = email_templates.get_base_template().format(
            subject="New Referral Signup!",
            header_subtitle="Someone used your code",
            content=content,
            app_name="AI Gateway",
            app_url="https://gatewayz.ai",
            support_email="noreply@gatewayz.ai",
            email=referrer_email,
        )

        text_content = f"""New Referral Signup - AI Gateway

Hi {referrer_username},

{referee_username} just signed up using your referral code!

What's Next?
When {referee_username} makes their first purchase of $10 or more, you'll both receive $10 in credits and an email notification.

Keep sharing your referral code to earn more credits!

Best regards,
The AI Gateway Team
"""

        success = enhanced_notification_service.send_email_notification(
            to_email=referrer_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )

        if success:
            logger.info(f"Sent referral signup notification to user {referrer_id}")

        return success

    except Exception as e:
        logger.error(f"Error sending referral signup notification: {e}")
        return False


def send_referral_bonus_notification(
    referrer_id: int,
    referrer_email: str,
    referrer_username: str,
    referrer_new_balance: float,
    referee_username: str,
    referee_email: str,
    referee_new_balance: float,
) -> tuple[bool, bool]:
    """
    Send email notifications to both referrer and referee when bonus is applied.

    Returns: (referrer_success, referee_success)
    """
    try:
        from src.enhanced_notification_service import enhanced_notification_service

        # Send notification to referrer
        referrer_subject = "You earned $10 from your referral! - AI Gateway"

        referrer_content = f"""
            <h2>💰 Congratulations!</h2>
            <p>Hi <strong>{referrer_username}</strong>,</p>
            <p>Great news! <strong>{referee_username}</strong> just made their first purchase, and you've earned your referral bonus!</p>

            <div class="success-box" style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0;">
                <h3 style="margin-bottom: 12px; color: #15803d;">Referral Bonus Applied</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="label">Bonus Amount</div>
                        <div class="value" style="font-size: 24px; color: #22c55e; font-weight: bold;">$10.00</div>
                    </div>
                    <div class="info-item">
                        <div class="label">New Balance</div>
                        <div class="value" style="font-size: 20px; color: #1e40af;">${referrer_new_balance:.2f}</div>
                    </div>
                </div>
            </div>

            <p>Keep sharing your referral code to earn more credits!</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="https://gatewayz.ai/settings/credits" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Your Balance</a>
            </div>
        """

        from src.services.professional_email_templates import email_templates

        referrer_html = email_templates.get_base_template().format(
            subject="Referral Bonus Earned!",
            header_subtitle="Your credits have been added",
            content=referrer_content,
            app_name="AI Gateway",
            app_url="https://gatewayz.ai",
            support_email="noreply@gatewayz.ai",
            email=referrer_email,
        )

        referrer_text = f"""Referral Bonus Earned - AI Gateway

Hi {referrer_username},

Great news! {referee_username} just made their first purchase, and you've earned your referral bonus!

Bonus Amount: $10.00
New Balance: ${referrer_new_balance:.2f}

Keep sharing your referral code to earn more credits!

View your balance: https://gatewayz.ai/settings/credits

Best regards,
The AI Gateway Team
"""

        referrer_success = enhanced_notification_service.send_email_notification(
            to_email=referrer_email,
            subject=referrer_subject,
            html_content=referrer_html,
            text_content=referrer_text,
        )

        # Send notification to referee
        referee_subject = "Welcome bonus applied - $10 in credits! - AI Gateway"

        referee_content = f"""
            <h2>🎉 Welcome Bonus Applied!</h2>
            <p>Hi <strong>{referee_username}</strong>,</p>
            <p>Thank you for your purchase! Your referral bonus has been applied.</p>

            <div class="success-box" style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0;">
                <h3 style="margin-bottom: 12px; color: #15803d;">Welcome Bonus</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="label">Bonus Amount</div>
                        <div class="value" style="font-size: 24px; color: #22c55e; font-weight: bold;">$10.00</div>
                    </div>
                    <div class="info-item">
                        <div class="label">New Balance</div>
                        <div class="value" style="font-size: 20px; color: #1e40af;">${referee_new_balance:.2f}</div>
                    </div>
                </div>
            </div>

            <p>This bonus was earned by using a referral code. Enjoy your credits!</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="https://gatewayz.ai/settings/credits" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Your Balance</a>
            </div>
        """

        referee_html = email_templates.get_base_template().format(
            subject="Welcome Bonus Applied!",
            header_subtitle="Your credits have been added",
            content=referee_content,
            app_name="AI Gateway",
            app_url="https://gatewayz.ai",
            support_email="noreply@gatewayz.ai",
            email=referee_email,
        )

        referee_text = f"""Welcome Bonus Applied - AI Gateway

Hi {referee_username},

Thank you for your purchase! Your referral bonus has been applied.

Bonus Amount: $10.00
New Balance: ${referee_new_balance:.2f}

This bonus was earned by using a referral code. Enjoy your credits!

View your balance: https://gatewayz.ai/settings/credits

Best regards,
The AI Gateway Team
"""

        referee_success = enhanced_notification_service.send_email_notification(
            to_email=referee_email,
            subject=referee_subject,
            html_content=referee_html,
            text_content=referee_text,
        )

        if referrer_success:
            logger.info(f"Sent referral bonus notification to referrer {referrer_id}")
        if referee_success:
            logger.info("Sent referral bonus notification to referee")

        return referrer_success, referee_success

    except Exception as e:
        logger.error(f"Error sending referral bonus notifications: {e}")
        return False, False


# Constants
REFERRAL_CODE_LENGTH = 8
MAX_REFERRAL_USES = 10  # Each referral code can be used by 10 different users
MIN_PURCHASE_AMOUNT = 10.0  # $10 minimum
REFERRAL_BONUS = 10.0  # $10 bonus for both users


def generate_referral_code() -> str:
    """Generate a unique 8-character referral code"""
    characters = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(characters) for _ in range(REFERRAL_CODE_LENGTH))


def create_user_referral_code(user_id: int) -> str:
    """Create a unique referral code for a user"""
    try:
        client = get_supabase_client()

        # Generate unique code
        max_attempts = 10
        for _ in range(max_attempts):
            code = generate_referral_code()

            # Check if code already exists
            existing = client.table("users").select("id").eq("referral_code", code).execute()

            if not existing.data:
                # Update user with new referral code
                result = (
                    client.table("users")
                    .update({"referral_code": code})
                    .eq("id", user_id)
                    .execute()
                )

                if result.data:
                    logger.info(f"Created referral code {code} for user {user_id}")
                    return code

        raise RuntimeError("Failed to generate unique referral code after max attempts")

    except Exception as e:
        logger.error(f"Failed to create referral code: {e}")
        raise


def validate_referral_code(
    referral_code: str, user_id: int
) -> tuple[bool, str | None, dict[str, Any] | None]:
    """
    Validate if a referral code can be used by a user.

    Returns: (is_valid, error_message, referrer_data)
    """
    try:
        client = get_supabase_client()

        # Get the referrer
        referrer_result = (
            client.table("users").select("*").eq("referral_code", referral_code).execute()
        )

        if not referrer_result.data:
            return False, "Invalid referral code", None

        referrer = referrer_result.data[0]

        # Get the user trying to use the code
        user_result = client.table("users").select("*").eq("id", user_id).execute()

        if not user_result.data:
            return False, "User not found", None

        user = user_result.data[0]

        # Check if user is trying to use their own code
        if user.get("referral_code") == referral_code:
            return False, "Cannot use your own referral code", None

        # Check if user has already made a purchase
        if user.get("has_made_first_purchase", False):
            return False, "Referral code can only be used on first purchase", None

        # Check if user already used a DIFFERENT referral code
        # Note: If they're using the same code they registered with, that's OK for first purchase bonus
        if user.get("referred_by_code") and user.get("referred_by_code") != referral_code:
            return False, "You have already used a different referral code", None

        # Check how many times this referral code has been used
        usage_count_result = (
            client.table("referrals")
            .select("id", count="exact")
            .eq("referral_code", referral_code)
            .eq("status", "completed")
            .execute()
        )

        usage_count = usage_count_result.count if usage_count_result.count else 0

        if usage_count >= MAX_REFERRAL_USES:
            return (
                False,
                f"This referral code has reached its usage limit ({MAX_REFERRAL_USES} uses)",
                None,
            )

        return True, None, referrer

    except Exception as e:
        logger.error(f"Error validating referral code: {e}")
        return False, f"Validation error: {str(e)}", None


def apply_referral_bonus(
    user_id: int, referral_code: str, purchase_amount: float
) -> tuple[bool, str | None, dict[str, Any] | None]:
    """
    Apply referral bonus to both user and referrer after a qualifying purchase.

    Returns: (success, error_message, bonus_data)
    """
    try:
        client = get_supabase_client()

        # Validate purchase amount
        if purchase_amount < MIN_PURCHASE_AMOUNT:
            return (
                False,
                f"Referral code requires a minimum purchase of ${MIN_PURCHASE_AMOUNT}",
                None,
            )

        # Validate referral code
        is_valid, error_message, referrer = validate_referral_code(referral_code, user_id)

        if not is_valid:
            return False, error_message, None

        # Get user
        user_result = client.table("users").select("*").eq("id", user_id).execute()
        if not user_result.data:
            return False, "User not found", None

        user = user_result.data[0]

        # Check if there's already a pending referral record from signup
        existing_referral = (
            client.table("referrals")
            .select("*")
            .eq("referred_user_id", user_id)
            .eq("referral_code", referral_code)
            .eq("status", "pending")
            .execute()
        )

        if existing_referral.data:
            # Update existing pending referral to completed
            referral_result = (
                client.table("referrals")
                .update({"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()})
                .eq("id", existing_referral.data[0]["id"])
                .execute()
            )

            if not referral_result.data:
                return False, "Failed to update referral record", None
        else:
            # Create new referral record (for cases where they didn't sign up with the code)
            referral_data = {
                "referrer_id": referrer["id"],
                "referred_user_id": user_id,
                "referral_code": referral_code,
                "bonus_amount": REFERRAL_BONUS,
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }

            referral_result = client.table("referrals").insert(referral_data).execute()

            if not referral_result.data:
                return False, "Failed to create referral record", None

        # Add credits to both users using the credit transaction system
        # Add $10 to the new user (referee)
        referee_success = add_credits(
            user["api_key"],
            REFERRAL_BONUS,
            f"Referral bonus - using code {referral_code}",
            metadata={
                "referral_code": referral_code,
                "referrer_id": referrer["id"],
                "type": "referral_bonus_referee",
            },
            user_id=user_id,  # Pass user_id directly to avoid stale data from API key lookup
        )
        logger.info(
            f"Referee (user {user_id}) credit addition: {'SUCCESS' if referee_success else 'FAILED'}"
        )

        # Add $10 to the referrer
        referrer_success = add_credits(
            referrer["api_key"],
            REFERRAL_BONUS,
            f"Referral bonus - user referred by code {referral_code}",
            metadata={
                "referral_code": referral_code,
                "referred_user_id": user_id,
                "type": "referral_bonus_referrer",
            },
            user_id=referrer["id"],  # Pass user_id directly to avoid stale data from API key lookup
        )
        logger.info(
            f"Referrer (user {referrer['id']}) credit addition: {'SUCCESS' if referrer_success else 'FAILED'}"
        )

        # Update referred_by_code for the new user
        client.table("users").update({"referred_by_code": referral_code}).eq(
            "id", user_id
        ).execute()

        # Note: Balances are already updated by add_credits() calls above
        # No need to update them again here

        logger.info(
            f"Applied referral bonus: ${REFERRAL_BONUS} to user {user_id} and "
            f"${REFERRAL_BONUS} to referrer {referrer['id']}"
        )

        # Fetch fresh balance data after credits have been added
        user_fresh = client.table("users").select("credits").eq("id", user_id).execute()
        referrer_fresh = client.table("users").select("credits").eq("id", referrer["id"]).execute()

        bonus_data = {
            "user_bonus": REFERRAL_BONUS,
            "referrer_bonus": REFERRAL_BONUS,
            "user_new_balance": float(user_fresh.data[0]["credits"]) if user_fresh.data else 0,
            "referrer_new_balance": (
                float(referrer_fresh.data[0]["credits"]) if referrer_fresh.data else 0
            ),
            "referrer_username": referrer.get("username", "Unknown"),
            "referrer_email": referrer.get("email", "Unknown"),
        }

        # Send email notifications to both users
        try:
            send_referral_bonus_notification(
                referrer_id=referrer["id"],
                referrer_email=referrer.get("email", ""),
                referrer_username=referrer.get("username", "User"),
                referrer_new_balance=bonus_data["referrer_new_balance"],
                referee_username=user.get("username", "User"),
                referee_email=user.get("email", ""),
                referee_new_balance=bonus_data["user_new_balance"],
            )
        except Exception as e:
            logger.warning(f"Failed to send referral bonus notifications: {e}")

        return True, None, bonus_data

    except Exception as e:
        logger.error(f"Error applying referral bonus: {e}", exc_info=True)
        return False, f"Failed to apply referral bonus: {str(e)}", None


def get_referral_stats(user_id: int) -> dict[str, Any] | None:
    """Get referral statistics for a user"""
    try:
        client = get_supabase_client()

        # Get user
        user_result = client.table("users").select("*").eq("id", user_id).execute()

        if not user_result.data:
            return None

        user = user_result.data[0]
        referral_code = user.get("referral_code")

        # If user doesn't have a referral code, create one
        if not referral_code:
            referral_code = create_user_referral_code(user_id)
            user["referral_code"] = referral_code

        # Get users who signed up with this referral code (from users table)
        referred_users_result = (
            client.table("users")
            .select("id", "username", "email", "created_at")
            .eq("referred_by_code", referral_code)
            .execute()
        )

        referred_users = referred_users_result.data if referred_users_result.data else []

        # Get successful referrals (from referrals table)
        referrals_result = (
            client.table("referrals")
            .select("*")
            .eq("referrer_id", user_id)
            .eq("status", "completed")
            .execute()
        )

        completed_referrals = referrals_result.data if referrals_result.data else []

        # Calculate stats
        total_uses = len(referred_users)  # Total people who used the code
        completed_bonuses = len(completed_referrals)  # How many got bonuses
        total_earned = sum(r.get("bonus_amount", 0) for r in completed_referrals)
        remaining_uses = max(0, MAX_REFERRAL_USES - total_uses)

        # Get details of referred users
        referral_details = []
        for ref_user in referred_users:
            # Check if this user got a bonus (completed referral)
            bonus_info = None
            for completed_ref in completed_referrals:
                if completed_ref["referred_user_id"] == ref_user["id"]:
                    bonus_info = {
                        "bonus_earned": completed_ref.get("bonus_amount", 0),
                        "bonus_date": completed_ref.get(
                            "completed_at", completed_ref.get("created_at")
                        ),
                    }
                    break

            referral_details.append(
                {
                    "user_id": ref_user["id"],
                    "username": ref_user.get("username", "Unknown"),
                    "email": ref_user.get("email", "Unknown"),
                    "date": ref_user.get("created_at"),  # Use 'date' for frontend compatibility
                    "signed_up_at": ref_user.get("created_at"),
                    "status": "completed" if bonus_info else "pending",
                    "bonus_earned": bonus_info.get("bonus_earned", 0) if bonus_info else 0,
                    "bonus_date": bonus_info.get("bonus_date") if bonus_info else None,
                    "reward": (
                        bonus_info.get("bonus_earned", 0) if bonus_info else 0
                    ),  # Use 'reward' for frontend compatibility
                }
            )

        return {
            "referral_code": referral_code,
            "total_uses": total_uses,
            "completed_bonuses": completed_bonuses,
            "pending_bonuses": total_uses - completed_bonuses,
            "remaining_uses": remaining_uses,
            "max_uses": MAX_REFERRAL_USES,
            "total_earned": float(total_earned),
            "current_balance": float(user.get("credits", 0) or 0),
            "referred_by_code": user.get("referred_by_code"),
            "referrals": referral_details,
        }

    except Exception as e:
        logger.error(f"Error getting referral stats: {e}")
        return None


def track_referral_signup(
    referral_code: str, referred_user_id: int
) -> tuple[bool, str | None, dict[str, Any] | None]:
    """
    Track when a user signs up with a referral code (creates pending referral record).

    Returns: (success, error_message, referrer_data)
    """
    try:
        client = get_supabase_client()

        # Get the referrer
        referrer_result = (
            client.table("users").select("*").eq("referral_code", referral_code).execute()
        )

        if not referrer_result.data:
            return False, "Invalid referral code", None

        referrer = referrer_result.data[0]

        # Check if user is trying to use their own code
        if referrer["id"] == referred_user_id:
            return False, "Cannot use your own referral code", None

        # Check how many times this referral code has been used
        usage_count_result = (
            client.table("referrals")
            .select("id", count="exact")
            .eq("referral_code", referral_code)
            .execute()
        )

        usage_count = usage_count_result.count if usage_count_result.count else 0

        if usage_count >= MAX_REFERRAL_USES:
            return (
                False,
                f"This referral code has reached its usage limit ({MAX_REFERRAL_USES} uses)",
                None,
            )

        # Create pending referral record (will be completed when they make first purchase)
        referral_data = {
            "referrer_id": referrer["id"],
            "referred_user_id": referred_user_id,
            "referral_code": referral_code,
            "bonus_amount": REFERRAL_BONUS,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        referral_result = client.table("referrals").insert(referral_data).execute()

        if not referral_result.data:
            return False, "Failed to create referral record", None

        logger.info(
            f"Tracked referral signup: user {referred_user_id} used code {referral_code} from user {referrer['id']}"
        )

        return True, None, referrer

    except Exception as e:
        logger.error(f"Error tracking referral signup: {e}", exc_info=True)
        return False, f"Failed to track referral signup: {str(e)}", None


def mark_first_purchase(user_id: int) -> bool:
    """Mark that a user has made their first purchase"""
    try:
        client = get_supabase_client()

        result = (
            client.table("users")
            .update({"has_made_first_purchase": True})
            .eq("id", user_id)
            .execute()
        )

        if result.data:
            logger.info(f"Marked first purchase for user {user_id}")
            return True

        return False

    except Exception as e:
        logger.error(f"Error marking first purchase: {e}")
        return False
