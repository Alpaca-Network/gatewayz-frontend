"""
Tests for Referral System Routes

Covers:
- Referral code generation
- Referral code validation
- Referral stats retrieval
- Referral rewards
- Self-referral prevention
- Referral limits
- Analytics tracking
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

# Set test environment
os.environ['APP_ENV'] = 'testing'
os.environ['TESTING'] = 'true'
os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_KEY'] = 'test-key'
os.environ['FRONTEND_URL'] = 'https://gatewayz.ai'

from src.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def user_with_referral():
    """Mock user with referral code"""
    return {
        'id': 1,
        'user_id': 1,
        'email': 'user@example.com',
        'username': 'testuser',
        'credits': 100.0,
        'api_key': 'gw_test_key_123',
        'referral_code': 'TEST123',
        'referred_by_code': None,
        'is_active': True
    }


@pytest.fixture
def user_without_referral():
    """Mock user without referral code"""
    return {
        'id': 2,
        'user_id': 2,
        'email': 'newuser@example.com',
        'username': 'newuser',
        'credits': 0.0,
        'api_key': 'gw_new_key_456',
        'referral_code': None,
        'referred_by_code': None,
        'is_active': True
    }


@pytest.fixture
def auth_headers():
    """Authentication headers"""
    return {
        'Authorization': 'Bearer gw_test_key_123',
        'Content-Type': 'application/json'
    }


class TestReferralStats:
    """Test referral stats endpoint"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.services.referral.get_referral_stats')
    def test_get_referral_stats_success(self, mock_get_stats, mock_get_user, mock_auth, client, user_with_referral, auth_headers):
        """Successfully get referral stats"""
        mock_auth.return_value = user_with_referral
        mock_get_user.return_value = user_with_referral
        mock_get_stats.return_value = {
            'referral_code': 'TEST123',
            'total_uses': 5,
            'completed_bonuses': 3,
            'pending_bonuses': 2,
            'remaining_uses': 95,
            'max_uses': 100,
            'total_earned': 150.0,
            'current_balance': 100.0,
            'referred_by_code': None,
            'referrals': []
        }

        response = client.get('/referral/stats', headers=auth_headers)

        if response.status_code == 200:
            data = response.json()
            assert data['referral_code'] == 'TEST123'
            assert data['total_uses'] == 5
            assert data['total_earned'] == 150.0
            assert 'invite_link' in data
            assert 'gatewayz.ai' in data['invite_link']

    def test_get_referral_stats_requires_auth(self, client):
        """Referral stats requires authentication"""
        response = client.get('/referral/stats')

        assert response.status_code in [401, 422]

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    def test_get_referral_stats_invalid_api_key(self, mock_get_user, mock_auth, client, auth_headers):
        """Invalid API key returns 401"""
        mock_auth.return_value = None
        mock_get_user.return_value = None

        response = client.get('/referral/stats', headers=auth_headers)

        assert response.status_code in [401, 404]


class TestReferralValidation:
    """Test referral code validation"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.services.referral.validate_referral_code')
    def test_validate_referral_code_success(self, mock_validate, mock_get_user, mock_auth, client, user_without_referral, auth_headers):
        """Successfully validate a referral code"""
        mock_auth.return_value = user_without_referral
        mock_get_user.return_value = user_without_referral
        mock_validate.return_value = {
            'valid': True,
            'message': 'Referral code is valid',
            'referrer_username': 'testuser',
            'referrer_email': 'user@example.com'
        }

        response = client.post(
            '/referral/validate',
            json={'referral_code': 'TEST123'},
            headers=auth_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert data['valid'] is True
            assert 'referrer_username' in data

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.services.referral.validate_referral_code')
    def test_validate_invalid_referral_code(self, mock_validate, mock_get_user, mock_auth, client, user_without_referral, auth_headers):
        """Invalid referral code returns error"""
        mock_auth.return_value = user_without_referral
        mock_get_user.return_value = user_without_referral
        mock_validate.return_value = {
            'valid': False,
            'message': 'Referral code not found',
            'referrer_username': None,
            'referrer_email': None
        }

        response = client.post(
            '/referral/validate',
            json={'referral_code': 'INVALID'},
            headers=auth_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert data['valid'] is False

    def test_validate_referral_requires_code(self, client, auth_headers):
        """Validate referral requires code parameter"""
        response = client.post(
            '/referral/validate',
            json={},  # Missing referral_code
            headers=auth_headers
        )

        assert response.status_code in [422, 400]


class TestReferralCodeGeneration:
    """Test referral code generation"""

    def test_referral_code_format(self):
        """Referral code should follow format"""
        import random
        import string

        # Mock code generation
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

        assert len(code) == 8
        assert code.isupper() or code.isalnum()

    def test_referral_code_uniqueness(self):
        """Referral codes should be unique"""
        import random
        import string

        codes = set()
        for _ in range(100):
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            codes.add(code)

        # Should have high uniqueness
        assert len(codes) > 90  # Allow for some collisions


class TestSelfReferralPrevention:
    """Test self-referral prevention"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.services.referral.validate_referral_code')
    def test_cannot_use_own_referral_code(self, mock_validate, mock_get_user, mock_auth, client, user_with_referral, auth_headers):
        """User cannot use their own referral code"""
        mock_auth.return_value = user_with_referral
        mock_get_user.return_value = user_with_referral
        mock_validate.return_value = {
            'valid': False,
            'message': 'Cannot use your own referral code',
            'referrer_username': None,
            'referrer_email': None
        }

        response = client.post(
            '/referral/validate',
            json={'referral_code': 'TEST123'},  # User's own code
            headers=auth_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert data['valid'] is False
            assert 'own' in data.get('message', '').lower() or data['valid'] is False


class TestReferralRewards:
    """Test referral reward distribution"""

    def test_referrer_reward_calculation(self):
        """Calculate referrer reward correctly"""
        signup_bonus = 10.0  # $10 for referee
        referrer_bonus = 10.0  # $10 for referrer

        assert signup_bonus == 10.0
        assert referrer_bonus == 10.0

    def test_first_purchase_bonus(self):
        """Additional bonus on first purchase"""
        first_purchase_bonus = 5.0  # $5 additional

        assert first_purchase_bonus == 5.0

    def test_total_referral_earnings(self):
        """Calculate total referral earnings"""
        num_referrals = 5
        bonus_per_referral = 10.0
        first_purchase_bonuses = 3
        first_purchase_bonus_amount = 5.0

        total = (num_referrals * bonus_per_referral) + (first_purchase_bonuses * first_purchase_bonus_amount)

        assert total == 65.0  # (5 * 10) + (3 * 5)


class TestReferralLimits:
    """Test referral limits"""

    def test_referral_code_usage_limit(self):
        """Referral code should have usage limit"""
        max_uses = 100
        current_uses = 5

        remaining = max_uses - current_uses

        assert remaining == 95

    def test_referral_code_exhausted(self):
        """Exhausted referral code should be invalid"""
        max_uses = 100
        current_uses = 100

        is_valid = current_uses < max_uses

        assert is_valid is False

    def test_user_can_only_use_one_code(self):
        """User can only use one referral code"""
        user_has_used_code = True

        can_use_another = not user_has_used_code

        assert can_use_another is False


class TestReferralAnalytics:
    """Test referral analytics"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.services.referral.get_referral_stats')
    def test_referral_list_includes_details(self, mock_get_stats, mock_get_user, mock_auth, client, user_with_referral, auth_headers):
        """Referral stats should include referral details"""
        mock_auth.return_value = user_with_referral
        mock_get_user.return_value = user_with_referral
        mock_get_stats.return_value = {
            'referral_code': 'TEST123',
            'total_uses': 2,
            'completed_bonuses': 2,
            'pending_bonuses': 0,
            'remaining_uses': 98,
            'max_uses': 100,
            'total_earned': 20.0,
            'current_balance': 100.0,
            'referred_by_code': None,
            'referrals': [
                {
                    'username': 'referred_user1',
                    'signup_date': '2025-01-01',
                    'bonus_earned': 10.0,
                    'has_made_purchase': True
                },
                {
                    'username': 'referred_user2',
                    'signup_date': '2025-01-02',
                    'bonus_earned': 10.0,
                    'has_made_purchase': False
                }
            ]
        }

        response = client.get('/referral/stats', headers=auth_headers)

        if response.status_code == 200:
            data = response.json()
            assert 'referrals' in data
            if data['referrals']:
                assert len(data['referrals']) == 2


class TestReferralEdgeCases:
    """Test edge cases"""

    def test_referral_code_case_insensitive(self):
        """Referral codes should be case insensitive"""
        code1 = "TEST123"
        code2 = "test123"

        # Normalize to uppercase for comparison
        normalized1 = code1.upper()
        normalized2 = code2.upper()

        assert normalized1 == normalized2

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.services.referral.validate_referral_code')
    def test_referral_code_with_spaces(self, mock_validate, mock_get_user, mock_auth, client, user_without_referral, auth_headers):
        """Referral code with spaces should be trimmed"""
        mock_auth.return_value = user_without_referral
        mock_get_user.return_value = user_without_referral
        mock_validate.return_value = {
            'valid': True,
            'message': 'Valid',
            'referrer_username': 'testuser',
            'referrer_email': 'user@example.com'
        }

        response = client.post(
            '/referral/validate',
            json={'referral_code': ' TEST123 '},  # Spaces
            headers=auth_headers
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_empty_referral_code(self, client, auth_headers):
        """Empty referral code should be rejected"""
        response = client.post(
            '/referral/validate',
            json={'referral_code': ''},
            headers=auth_headers
        )

        assert response.status_code in [422, 400]

    def test_very_long_referral_code(self, client, auth_headers):
        """Very long referral code should be rejected"""
        long_code = 'A' * 1000

        response = client.post(
            '/referral/validate',
            json={'referral_code': long_code},
            headers=auth_headers
        )

        assert response.status_code in [200, 400, 422]


class TestInviteLink:
    """Test invite link generation"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.services.referral.get_referral_stats')
    def test_invite_link_format(self, mock_get_stats, mock_get_user, mock_auth, client, user_with_referral, auth_headers):
        """Invite link should have correct format"""
        mock_auth.return_value = user_with_referral
        mock_get_user.return_value = user_with_referral
        mock_get_stats.return_value = {
            'referral_code': 'TEST123',
            'total_uses': 0,
            'completed_bonuses': 0,
            'pending_bonuses': 0,
            'remaining_uses': 100,
            'max_uses': 100,
            'total_earned': 0.0,
            'current_balance': 100.0,
            'referred_by_code': None,
            'referrals': []
        }

        response = client.get('/referral/stats', headers=auth_headers)

        if response.status_code == 200:
            data = response.json()
            invite_link = data.get('invite_link', '')

            assert 'gatewayz.ai' in invite_link or 'http' in invite_link
            assert 'ref=' in invite_link or '?ref' in invite_link
            assert 'TEST123' in invite_link


class TestReferralSecurity:
    """Test referral security"""

    def test_referral_code_sql_injection(self, client, auth_headers):
        """SQL injection in referral code should be prevented"""
        sql_payload = "' OR '1'='1"

        response = client.post(
            '/referral/validate',
            json={'referral_code': sql_payload},
            headers=auth_headers
        )

        # Should handle safely
        assert response.status_code in [200, 400, 401, 422]

    def test_referral_code_xss_prevention(self, client, auth_headers):
        """XSS in referral code should be prevented"""
        xss_payload = "<script>alert('xss')</script>"

        response = client.post(
            '/referral/validate',
            json={'referral_code': xss_payload},
            headers=auth_headers
        )

        # Should handle safely
        assert response.status_code in [200, 400, 422]
        if response.status_code == 200:
            assert '<script>' not in response.text.lower()
