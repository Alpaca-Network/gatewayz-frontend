#!/usr/bin/env python3
"""
Comprehensive tests for Trial Service

Tests cover:
- Trial initialization
- Starting trials
- Checking trial status
- Converting trials to paid
- Tracking trial usage
- Getting subscription plans
- Validating trial access
- Error handling for all methods
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import os

from src.services.trial_service import TrialService, get_trial_service
from src.schemas.trials import (
    StartTrialRequest, SubscriptionStatus, TrialStatus,
    ConvertTrialRequest, TrackUsageRequest
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client"""
    client = Mock()

    # Mock RPC calls
    rpc_mock = Mock()
    rpc_mock.execute.return_value = Mock(data={'success': True})
    client.rpc.return_value = rpc_mock

    # Mock table queries
    table_mock = Mock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])
    client.table.return_value = table_mock

    return client


@pytest.fixture
def trial_service(mock_supabase_client):
    """Create trial service with mocked Supabase"""
    with patch('src.services.trial_service.create_client', return_value=mock_supabase_client):
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_KEY': 'test-key'
        }):
            service = TrialService()
            return service


@pytest.fixture
def sample_trial_data():
    """Sample trial data response"""
    return {
        'success': True,
        'trial_start_date': '2025-01-01T00:00:00Z',
        'trial_end_date': '2025-01-04T00:00:00Z',
        'trial_days': 3,
        'max_tokens': 1000000,
        'max_requests': 1000,
        'trial_credits': 10.0
    }


@pytest.fixture
def sample_trial_status():
    """Sample trial status response"""
    return {
        'is_trial': True,
        'trial_start_date': '2025-01-01T00:00:00Z',
        'trial_end_date': '2025-01-04T00:00:00Z',
        'trial_used_tokens': 500000,
        'trial_used_requests': 500,
        'trial_max_tokens': 1000000,
        'trial_max_requests': 1000,
        'trial_credits': 10.0,
        'trial_used_credits': 5.0,
        'trial_converted': False,
        'subscription_status': 'trial',
        'subscription_plan': None,
        'trial_active': True,
        'trial_expired': False,
        'trial_remaining_tokens': 500000,
        'trial_remaining_requests': 500,
        'trial_remaining_credits': 5.0
    }


# ============================================================
# TEST CLASS: Initialization
# ============================================================

class TestTrialServiceInit:
    """Test trial service initialization"""

    def test_init_success(self, trial_service):
        """Test successful initialization"""
        assert trial_service.supabase_url == 'https://test.supabase.co'
        assert trial_service.supabase_key == 'test-key'
        assert trial_service.supabase is not None

    def test_init_missing_url(self):
        """Test initialization fails without SUPABASE_URL"""
        with patch.dict(os.environ, {'SUPABASE_KEY': 'test-key'}, clear=True):
            with pytest.raises(ValueError) as exc_info:
                TrialService()
            assert "SUPABASE_URL" in str(exc_info.value)

    def test_init_missing_key(self):
        """Test initialization fails without SUPABASE_KEY"""
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://test.supabase.co'}, clear=True):
            with pytest.raises(ValueError) as exc_info:
                TrialService()
            assert "SUPABASE_KEY" in str(exc_info.value)


# ============================================================
# TEST CLASS: Start Trial
# ============================================================

class TestStartTrial:
    """Test starting trials"""

    @pytest.mark.asyncio
    async def test_start_trial_success(self, trial_service, sample_trial_data):
        """Test successful trial start"""
        # Mock API key ID lookup
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])

        # Mock get_trial_status to show no active trial
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                trial_status=Mock(
                    is_trial=False,
                    subscription_status=SubscriptionStatus.TRIAL
                )
            )

            # Mock RPC call
            trial_service.supabase.rpc().execute.return_value = Mock(data=sample_trial_data)

            request = StartTrialRequest(api_key='test_key', trial_days=3)
            result = await trial_service.start_trial(request)

            assert result.success is True
            assert result.trial_days == 3
            assert result.max_tokens == 1000000
            assert result.trial_credits == 10.0
            assert "successfully" in result.message.lower()

    @pytest.mark.asyncio
    async def test_start_trial_api_key_not_found(self, trial_service):
        """Test trial start with invalid API key"""
        # Mock API key not found
        trial_service.supabase.table().execute.return_value = Mock(data=[])

        request = StartTrialRequest(api_key='invalid_key', trial_days=3)
        result = await trial_service.start_trial(request)

        assert result.success is False
        assert "not found" in result.message.lower()

    @pytest.mark.asyncio
    async def test_start_trial_already_started(self, trial_service):
        """Test trial start when trial already active"""
        # Mock API key ID
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])

        # Mock trial already active
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                trial_status=Mock(
                    is_trial=True,
                    subscription_status=SubscriptionStatus.TRIAL
                )
            )

            request = StartTrialRequest(api_key='test_key', trial_days=3)
            result = await trial_service.start_trial(request)

            assert result.success is False
            assert "already started" in result.message.lower()

    @pytest.mark.asyncio
    async def test_start_trial_database_error(self, trial_service):
        """Test trial start with database error"""
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])

        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                trial_status=Mock(
                    is_trial=False,
                    subscription_status=SubscriptionStatus.TRIAL
                )
            )

            # Mock database error
            trial_service.supabase.rpc().execute.return_value = Mock(
                data={'success': False, 'error': 'Database constraint violation'}
            )

            request = StartTrialRequest(api_key='test_key', trial_days=3)
            result = await trial_service.start_trial(request)

            assert result.success is False
            assert "failed" in result.message.lower()

    @pytest.mark.asyncio
    async def test_start_trial_exception(self, trial_service):
        """Test trial start with exception"""
        # Mock API key found, but RPC call fails
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])

        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                trial_status=Mock(
                    is_trial=False,
                    subscription_status=SubscriptionStatus.TRIAL
                )
            )
            # Make RPC raise exception
            trial_service.supabase.rpc().execute.side_effect = Exception("Network error")

            request = StartTrialRequest(api_key='test_key', trial_days=3)
            result = await trial_service.start_trial(request)

            assert result.success is False
            assert "internal error" in result.message.lower()


# ============================================================
# TEST CLASS: Get Trial Status
# ============================================================

class TestGetTrialStatus:
    """Test getting trial status"""

    @pytest.mark.asyncio
    async def test_get_trial_status_success(self, trial_service, sample_trial_status):
        """Test successful trial status retrieval"""
        # Mock API key ID
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])

        # Mock RPC call
        trial_service.supabase.rpc().execute.return_value = Mock(data=sample_trial_status)

        result = await trial_service.get_trial_status('test_key')

        assert result.success is True
        assert result.trial_status.is_trial is True
        assert result.trial_status.trial_active is True
        assert result.trial_status.trial_remaining_tokens == 500000
        assert "successfully" in result.message.lower()

    @pytest.mark.asyncio
    async def test_get_trial_status_api_key_not_found(self, trial_service):
        """Test trial status with invalid API key"""
        trial_service.supabase.table().execute.return_value = Mock(data=[])

        result = await trial_service.get_trial_status('invalid_key')

        assert result.success is False
        assert "not found" in result.message.lower()

    @pytest.mark.asyncio
    async def test_get_trial_status_database_error(self, trial_service):
        """Test trial status with database error"""
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])
        trial_service.supabase.rpc().execute.return_value = Mock(
            data={'error': 'Database error'}
        )

        result = await trial_service.get_trial_status('test_key')

        assert result.success is False
        assert "failed" in result.message.lower()

    @pytest.mark.asyncio
    async def test_get_trial_status_exception(self, trial_service):
        """Test trial status with exception in _get_api_key_id"""
        # Exception in _get_api_key_id is caught and returns None, resulting in "API key not found"
        trial_service.supabase.table().execute.side_effect = Exception("Connection error")

        result = await trial_service.get_trial_status('test_key')

        assert result.success is False
        # _get_api_key_id catches exceptions and returns None, leading to "API key not found"
        assert "api key not found" in result.message.lower()


# ============================================================
# TEST CLASS: Convert Trial
# ============================================================

class TestConvertTrial:
    """Test converting trial to paid"""

    @pytest.mark.asyncio
    async def test_convert_trial_success(self, trial_service):
        """Test successful trial conversion"""
        # Mock API key ID
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])

        # Mock conversion response
        conversion_data = {
            'success': True,
            'converted_plan': 'pro',
            'conversion_date': '2025-01-01T00:00:00Z',
            'monthly_price': 29.99,
            'subscription_end_date': '2025-02-01T00:00:00Z'
        }
        trial_service.supabase.rpc().execute.return_value = Mock(data=conversion_data)

        request = ConvertTrialRequest(api_key='test_key', plan_name='pro')
        result = await trial_service.convert_trial_to_paid(request)

        assert result.success is True
        assert result.converted_plan == 'pro'
        assert result.monthly_price == 29.99
        assert "successfully" in result.message.lower()

    @pytest.mark.asyncio
    async def test_convert_trial_api_key_not_found(self, trial_service):
        """Test conversion with invalid API key"""
        trial_service.supabase.table().execute.return_value = Mock(data=[])

        request = ConvertTrialRequest(api_key='invalid_key', plan_name='pro')
        result = await trial_service.convert_trial_to_paid(request)

        assert result.success is False
        assert "not found" in result.message.lower()

    @pytest.mark.asyncio
    async def test_convert_trial_database_error(self, trial_service):
        """Test conversion with database error"""
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])
        trial_service.supabase.rpc().execute.return_value = Mock(
            data={'success': False, 'error': 'Plan not found'}
        )

        request = ConvertTrialRequest(api_key='test_key', plan_name='invalid_plan')
        result = await trial_service.convert_trial_to_paid(request)

        assert result.success is False
        assert "failed" in result.message.lower()

    @pytest.mark.asyncio
    async def test_convert_trial_exception(self, trial_service):
        """Test conversion with exception in _get_api_key_id"""
        # Exception in _get_api_key_id is caught and returns None, resulting in "API key not found"
        trial_service.supabase.table().execute.side_effect = Exception("Network error")

        request = ConvertTrialRequest(api_key='test_key', plan_name='pro')
        result = await trial_service.convert_trial_to_paid(request)

        assert result.success is False
        # _get_api_key_id catches exceptions and returns None, leading to "API key not found"
        assert "api key not found" in result.message.lower()


# ============================================================
# TEST CLASS: Track Trial Usage
# ============================================================

class TestTrackTrialUsage:
    """Test tracking trial usage"""

    @pytest.mark.asyncio
    async def test_track_usage_success(self, trial_service):
        """Test successful usage tracking"""
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 1}])

        usage_data = {
            'success': True,
            'daily_requests_used': 10,
            'daily_tokens_used': 1000,
            'total_trial_requests': 100,
            'total_trial_tokens': 50000,
            'total_trial_credits_used': 1.0,
            'remaining_tokens': 950000,
            'remaining_requests': 900,
            'remaining_credits': 9.0
        }
        trial_service.supabase.rpc().execute.return_value = Mock(data=usage_data)

        request = TrackUsageRequest(
            api_key='test_key',
            tokens_used=1000,
            requests_used=10,
            credits_used=0.02
        )
        result = await trial_service.track_trial_usage(request)

        assert result.success is True
        assert result.total_trial_tokens == 50000
        assert result.remaining_credits == 9.0
        assert "successfully" in result.message.lower()

    @pytest.mark.asyncio
    async def test_track_usage_api_key_not_found(self, trial_service):
        """Test usage tracking with invalid API key"""
        trial_service.supabase.table().execute.return_value = Mock(data=[])

        request = TrackUsageRequest(
            api_key='invalid_key',
            tokens_used=1000,
            requests_used=1,
            credits_used=0.02
        )
        result = await trial_service.track_trial_usage(request)

        assert result.success is False
        assert "not found" in result.message.lower()

    @pytest.mark.asyncio
    async def test_track_usage_exception(self, trial_service):
        """Test usage tracking with exception"""
        trial_service.supabase.table().execute.side_effect = Exception("Database error")

        request = TrackUsageRequest(
            api_key='test_key',
            tokens_used=1000,
            requests_used=1,
            credits_used=0.02
        )
        result = await trial_service.track_trial_usage(request)

        assert result.success is False
        assert "internal error" in result.message.lower()


# ============================================================
# TEST CLASS: Get Subscription Plans
# ============================================================

class TestGetSubscriptionPlans:
    """Test getting subscription plans"""

    @pytest.mark.asyncio
    async def test_get_plans_success(self, trial_service):
        """Test successful plans retrieval"""
        plans_data = [
            {
                'id': 1,
                'plan_name': 'starter',
                'plan_type': 'dev',  # Valid PlanType enum value
                'monthly_price': 9.99,
                'yearly_price': 99.99,
                'monthly_request_limit': 10000,
                'monthly_token_limit': 1000000,
                'daily_request_limit': 500,
                'daily_token_limit': 50000,
                'max_concurrent_requests': 5,
                'features': ['feature1', 'feature2'],
                'is_active': True,
                'created_at': '2025-01-01T00:00:00Z',
                'updated_at': '2025-01-01T00:00:00Z'
            }
        ]
        trial_service.supabase.table().execute.return_value = Mock(data=plans_data)

        result = await trial_service.get_subscription_plans()

        assert result.success is True
        assert len(result.plans) == 1
        assert result.plans[0].plan_name == 'starter'
        assert result.plans[0].monthly_price == 9.99
        assert "successfully" in result.message.lower()

    @pytest.mark.asyncio
    async def test_get_plans_empty(self, trial_service):
        """Test plans retrieval with no plans"""
        trial_service.supabase.table().execute.return_value = Mock(data=[])

        result = await trial_service.get_subscription_plans()

        assert result.success is False
        assert len(result.plans) == 0
        assert "no subscription plans" in result.message.lower()

    @pytest.mark.asyncio
    async def test_get_plans_exception(self, trial_service):
        """Test plans retrieval with exception"""
        trial_service.supabase.table().execute.side_effect = Exception("Database error")

        result = await trial_service.get_subscription_plans()

        assert result.success is False
        assert "internal error" in result.message.lower()


# ============================================================
# TEST CLASS: Validate Trial Access
# ============================================================

class TestValidateTrialAccess:
    """Test validating trial access"""

    @pytest.mark.asyncio
    async def test_validate_access_success(self, trial_service):
        """Test successful access validation"""
        # Mock trial status
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                success=True,
                trial_status=Mock(
                    is_trial=True,
                    trial_expired=False,
                    trial_remaining_tokens=500000,
                    trial_remaining_requests=500,
                    trial_remaining_credits=5.0,
                    trial_end_date=datetime.now() + timedelta(days=2)
                )
            )

            result = await trial_service.validate_trial_access('test_key', tokens_used=1000, requests_used=1)

            assert result.is_valid is True
            assert result.is_trial is True
            assert result.is_expired is False
            assert result.remaining_tokens == 500000

    @pytest.mark.asyncio
    async def test_validate_access_status_check_failed(self, trial_service):
        """Test validation when status check fails"""
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(success=False)

            result = await trial_service.validate_trial_access('test_key')

            assert result.is_valid is False
            assert "failed to get trial status" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_validate_access_not_trial(self, trial_service):
        """Test validation for non-trial account"""
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                success=True,
                trial_status=Mock(is_trial=False)
            )

            result = await trial_service.validate_trial_access('test_key')

            assert result.is_valid is False
            assert result.is_trial is False
            assert "not a trial" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_validate_access_expired(self, trial_service):
        """Test validation for expired trial"""
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                success=True,
                trial_status=Mock(
                    is_trial=True,
                    trial_expired=True,
                    trial_end_date=datetime.now() - timedelta(days=1)
                )
            )

            result = await trial_service.validate_trial_access('test_key')

            assert result.is_valid is False
            assert result.is_trial is True
            assert result.is_expired is True
            assert "expired" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_validate_access_insufficient_tokens(self, trial_service):
        """Test validation with insufficient tokens"""
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                success=True,
                trial_status=Mock(
                    is_trial=True,
                    trial_expired=False,
                    trial_remaining_tokens=100,
                    trial_remaining_requests=500,
                    trial_remaining_credits=5.0,
                    trial_end_date=datetime.now() + timedelta(days=2)
                )
            )

            result = await trial_service.validate_trial_access('test_key', tokens_used=1000)

            assert result.is_valid is False
            assert "token limit" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_validate_access_insufficient_requests(self, trial_service):
        """Test validation with insufficient requests"""
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                success=True,
                trial_status=Mock(
                    is_trial=True,
                    trial_expired=False,
                    trial_remaining_tokens=500000,
                    trial_remaining_requests=0,
                    trial_remaining_credits=5.0,
                    trial_end_date=datetime.now() + timedelta(days=2)
                )
            )

            result = await trial_service.validate_trial_access('test_key', requests_used=1)

            assert result.is_valid is False
            assert "request limit" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_validate_access_insufficient_credits(self, trial_service):
        """Test validation with insufficient credits"""
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.return_value = Mock(
                success=True,
                trial_status=Mock(
                    is_trial=True,
                    trial_expired=False,
                    trial_remaining_tokens=2000000,  # Enough tokens (2M)
                    trial_remaining_requests=500,  # Enough requests
                    trial_remaining_credits=0.01,  # Very low credits
                    trial_end_date=datetime.now() + timedelta(days=2)
                )
            )

            # Request 1M tokens (estimated cost: $0.02, but only $0.01 credits remaining)
            result = await trial_service.validate_trial_access('test_key', tokens_used=1000000)

            assert result.is_valid is False
            assert "credit limit" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_validate_access_exception(self, trial_service):
        """Test validation with exception"""
        with patch.object(trial_service, 'get_trial_status') as mock_status:
            mock_status.side_effect = Exception("Network error")

            result = await trial_service.validate_trial_access('test_key')

            assert result.is_valid is False
            assert "internal error" in result.error_message.lower()


# ============================================================
# TEST CLASS: Helper Methods
# ============================================================

class TestHelperMethods:
    """Test helper methods"""

    @pytest.mark.asyncio
    async def test_get_api_key_id_success(self, trial_service):
        """Test successful API key ID retrieval"""
        trial_service.supabase.table().execute.return_value = Mock(data=[{'id': 123}])

        result = await trial_service._get_api_key_id('test_key')

        assert result == 123

    @pytest.mark.asyncio
    async def test_get_api_key_id_not_found(self, trial_service):
        """Test API key ID not found"""
        trial_service.supabase.table().execute.return_value = Mock(data=[])

        result = await trial_service._get_api_key_id('invalid_key')

        assert result is None

    @pytest.mark.asyncio
    async def test_get_api_key_id_exception(self, trial_service):
        """Test API key ID with exception"""
        trial_service.supabase.table().execute.side_effect = Exception("Database error")

        result = await trial_service._get_api_key_id('test_key')

        assert result is None


# ============================================================
# TEST CLASS: Global Service Instance
# ============================================================

class TestGlobalServiceInstance:
    """Test global service instance"""

    def test_get_trial_service_singleton(self):
        """Test that get_trial_service returns singleton"""
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_KEY': 'test-key'
        }):
            with patch('src.services.trial_service.create_client'):
                service1 = get_trial_service()
                service2 = get_trial_service()

                # Should return same instance
                assert service1 is service2
