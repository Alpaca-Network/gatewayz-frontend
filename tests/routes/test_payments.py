#!/usr/bin/env python3
"""
Comprehensive tests for Stripe payment endpoints

Tests cover:
- Stripe webhook handling
- Checkout session creation and retrieval
- Payment intent creation and retrieval
- Credit packages listing
- Refund creation (admin)
- Payment history retrieval
- Payment details retrieval
- Error handling and security
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from src.main import app


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_current_user():
    """Sample authenticated user"""
    return {
        'id': '1',
        'username': 'testuser',
        'email': 'test@example.com',
        'is_admin': False
    }


@pytest.fixture
def mock_admin_user():
    """Sample admin user"""
    return {
        'id': '99',
        'username': 'admin',
        'email': 'admin@example.com',
        'is_admin': True
    }


@pytest.fixture
def mock_webhook_result():
    """Sample webhook processing result"""
    return MagicMock(
        success=True,
        event_type='checkout.session.completed',
        event_id='evt_123456',
        message='Credits added successfully',
        processed_at=datetime.now(timezone.utc)
    )


@pytest.fixture
def mock_checkout_session():
    """Sample checkout session"""
    return MagicMock(
        session_id='cs_test_123456',
        url='https://checkout.stripe.com/pay/cs_test_123456',
        payment_id='1',
        status=Mock(value='pending'),
        amount=1000,
        currency='usd',
        expires_at=datetime.now(timezone.utc)
    )


@pytest.fixture
def mock_payment_intent():
    """Sample payment intent"""
    return MagicMock(
        payment_intent_id='pi_123456',
        client_secret='pi_123456_secret_123',
        payment_id='2',
        status=Mock(value='requires_payment_method'),
        amount=2000,
        currency='usd',
        next_action=None
    )


@pytest.fixture
def mock_payments():
    """Sample payment history"""
    return [
        {
            'id': 1,
            'user_id': '1',
            'amount': 10.00,
            'currency': 'usd',
            'status': 'completed',
            'payment_method': 'card',
            'stripe_payment_intent_id': 'pi_123',
            'created_at': '2024-01-01T00:00:00Z',
            'completed_at': '2024-01-01T00:05:00Z',
            'metadata': {'credits': 1000}
        },
        {
            'id': 2,
            'user_id': '1',
            'amount': 50.00,
            'currency': 'usd',
            'status': 'completed',
            'payment_method': 'card',
            'stripe_payment_intent_id': 'pi_456',
            'created_at': '2024-01-05T00:00:00Z',
            'completed_at': '2024-01-05T00:02:00Z',
            'metadata': {'credits': 5000}
        }
    ]


# ============================================================
# TEST CLASS: Stripe Webhooks
# ============================================================

class TestStripeWebhooks:
    """Test Stripe webhook handling"""

    @patch('src.routes.payments.stripe_service')
    async def test_webhook_success(
        self,
        mock_stripe_service,
        client,
        mock_webhook_result
    ):
        """Test successful webhook processing"""
        mock_stripe_service.handle_webhook.return_value = mock_webhook_result

        response = client.post(
            '/api/stripe/webhook',
            content=b'{"type": "checkout.session.completed"}',
            headers={'stripe-signature': 'test_signature_123'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['event_type'] == 'checkout.session.completed'
        assert data['event_id'] == 'evt_123456'

    async def test_webhook_missing_signature(self, client):
        """Test webhook without signature"""
        response = client.post(
            '/api/stripe/webhook',
            content=b'{"type": "checkout.session.completed"}'
        )

        assert response.status_code == 400
        assert 'signature' in response.json()['detail'].lower()

    @patch('src.routes.payments.stripe_service')
    async def test_webhook_invalid_signature(
        self,
        mock_stripe_service,
        client
    ):
        """Test webhook with invalid signature"""
        mock_stripe_service.handle_webhook.side_effect = ValueError("Invalid signature")

        response = client.post(
            '/api/stripe/webhook',
            content=b'{"type": "test"}',
            headers={'stripe-signature': 'invalid_signature'}
        )

        assert response.status_code == 400
        assert 'invalid signature' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Checkout Sessions
# ============================================================

class TestCheckoutSessions:
    """Test checkout session operations"""

    @patch('src.routes.payments.stripe_service')
    @patch('src.routes.payments.get_current_user')
    def test_create_checkout_session_success(
        self,
        mock_get_user,
        mock_stripe_service,
        client,
        mock_current_user,
        mock_checkout_session
    ):
        """Test successfully creating checkout session"""
        mock_get_user.return_value = mock_current_user
        mock_stripe_service.create_checkout_session.return_value = mock_checkout_session

        request_data = {
            'amount': 1000,
            'currency': 'usd',
            'description': '1000 credits',
            'success_url': 'https://app.com/success',
            'cancel_url': 'https://app.com/cancel'
        }

        response = client.post(
            '/api/stripe/checkout-session',
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data['session_id'] == 'cs_test_123456'
        assert data['url'].startswith('https://checkout.stripe.com')
        assert data['amount'] == 1000
        assert data['currency'] == 'usd'

    @patch('src.routes.payments.stripe_service')
    @patch('src.routes.payments.get_current_user')
    def test_create_checkout_session_validation_error(
        self,
        mock_get_user,
        mock_stripe_service,
        client,
        mock_current_user
    ):
        """Test checkout session with validation error"""
        mock_get_user.return_value = mock_current_user
        mock_stripe_service.create_checkout_session.side_effect = ValueError("Invalid amount")

        request_data = {
            'amount': -1000,
            'currency': 'usd'
        }

        response = client.post(
            '/api/stripe/checkout-session',
            json=request_data
        )

        assert response.status_code == 400

    @patch('src.routes.payments.stripe_service')
    @patch('src.routes.payments.get_current_user')
    def test_get_checkout_session_success(
        self,
        mock_get_user,
        mock_stripe_service,
        client,
        mock_current_user
    ):
        """Test retrieving checkout session"""
        mock_get_user.return_value = mock_current_user
        mock_stripe_service.retrieve_checkout_session.return_value = {
            'id': 'cs_test_123',
            'payment_status': 'paid',
            'status': 'complete',
            'amount_total': 1000,
            'currency': 'usd',
            'customer_email': 'test@example.com'
        }

        response = client.get('/api/stripe/checkout-session/cs_test_123')

        assert response.status_code == 200
        data = response.json()
        assert data['session_id'] == 'cs_test_123'
        assert data['payment_status'] == 'paid'


# ============================================================
# TEST CLASS: Payment Intents
# ============================================================

class TestPaymentIntents:
    """Test payment intent operations"""

    @patch('src.routes.payments.stripe_service')
    @patch('src.routes.payments.get_current_user')
    def test_create_payment_intent_success(
        self,
        mock_get_user,
        mock_stripe_service,
        client,
        mock_current_user,
        mock_payment_intent
    ):
        """Test successfully creating payment intent"""
        mock_get_user.return_value = mock_current_user
        mock_stripe_service.create_payment_intent.return_value = mock_payment_intent

        request_data = {
            'amount': 2000,
            'currency': 'usd',
            'description': '2000 credits',
            'automatic_payment_methods': True
        }

        response = client.post(
            '/api/stripe/payment-intent',
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data['payment_intent_id'] == 'pi_123456'
        assert 'client_secret' in data
        assert data['amount'] == 2000

    @patch('src.routes.payments.stripe_service')
    @patch('src.routes.payments.get_current_user')
    def test_get_payment_intent_success(
        self,
        mock_get_user,
        mock_stripe_service,
        client,
        mock_current_user
    ):
        """Test retrieving payment intent"""
        mock_get_user.return_value = mock_current_user
        mock_stripe_service.retrieve_payment_intent.return_value = {
            'id': 'pi_123',
            'status': 'succeeded',
            'amount': 1000,
            'currency': 'usd',
            'customer': 'cus_123',
            'payment_method': 'pm_123'
        }

        response = client.get('/api/stripe/payment-intent/pi_123')

        assert response.status_code == 200
        data = response.json()
        assert data['payment_intent_id'] == 'pi_123'
        assert data['status'] == 'succeeded'


# ============================================================
# TEST CLASS: Credit Packages
# ============================================================

class TestCreditPackages:
    """Test credit package listing"""

    @patch('src.routes.payments.stripe_service')
    def test_get_credit_packages_success(
        self,
        mock_stripe_service,
        client
    ):
        """Test getting available credit packages"""
        mock_packages = MagicMock()
        mock_packages.packages = [
            MagicMock(
                id='starter',
                name='Starter Pack',
                credits=1000,
                amount=1000,
                currency=Mock(value='usd'),
                description='Perfect for trying out',
                features=['Feature 1', 'Feature 2'],
                popular=False,
                discount_percentage=0
            ),
            MagicMock(
                id='pro',
                name='Pro Pack',
                credits=10000,
                amount=9000,
                currency=Mock(value='usd'),
                description='Best value',
                features=['Feature 1', 'Feature 2', 'Feature 3'],
                popular=True,
                discount_percentage=10
            )
        ]
        mock_stripe_service.get_credit_packages.return_value = mock_packages

        response = client.get('/api/stripe/credit-packages')

        assert response.status_code == 200
        data = response.json()
        assert len(data['packages']) == 2
        assert data['packages'][0]['id'] == 'starter'
        assert data['packages'][1]['popular'] is True


# ============================================================
# TEST CLASS: Refunds
# ============================================================

class TestRefunds:
    """Test refund operations"""

    @patch('src.routes.payments.stripe_service')
    @patch('src.routes.payments.get_current_user')
    def test_create_refund_as_admin_success(
        self,
        mock_get_user,
        mock_stripe_service,
        client,
        mock_admin_user
    ):
        """Test admin creating refund"""
        mock_get_user.return_value = mock_admin_user

        mock_refund = MagicMock(
            refund_id='re_123',
            payment_intent_id='pi_456',
            amount=1000,
            currency='usd',
            status='succeeded',
            reason='requested_by_customer',
            created_at=datetime.now(timezone.utc)
        )
        mock_stripe_service.create_refund.return_value = mock_refund

        request_data = {
            'payment_intent_id': 'pi_456',
            'amount': 1000,
            'reason': 'requested_by_customer'
        }

        response = client.post(
            '/api/stripe/refund',
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data['refund_id'] == 're_123'
        assert data['amount'] == 1000

    @patch('src.routes.payments.get_current_user')
    def test_create_refund_as_non_admin_fails(
        self,
        mock_get_user,
        client,
        mock_current_user
    ):
        """Test non-admin cannot create refund"""
        mock_get_user.return_value = mock_current_user

        request_data = {
            'payment_intent_id': 'pi_456',
            'amount': 1000
        }

        response = client.post(
            '/api/stripe/refund',
            json=request_data
        )

        assert response.status_code == 403
        assert 'administrator' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Payment History
# ============================================================

class TestPaymentHistory:
    """Test payment history retrieval"""

    @patch('src.routes.payments.get_user_payments')
    @patch('src.routes.payments.get_current_user')
    def test_get_payment_history_success(
        self,
        mock_get_user,
        mock_get_payments,
        client,
        mock_current_user,
        mock_payments
    ):
        """Test getting payment history"""
        mock_get_user.return_value = mock_current_user
        mock_get_payments.return_value = mock_payments

        response = client.get('/api/stripe/payments')

        assert response.status_code == 200
        data = response.json()
        assert len(data['payments']) == 2
        assert data['total'] == 2
        assert data['limit'] == 50
        assert data['offset'] == 0

    @patch('src.routes.payments.get_user_payments')
    @patch('src.routes.payments.get_current_user')
    def test_get_payment_history_with_pagination(
        self,
        mock_get_user,
        mock_get_payments,
        client,
        mock_current_user,
        mock_payments
    ):
        """Test payment history with pagination"""
        mock_get_user.return_value = mock_current_user
        mock_get_payments.return_value = [mock_payments[1]]

        response = client.get('/api/stripe/payments?limit=1&offset=1')

        assert response.status_code == 200
        data = response.json()
        assert data['limit'] == 1
        assert data['offset'] == 1

    @patch('src.routes.payments.get_payment')
    @patch('src.routes.payments.get_current_user')
    def test_get_payment_details_success(
        self,
        mock_get_user,
        mock_get_payment,
        client,
        mock_current_user,
        mock_payments
    ):
        """Test getting specific payment details"""
        mock_get_user.return_value = mock_current_user
        mock_get_payment.return_value = mock_payments[0]

        response = client.get('/api/stripe/payments/1')

        assert response.status_code == 200
        data = response.json()
        assert data['id'] == 1
        assert data['amount'] == 10.00
        assert data['status'] == 'completed'

    @patch('src.routes.payments.get_payment')
    @patch('src.routes.payments.get_current_user')
    def test_get_payment_details_not_found(
        self,
        mock_get_user,
        mock_get_payment,
        client,
        mock_current_user
    ):
        """Test getting non-existent payment"""
        mock_get_user.return_value = mock_current_user
        mock_get_payment.return_value = None

        response = client.get('/api/stripe/payments/999')

        assert response.status_code == 404

    @patch('src.routes.payments.get_payment')
    @patch('src.routes.payments.get_current_user')
    def test_get_payment_details_wrong_user(
        self,
        mock_get_user,
        mock_get_payment,
        client,
        mock_current_user,
        mock_payments
    ):
        """Test accessing another user's payment"""
        mock_get_user.return_value = mock_current_user

        other_user_payment = mock_payments[0].copy()
        other_user_payment['user_id'] = '999'
        mock_get_payment.return_value = other_user_payment

        response = client.get('/api/stripe/payments/1')

        assert response.status_code == 403
        assert 'permission' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestPaymentsIntegration:
    """Test payment workflow integration"""

    @patch('src.routes.payments.stripe_service')
    @patch('src.routes.payments.get_current_user')
    @patch('src.routes.payments.get_user_payments')
    def test_complete_payment_flow(
        self,
        mock_get_payments,
        mock_get_user,
        mock_stripe_service,
        client,
        mock_current_user,
        mock_checkout_session,
        mock_webhook_result,
        mock_payments
    ):
        """Test complete payment workflow"""
        mock_get_user.return_value = mock_current_user
        mock_stripe_service.create_checkout_session.return_value = mock_checkout_session
        mock_stripe_service.handle_webhook.return_value = mock_webhook_result
        mock_get_payments.return_value = mock_payments

        # 1. Create checkout session
        checkout_response = client.post(
            '/api/stripe/checkout-session',
            json={
                'amount': 1000,
                'currency': 'usd',
                'description': '1000 credits',
                'success_url': 'https://app.com/success',
                'cancel_url': 'https://app.com/cancel'
            }
        )
        assert checkout_response.status_code == 200

        # 2. Process webhook (payment completed)
        webhook_response = client.post(
            '/api/stripe/webhook',
            content=b'{"type": "checkout.session.completed"}',
            headers={'stripe-signature': 'test_sig'}
        )
        assert webhook_response.status_code == 200

        # 3. Check payment history
        history_response = client.get('/api/stripe/payments')
        assert history_response.status_code == 200
        assert len(history_response.json()['payments']) == 2
