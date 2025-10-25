#!/usr/bin/env python3
"""
Tests for referral database models

Tests cover:
- Referral code generation
- User model creation
- CouponUsage model
- Purchase model
- Relationships and constraints
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime

from src.db.referral import generate_referral_code, User, CouponUsage, Purchase


# ============================================================
# TEST: Referral Code Generation
# ============================================================

class TestReferralCodeGeneration:
    """Test referral code generation"""

    def test_generate_referral_code_length(self):
        """Test referral code has correct length"""
        code = generate_referral_code()
        assert len(code) == 8

    def test_generate_referral_code_uppercase_digits(self):
        """Test referral code contains only uppercase and digits"""
        code = generate_referral_code()
        assert code.isupper() or code.isdigit() or code.isalnum()
        assert all(c.isupper() or c.isdigit() for c in code)

    def test_generate_referral_code_uniqueness(self):
        """Test that multiple codes are likely unique"""
        codes = [generate_referral_code() for _ in range(100)]
        # Most should be unique (collisions rare with 36^8 possibilities)
        assert len(set(codes)) > 95


# ============================================================
# TEST: User Model
# ============================================================

class TestUserModel:
    """Test User model"""

    def test_user_init(self):
        """Test User initialization"""
        user = User(email='test@example.com', username='testuser')

        assert user.email == 'test@example.com'
        assert user.username == 'testuser'
        assert user.referral_code is not None
        assert len(user.referral_code) == 8
        assert user.referred_by_code is None
        assert user.credits == 0.0
        assert user.has_made_first_purchase is False

    def test_user_init_with_referral(self):
        """Test User initialization with referral code"""
        user = User(
            email='test@example.com',
            username='testuser',
            referred_by_code='REFER123'
        )

        assert user.referred_by_code == 'REFER123'

    def test_user_to_dict(self):
        """Test User to_dict method"""
        user = User(email='test@example.com', username='testuser')
        user.id = 1
        user.created_at = datetime(2025, 1, 1)

        with patch.object(user, 'get_remaining_referral_uses', return_value=5):
            result = user.to_dict()

            assert result['id'] == 1
            assert result['email'] == 'test@example.com'
            assert result['username'] == 'testuser'
            assert result['credits'] == 0.0
            assert result['has_made_first_purchase'] is False
            assert result['remaining_referral_uses'] == 5
            assert 'created_at' in result

    def test_user_get_remaining_referral_uses_zero_used(self):
        """Test remaining uses when none used"""
        user = User(email='test@example.com', username='testuser')
        user.referral_code = 'TEST1234'

        with patch('src.db.referral.CouponUsage') as mock_coupon:
            mock_coupon.query.filter_by().count.return_value = 0

            remaining = user.get_remaining_referral_uses()
            assert remaining == 5

    def test_user_get_remaining_referral_uses_some_used(self):
        """Test remaining uses when partially used"""
        user = User(email='test@example.com', username='testuser')
        user.referral_code = 'TEST1234'

        with patch('src.db.referral.CouponUsage') as mock_coupon:
            mock_coupon.query.filter_by().count.return_value = 3

            remaining = user.get_remaining_referral_uses()
            assert remaining == 2

    def test_user_get_remaining_referral_uses_max_used(self):
        """Test remaining uses when max reached"""
        user = User(email='test@example.com', username='testuser')
        user.referral_code = 'TEST1234'

        with patch('src.db.referral.CouponUsage') as mock_coupon:
            mock_coupon.query.filter_by().count.return_value = 5

            remaining = user.get_remaining_referral_uses()
            assert remaining == 0

    def test_user_get_remaining_referral_uses_over_max(self):
        """Test remaining uses when over max (edge case)"""
        user = User(email='test@example.com', username='testuser')
        user.referral_code = 'TEST1234'

        with patch('src.db.referral.CouponUsage') as mock_coupon:
            mock_coupon.query.filter_by().count.return_value = 10

            remaining = user.get_remaining_referral_uses()
            assert remaining == 0  # Should never go negative


# ============================================================
# TEST: CouponUsage Model
# ============================================================

class TestCouponUsageModel:
    """Test CouponUsage model"""

    def test_coupon_usage_to_dict(self):
        """Test CouponUsage to_dict method"""
        coupon = CouponUsage()
        coupon.id = 1
        coupon.referral_code = 'TEST1234'
        coupon.user_id = 100
        coupon.referrer_id = 200
        coupon.purchase_amount = 50.0
        coupon.bonus_amount = 10.0
        coupon.used_at = datetime(2025, 1, 1)
        coupon.is_valid = True

        result = coupon.to_dict()

        assert result['id'] == 1
        assert result['referral_code'] == 'TEST1234'
        assert result['user_id'] == 100
        assert result['referrer_id'] == 200
        assert result['purchase_amount'] == 50.0
        assert result['bonus_amount'] == 10.0
        assert result['is_valid'] is True
        assert 'used_at' in result

    def test_coupon_usage_default_bonus(self):
        """Test CouponUsage default bonus amount"""
        coupon = CouponUsage()
        assert coupon.bonus_amount == 10.0

    def test_coupon_usage_default_is_valid(self):
        """Test CouponUsage default is_valid"""
        coupon = CouponUsage()
        assert coupon.is_valid is True


# ============================================================
# TEST: Purchase Model
# ============================================================

class TestPurchaseModel:
    """Test Purchase model"""

    def test_purchase_to_dict(self):
        """Test Purchase to_dict method"""
        purchase = Purchase()
        purchase.id = 1
        purchase.user_id = 100
        purchase.amount = 99.99
        purchase.referral_bonus_applied = True
        purchase.referral_code_used = 'TEST1234'
        purchase.created_at = datetime(2025, 1, 1)

        result = purchase.to_dict()

        assert result['id'] == 1
        assert result['user_id'] == 100
        assert result['amount'] == 99.99
        assert result['referral_bonus_applied'] is True
        assert result['referral_code_used'] == 'TEST1234'
        assert 'created_at' in result

    def test_purchase_default_referral_bonus(self):
        """Test Purchase default referral bonus"""
        purchase = Purchase()
        assert purchase.referral_bonus_applied is False

    def test_purchase_default_referral_code(self):
        """Test Purchase default referral code"""
        purchase = Purchase()
        assert purchase.referral_code_used is None
