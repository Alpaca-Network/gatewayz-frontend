from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import uuid
import string
import random

db = SQLAlchemy()


def generate_referral_code():
    """Generate a unique 8-character referral code"""
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choices(characters, k=8))


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Referral code that this user owns
    referral_code = db.Column(db.String(8), unique=True, nullable=False)

    # Credits in dollars (can be used for API calls)
    credits = db.Column(db.Float, default=0.0)

    # Track if user has made their first purchase
    has_made_first_purchase = db.Column(db.Boolean, default=False)

    # Relationship to track who referred this user
    referred_by_code = db.Column(db.String(8), db.ForeignKey('users.referral_code'), nullable=True)
    referred_by = db.relationship('User', remote_side=[referral_code], backref='referrals',
                                  foreign_keys=[referred_by_code])

    # Relationship to track coupon usage
    coupon_usages = db.relationship('CouponUsage', backref='user', lazy=True, foreign_keys='CouponUsage.user_id')
    referred_usages = db.relationship('CouponUsage', backref='referrer', lazy=True,
                                      foreign_keys='CouponUsage.referrer_id')

    def __init__(self, email, username, referred_by_code=None):
        self.email = email
        self.username = username
        self.referral_code = generate_referral_code()
        self.referred_by_code = referred_by_code
        self.credits = 0.0
        self.has_made_first_purchase = False

    def get_remaining_referral_uses(self):
        """Get how many times the user's referral code can still be used"""
        used_count = CouponUsage.query.filter_by(
            referral_code=self.referral_code,
            is_valid=True
        ).count()
        return max(0, 5 - used_count)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'referral_code': self.referral_code,
            'credits': self.credits,
            'has_made_first_purchase': self.has_made_first_purchase,
            'referred_by_code': self.referred_by_code,
            'remaining_referral_uses': self.get_remaining_referral_uses(),
            'created_at': self.created_at.isoformat()
        }


class CouponUsage(db.Model):
    __tablename__ = 'coupon_usages'

    id = db.Column(db.Integer, primary_key=True)
    referral_code = db.Column(db.String(8), nullable=False)

    # User who used the coupon
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Owner of the referral code
    referrer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Purchase details
    purchase_amount = db.Column(db.Float, nullable=False)
    bonus_amount = db.Column(db.Float, default=10.0)

    # Timestamp
    used_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Status
    is_valid = db.Column(db.Boolean, default=True)

    def __init__(self, **kwargs):
        super(CouponUsage, self).__init__(**kwargs)
        if self.bonus_amount is None:
            self.bonus_amount = 10.0
        if self.is_valid is None:
            self.is_valid = True

    def to_dict(self):
        return {
            'id': self.id,
            'referral_code': self.referral_code,
            'user_id': self.user_id,
            'referrer_id': self.referrer_id,
            'purchase_amount': self.purchase_amount,
            'bonus_amount': self.bonus_amount,
            'used_at': self.used_at.isoformat(),
            'is_valid': self.is_valid
        }


class Purchase(db.Model):
    __tablename__ = 'purchases'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)

    # Track if referral bonus was applied
    referral_bonus_applied = db.Column(db.Boolean, default=False)
    referral_code_used = db.Column(db.String(8), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='purchases')

    def __init__(self, **kwargs):
        super(Purchase, self).__init__(**kwargs)
        if self.referral_bonus_applied is None:
            self.referral_bonus_applied = False

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': self.amount,
            'referral_bonus_applied': self.referral_bonus_applied,
            'referral_code_used': self.referral_code_used,
            'created_at': self.created_at.isoformat()
        }