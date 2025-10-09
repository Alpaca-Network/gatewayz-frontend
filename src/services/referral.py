from models import db, User, CouponUsage, Purchase
from flask import jsonify


class ReferralService:

    @staticmethod
    def validate_referral_code(referral_code, user_id):
        """
        Validate if a referral code can be used by a user
        Returns: (is_valid, error_message, referrer)
        """
        # Check if code exists
        referrer = User.query.filter_by(referral_code=referral_code).first()
        if not referrer:
            return False, "Invalid referral code", None

        # Check if user is trying to use their own code
        user = User.query.get(user_id)
        if not user:
            return False, "User not found", None

        if user.referral_code == referral_code:
            return False, "Cannot use your own referral code", None

        # Check if user has already made a purchase
        if user.has_made_first_purchase:
            return False, "Referral code can only be used on first purchase", None

        # Check if user already used a referral code
        existing_usage = CouponUsage.query.filter_by(user_id=user_id, is_valid=True).first()
        if existing_usage:
            return False, "You have already used a referral code", None

        # Check if code has been used 5 times already
        usage_count = CouponUsage.query.filter_by(
            referral_code=referral_code,
            is_valid=True
        ).count()

        if usage_count >= 5:
            return False, "This referral code has reached its usage limit", None

        return True, None, referrer

    @staticmethod
    def apply_referral_bonus(user_id, referral_code, purchase_amount):
        """
        Apply referral bonus to both user and referrer
        Returns: (success, message, bonus_data)
        """
        # Validate purchase amount
        if purchase_amount < 10:
            return False, "Referral code can only be used on purchases over $10", None

        # Validate referral code
        is_valid, error_message, referrer = ReferralService.validate_referral_code(
            referral_code, user_id
        )

        if not is_valid:
            return False, error_message, None

        user = User.query.get(user_id)

        try:
            # Add $10 bonus to both user and referrer
            bonus_amount = 10.0
            user.balance += bonus_amount
            referrer.balance += bonus_amount

            # Create coupon usage record
            coupon_usage = CouponUsage(
                referral_code=referral_code,
                user_id=user_id,
                referrer_id=referrer.id,
                purchase_amount=purchase_amount,
                bonus_amount=bonus_amount
            )

            db.session.add(coupon_usage)
            db.session.commit()

            bonus_data = {
                'user_bonus': bonus_amount,
                'referrer_bonus': bonus_amount,
                'user_new_balance': user.balance,
                'referrer_new_balance': referrer.balance,
                'referrer_username': referrer.username
            }

            return True, "Referral bonus applied successfully", bonus_data

        except Exception as e:
            db.session.rollback()
            return False, f"Error applying referral bonus: {str(e)}", None

    @staticmethod
    def create_purchase(user_id, amount, referral_code=None):
        """
        Create a purchase and apply referral bonus if applicable
        Returns: (success, message, purchase_data)
        """
        user = User.query.get(user_id)
        if not user:
            return False, "User not found", None

        bonus_applied = False
        bonus_data = None

        # Apply referral bonus if code provided and user hasn't made first purchase
        if referral_code and not user.has_made_first_purchase:
            success, message, bonus_data = ReferralService.apply_referral_bonus(
                user_id, referral_code, amount
            )
            if success:
                bonus_applied = True

        try:
            # Create purchase record
            purchase = Purchase(
                user_id=user_id,
                amount=amount,
                referral_bonus_applied=bonus_applied,
                referral_code_used=referral_code if bonus_applied else None
            )

            # Mark user as having made first purchase
            user.has_made_first_purchase = True

            db.session.add(purchase)
            db.session.commit()

            result = {
                'purchase': purchase.to_dict(),
                'bonus_applied': bonus_applied
            }

            if bonus_data:
                result['bonus_details'] = bonus_data

            return True, "Purchase created successfully", result

        except Exception as e:
            db.session.rollback()
            return False, f"Error creating purchase: {str(e)}", None

    @staticmethod
    def get_referral_stats(user_id):
        """
        Get referral statistics for a user
        """
        user = User.query.get(user_id)
        if not user:
            return None

        # Get successful referrals
        successful_referrals = CouponUsage.query.filter_by(
            referrer_id=user_id,
            is_valid=True
        ).all()

        total_earned = sum(usage.bonus_amount for usage in successful_referrals)

        return {
            'referral_code': user.referral_code,
            'total_uses': len(successful_referrals),
            'remaining_uses': user.get_remaining_referral_uses(),
            'total_earned': total_earned,
            'current_balance': user.balance,
            'referrals': [
                {
                    'user_id': usage.user_id,
                    'used_at': usage.used_at.isoformat(),
                    'bonus_earned': usage.bonus_amount
                }
                for usage in successful_referrals
            ]
        }