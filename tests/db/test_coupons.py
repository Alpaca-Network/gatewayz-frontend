#!/usr/bin/env python3
"""
Comprehensive tests for coupon database operations

Tests cover:
- Coupon CRUD operations
- Coupon validation
- Coupon redemption
- User coupon queries
- Admin analytics
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone, timedelta

from src.db.coupons import (
    create_coupon,
    get_coupon_by_code,
    get_coupon_by_id,
    list_coupons,
    update_coupon,
    deactivate_coupon,
    validate_coupon,
    redeem_coupon,
    get_available_coupons_for_user,
    get_user_redemption_history,
    get_coupon_analytics,
    get_all_coupons_stats
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with chainable methods"""
    client = Mock()
    table_mock = Mock()
    rpc_mock = Mock()

    client.table.return_value = table_mock
    client.rpc.return_value = rpc_mock

    # Chainable methods
    table_mock.insert.return_value = table_mock
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.ilike.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.range.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])

    rpc_mock.execute.return_value = Mock(data=[])

    return client, table_mock, rpc_mock


@pytest.fixture
def mock_coupon_data():
    """Mock coupon data"""
    return {
        'id': 1,
        'code': 'WELCOME2024',
        'value_usd': 10.0,
        'coupon_scope': 'global',
        'max_uses': 100,
        'times_used': 5,
        'coupon_type': 'promotional',
        'is_active': True,
        'created_by': 1,
        'created_by_type': 'admin',
        'valid_from': '2024-01-01T00:00:00+00:00',
        'valid_until': '2024-12-31T23:59:59+00:00',
        'description': 'Welcome coupon',
        'created_at': '2024-01-01T00:00:00+00:00'
    }


@pytest.fixture
def mock_user_specific_coupon():
    """Mock user-specific coupon"""
    return {
        'id': 2,
        'code': 'USER123',
        'value_usd': 5.0,
        'coupon_scope': 'user_specific',
        'max_uses': 1,
        'times_used': 0,
        'coupon_type': 'referral',
        'is_active': True,
        'assigned_to_user_id': 123,
        'created_by_type': 'system',
        'valid_from': '2024-01-01T00:00:00+00:00',
        'valid_until': '2024-12-31T23:59:59+00:00'
    }


# ============================================================
# TEST CLASS: Coupon Creation
# ============================================================

class TestCreateCoupon:
    """Test coupon creation"""

    @patch('src.db.coupons.get_supabase_client')
    def test_create_global_coupon_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_coupon_data
    ):
        """Test creating a global coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock insert response
        table_mock.execute.return_value = Mock(data=[mock_coupon_data])

        valid_until = datetime(2024, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

        result = create_coupon(
            code='WELCOME2024',
            value_usd=10.0,
            coupon_scope='global',
            max_uses=100,
            valid_until=valid_until,
            coupon_type='promotional',
            created_by=1,
            description='Welcome coupon'
        )

        assert result is not None
        assert result['code'] == 'WELCOME2024'
        assert result['value_usd'] == 10.0

        # Verify code was uppercase
        client.table.assert_called_once_with('coupons')
        insert_data = table_mock.insert.call_args[0][0]
        assert insert_data['code'] == 'WELCOME2024'

    @patch('src.db.coupons.get_supabase_client')
    def test_create_user_specific_coupon_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_user_specific_coupon
    ):
        """Test creating a user-specific coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_user_specific_coupon])

        valid_until = datetime(2024, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

        result = create_coupon(
            code='user123',  # lowercase input
            value_usd=5.0,
            coupon_scope='user_specific',
            max_uses=1,
            valid_until=valid_until,
            assigned_to_user_id=123
        )

        assert result is not None
        assert result['coupon_scope'] == 'user_specific'
        assert result['assigned_to_user_id'] == 123

    @patch('src.db.coupons.get_supabase_client')
    def test_create_user_specific_without_user_id_fails(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test creating user-specific coupon without user ID fails"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        valid_until = datetime(2024, 12, 31, tzinfo=timezone.utc)

        with pytest.raises(ValueError, match="must have assigned_to_user_id"):
            create_coupon(
                code='USER123',
                value_usd=5.0,
                coupon_scope='user_specific',
                max_uses=1,
                valid_until=valid_until
            )

    @patch('src.db.coupons.get_supabase_client')
    def test_create_global_coupon_with_user_id_fails(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test creating global coupon with user ID fails"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        valid_until = datetime(2024, 12, 31, tzinfo=timezone.utc)

        with pytest.raises(ValueError, match="cannot have assigned_to_user_id"):
            create_coupon(
                code='GLOBAL123',
                value_usd=10.0,
                coupon_scope='global',
                max_uses=100,
                valid_until=valid_until,
                assigned_to_user_id=123
            )

    @patch('src.db.coupons.get_supabase_client')
    def test_create_user_specific_with_max_uses_not_1_fails(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test creating user-specific coupon with max_uses != 1 fails"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        valid_until = datetime(2024, 12, 31, tzinfo=timezone.utc)

        with pytest.raises(ValueError, match="must have max_uses = 1"):
            create_coupon(
                code='USER123',
                value_usd=5.0,
                coupon_scope='user_specific',
                max_uses=10,
                valid_until=valid_until,
                assigned_to_user_id=123
            )


# ============================================================
# TEST CLASS: Coupon Retrieval
# ============================================================

class TestGetCoupon:
    """Test coupon retrieval"""

    @patch('src.db.coupons.get_supabase_client')
    def test_get_coupon_by_code_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_coupon_data
    ):
        """Test retrieving coupon by code"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_coupon_data])

        result = get_coupon_by_code('welcome2024')

        assert result is not None
        assert result['code'] == 'WELCOME2024'

        # Verify case-insensitive search
        table_mock.ilike.assert_called_once_with('code', 'welcome2024')

    @patch('src.db.coupons.get_supabase_client')
    def test_get_coupon_by_code_not_found(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving non-existent coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = get_coupon_by_code('NONEXISTENT')

        assert result is None

    @patch('src.db.coupons.get_supabase_client')
    def test_get_coupon_by_id_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_coupon_data
    ):
        """Test retrieving coupon by ID"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_coupon_data])

        result = get_coupon_by_id(1)

        assert result is not None
        assert result['id'] == 1

    @patch('src.db.coupons.get_supabase_client')
    def test_list_coupons_all(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_coupon_data,
        mock_user_specific_coupon
    ):
        """Test listing all coupons"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_coupon_data, mock_user_specific_coupon])

        result = list_coupons()

        assert len(result) == 2

    @patch('src.db.coupons.get_supabase_client')
    def test_list_coupons_with_filters(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_coupon_data
    ):
        """Test listing coupons with filters"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_coupon_data])

        result = list_coupons(
            scope='global',
            coupon_type='promotional',
            is_active=True
        )

        # Verify filters were applied
        assert table_mock.eq.call_count >= 3


# ============================================================
# TEST CLASS: Coupon Update
# ============================================================

class TestUpdateCoupon:
    """Test coupon updates"""

    @patch('src.db.coupons.get_supabase_client')
    def test_update_coupon_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_coupon_data
    ):
        """Test updating coupon fields"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        updated_data = {**mock_coupon_data, 'max_uses': 200}
        table_mock.execute.return_value = Mock(data=[updated_data])

        result = update_coupon(1, {'max_uses': 200})

        assert result is not None
        assert result['max_uses'] == 200

    @patch('src.db.coupons.get_supabase_client')
    def test_update_coupon_filters_invalid_fields(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test that invalid fields are filtered out"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        with pytest.raises(ValueError, match="No valid fields to update"):
            update_coupon(1, {'code': 'NEWCODE', 'value_usd': 100})

    @patch('src.db.coupons.get_supabase_client')
    def test_deactivate_coupon_success(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test deactivating a coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[{'id': 1, 'is_active': False}])

        result = deactivate_coupon(1)

        assert result is True


# ============================================================
# TEST CLASS: Coupon Validation
# ============================================================

class TestValidateCoupon:
    """Test coupon validation"""

    @patch('src.db.coupons.get_supabase_client')
    def test_validate_coupon_valid(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test validating a valid coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock RPC response
        rpc_mock.execute.return_value = Mock(data=[{
            'is_valid': True,
            'error_code': None,
            'error_message': None,
            'coupon_id': 1,
            'coupon_value': 10.0
        }])

        result = validate_coupon('WELCOME2024', 123)

        assert result['is_valid'] is True
        assert result['coupon_id'] == 1
        assert result['coupon_value'] == 10.0

        client.rpc.assert_called_once_with('is_coupon_redeemable', {
            'p_coupon_code': 'WELCOME2024',
            'p_user_id': 123
        })

    @patch('src.db.coupons.get_supabase_client')
    def test_validate_coupon_invalid(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test validating an invalid coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        rpc_mock.execute.return_value = Mock(data=[{
            'is_valid': False,
            'error_code': 'COUPON_EXPIRED',
            'error_message': 'Coupon has expired',
            'coupon_id': None,
            'coupon_value': None
        }])

        result = validate_coupon('EXPIRED', 123)

        assert result['is_valid'] is False
        assert result['error_code'] == 'COUPON_EXPIRED'


# ============================================================
# TEST CLASS: Coupon Redemption
# ============================================================

class TestRedeemCoupon:
    """Test coupon redemption"""

    @patch('src.db.coupons.validate_coupon')
    @patch('src.db.coupons.get_supabase_client')
    def test_redeem_coupon_success(
        self,
        mock_get_client,
        mock_validate,
        mock_supabase_client
    ):
        """Test successfully redeeming a coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock validation
        mock_validate.return_value = {
            'is_valid': True,
            'coupon_id': 1,
            'coupon_value': 10.0,
            'error_code': None
        }

        # Mock user balance lookup
        def table_side_effect(table_name):
            mock = Mock()
            mock.select.return_value = mock
            mock.eq.return_value = mock
            mock.update.return_value = mock
            mock.insert.return_value = mock
            mock.execute.return_value = Mock(data=[])

            if table_name == 'users':
                mock.execute.return_value = Mock(data=[{'credits': 50.0}])
            elif table_name == 'coupons':
                mock.execute.return_value = Mock(data=[{'id': 1, 'times_used': 5}])

            return mock

        client.table.side_effect = table_side_effect

        result = redeem_coupon('WELCOME2024', 123, '192.168.1.1', 'TestAgent')

        assert result['success'] is True
        assert result['coupon_value'] == 10.0
        assert result['previous_balance'] == 50.0
        assert result['new_balance'] == 60.0

    @patch('src.db.coupons.validate_coupon')
    def test_redeem_coupon_invalid(
        self,
        mock_validate
    ):
        """Test redeeming an invalid coupon"""
        mock_validate.return_value = {
            'is_valid': False,
            'error_code': 'ALREADY_REDEEMED',
            'error_message': 'Coupon already redeemed',
            'coupon_id': None,
            'coupon_value': None
        }

        result = redeem_coupon('USED123', 123)

        assert result['success'] is False
        assert result['error_code'] == 'ALREADY_REDEEMED'


# ============================================================
# TEST CLASS: User Coupon Queries
# ============================================================

class TestUserCouponQueries:
    """Test user-specific coupon queries"""

    @patch('src.db.coupons.get_supabase_client')
    def test_get_available_coupons_for_user(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_user_specific_coupon
    ):
        """Test getting available coupons for a user"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        rpc_mock.execute.return_value = Mock(data=[mock_user_specific_coupon])

        result = get_available_coupons_for_user(123)

        assert len(result) == 1
        assert result[0]['assigned_to_user_id'] == 123

        client.rpc.assert_called_once_with('get_available_coupons', {
            'p_user_id': 123
        })

    @patch('src.db.coupons.get_supabase_client')
    def test_get_user_redemption_history(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test getting user redemption history"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        redemption_data = [{
            'id': 1,
            'user_id': 123,
            'coupon_id': 1,
            'value_applied': 10.0,
            'redeemed_at': '2024-01-15T10:00:00Z',
            'coupons': {
                'code': 'WELCOME2024',
                'coupon_type': 'promotional',
                'coupon_scope': 'global'
            }
        }]

        table_mock.execute.return_value = Mock(data=redemption_data)

        result = get_user_redemption_history(123)

        assert len(result) == 1
        assert result[0]['coupons']['code'] == 'WELCOME2024'


# ============================================================
# TEST CLASS: Admin Analytics
# ============================================================

class TestCouponAnalytics:
    """Test coupon analytics"""

    @patch('src.db.coupons.get_coupon_by_id')
    @patch('src.db.coupons.get_supabase_client')
    def test_get_coupon_analytics(
        self,
        mock_get_client,
        mock_get_coupon,
        mock_supabase_client,
        mock_coupon_data
    ):
        """Test getting analytics for a coupon"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        mock_get_coupon.return_value = mock_coupon_data

        redemptions = [
            {'user_id': 123, 'value_applied': 10.0},
            {'user_id': 124, 'value_applied': 10.0},
            {'user_id': 123, 'value_applied': 10.0}  # Same user twice
        ]

        table_mock.execute.return_value = Mock(data=redemptions)

        result = get_coupon_analytics(1)

        assert result['total_redemptions'] == 3
        assert result['unique_users'] == 2  # Only 2 unique users
        assert result['total_value_distributed'] == 30.0

    @patch('src.db.coupons.get_supabase_client')
    def test_get_all_coupons_stats(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_coupon_data,
        mock_user_specific_coupon
    ):
        """Test getting overall coupon stats"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        def table_side_effect(table_name):
            mock = Mock()
            mock.select.return_value = mock
            mock.execute.return_value = Mock(data=[])

            if table_name == 'coupons':
                mock.execute.return_value = Mock(data=[
                    mock_coupon_data,
                    mock_user_specific_coupon
                ])
            elif table_name == 'coupon_redemptions':
                mock.execute.return_value = Mock(data=[
                    {'user_id': 123, 'value_applied': 10.0},
                    {'user_id': 124, 'value_applied': 5.0}
                ])

            return mock

        client.table.side_effect = table_side_effect

        result = get_all_coupons_stats()

        assert result['total_coupons'] == 2
        assert result['global_coupons'] == 1
        assert result['user_specific_coupons'] == 1
        assert result['total_redemptions'] == 2
        assert result['total_value_distributed'] == 15.0
        assert result['unique_redeemers'] == 2


# ============================================================
# TEST CLASS: Error Handling
# ============================================================

class TestCouponErrorHandling:
    """Test error handling"""

    @patch('src.db.coupons.get_supabase_client')
    def test_get_coupon_by_code_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when getting coupon by code"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        client.table.side_effect = Exception("Database error")

        result = get_coupon_by_code('TEST')

        assert result is None

    @patch('src.db.coupons.get_supabase_client')
    def test_list_coupons_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling when listing coupons"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        client.table.side_effect = Exception("Database error")

        result = list_coupons()

        assert result == []

    @patch('src.db.coupons.get_supabase_client')
    def test_validate_coupon_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling during coupon validation"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        client.rpc.side_effect = Exception("Database error")

        result = validate_coupon('TEST', 123)

        assert result['is_valid'] is False
        assert result['error_code'] == 'SYSTEM_ERROR'
