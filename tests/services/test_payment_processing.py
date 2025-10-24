"""
Comprehensive payment processing tests - CRITICAL
Tests Stripe integration for checkout sessions, payment intents, webhooks
"""

import pytest
from unittest.mock import Mock, patch, MagicMock, call
from datetime import datetime, timezone, timedelta
import stripe

from src.services.payments import StripeService
from src.schemas.payments import (
    CreateCheckoutSessionRequest,
    CreatePaymentIntentRequest,
    StripeCurrency,
    StripePaymentMethodType,
    CreateRefundRequest
)


@pytest.fixture
def stripe_service():
    """Create StripeService instance"""
    with patch.dict('os.environ', {
        'STRIPE_SECRET_KEY': 'sk_test_123',
        'STRIPE_WEBHOOK_SECRET': 'whsec_test_123',
        'STRIPE_PUBLISHABLE_KEY': 'pk_test_123',
        'FRONTEND_URL': 'https://test.gatewayz.ai'
    }):
        return StripeService()


@pytest.fixture
def mock_user():
    """Mock user data"""
    return {
        'id': 1,
        'email': 'test@example.com',
        'credits': 100.0,
        'subscription_status': 'active'
    }


@pytest.fixture
def mock_payment():
    """Mock payment record"""
    return {
        'id': 1,
        'user_id': 1,
        'amount': 10.00,
        'currency': 'usd',
        'status': 'pending',
        'payment_method': 'stripe'
    }


class TestStripeServiceInitialization:
    """Test StripeService initialization"""

    def test_init_success(self):
        """Test successful initialization"""
        with patch.dict('os.environ', {
            'STRIPE_SECRET_KEY': 'sk_test_123',
            'STRIPE_WEBHOOK_SECRET': 'whsec_test_123',
            'STRIPE_PUBLISHABLE_KEY': 'pk_test_123'
        }):
            service = StripeService()
            assert service.api_key == 'sk_test_123'
            assert service.webhook_secret == 'whsec_test_123'
            assert service.min_amount == 50  # $0.50 minimum
            assert service.max_amount == 99999999

    def test_init_missing_api_key(self):
        """Test initialization fails without API key"""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError, match="STRIPE_SECRET_KEY not found"):
                StripeService()


class TestCheckoutSession:
    """Test checkout session creation"""

    @patch('src.services.payments.get_user_by_id')
    @patch('src.services.payments.create_payment')
    @patch('stripe.checkout.Session.create')
    @patch('src.services.payments.update_payment_status')
    def test_create_checkout_session_success(
        self,
        mock_update_payment,
        mock_stripe_create,
        mock_create_payment,
        mock_get_user,
        stripe_service,
        mock_user,
        mock_payment
    ):
        """Test successful checkout session creation"""

        mock_get_user.return_value = mock_user
        mock_create_payment.return_value = mock_payment

        # Mock Stripe session
        mock_session = Mock()
        mock_session.id = 'cs_test_123'
        mock_session.url = 'https://checkout.stripe.com/pay/cs_test_123'
        mock_session.expires_at = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
        mock_stripe_create.return_value = mock_session

        # Create request
        request = CreateCheckoutSessionRequest(
            amount=1000,  # $10.00 in cents
            currency=StripeCurrency.USD,
            description="Test purchase",
            customer_email="test@example.com"
        )

        # Execute
        response = stripe_service.create_checkout_session(
            user_id=1,
            request=request
        )

        # Verify
        assert response.session_id == 'cs_test_123'
        assert response.url == 'https://checkout.stripe.com/pay/cs_test_123'
        assert response.payment_id == 1
        assert response.amount == 1000

        # Verify Stripe was called correctly
        mock_stripe_create.assert_called_once()
        call_kwargs = mock_stripe_create.call_args[1]
        assert call_kwargs['line_items'][0]['price_data']['unit_amount'] == 1000
        assert call_kwargs['customer_email'] == 'test@example.com'
        assert call_kwargs['metadata']['user_id'] == '1'
        assert call_kwargs['metadata']['credits'] == '1000'

    @patch('src.services.payments.get_user_by_id')
    def test_create_checkout_session_user_not_found(self, mock_get_user, stripe_service):
        """Test checkout session fails for non-existent user"""

        mock_get_user.return_value = None

        request = CreateCheckoutSessionRequest(
            amount=1000,
            currency=StripeCurrency.USD
        )

        with pytest.raises(ValueError, match="User .* not found"):
            stripe_service.create_checkout_session(user_id=999, request=request)

    @patch('src.services.payments.get_user_by_id')
    @patch('src.services.payments.create_payment')
    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session_stripe_error(
        self,
        mock_stripe_create,
        mock_create_payment,
        mock_get_user,
        stripe_service,
        mock_user,
        mock_payment
    ):
        """Test checkout session handles Stripe errors"""

        mock_get_user.return_value = mock_user
        mock_create_payment.return_value = mock_payment
        mock_stripe_create.side_effect = stripe.StripeError("Card declined")

        request = CreateCheckoutSessionRequest(
            amount=1000,
            currency=StripeCurrency.USD
        )

        with pytest.raises(Exception, match="Payment processing error"):
            stripe_service.create_checkout_session(user_id=1, request=request)

    @patch('src.services.payments.get_user_by_id')
    @patch('src.services.payments.create_payment')
    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session_with_privy_did(
        self,
        mock_stripe_create,
        mock_create_payment,
        mock_get_user,
        stripe_service,
        mock_payment
    ):
        """Test checkout session handles Privy DID emails"""

        # User with Privy DID as email
        privy_user = {
            'id': 1,
            'email': 'did:privy:abc123',
            'credits': 100.0
        }

        mock_get_user.return_value = privy_user
        mock_create_payment.return_value = mock_payment

        mock_session = Mock()
        mock_session.id = 'cs_test_123'
        mock_session.url = 'https://checkout.stripe.com/pay/cs_test_123'
        mock_session.expires_at = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
        mock_stripe_create.return_value = mock_session

        request = CreateCheckoutSessionRequest(
            amount=1000,
            currency=StripeCurrency.USD,
            customer_email="real@example.com"  # Real email provided
        )

        response = stripe_service.create_checkout_session(user_id=1, request=request)

        assert response.session_id == 'cs_test_123'
        # Should use provided customer_email
        call_kwargs = mock_stripe_create.call_args[1]
        assert call_kwargs['customer_email'] == 'real@example.com'


class TestPaymentIntents:
    """Test payment intent creation"""

    @patch('src.services.payments.get_user_by_id')
    @patch('src.services.payments.create_payment')
    @patch('stripe.PaymentIntent.create')
    @patch('src.services.payments.update_payment_status')
    def test_create_payment_intent_success(
        self,
        mock_update_payment,
        mock_stripe_create,
        mock_create_payment,
        mock_get_user,
        stripe_service,
        mock_user,
        mock_payment
    ):
        """Test successful payment intent creation"""

        mock_get_user.return_value = mock_user
        mock_create_payment.return_value = mock_payment

        # Mock Stripe payment intent
        mock_intent = Mock()
        mock_intent.id = 'pi_test_123'
        mock_intent.client_secret = 'pi_test_123_secret_abc'
        mock_intent.status = 'requires_payment_method'
        mock_intent.amount = 1000
        mock_intent.currency = 'usd'
        mock_intent.next_action = None
        mock_stripe_create.return_value = mock_intent

        request = CreatePaymentIntentRequest(
            amount=1000,
            currency=StripeCurrency.USD,
            description="Test payment",
            automatic_payment_methods=True
        )

        response = stripe_service.create_payment_intent(user_id=1, request=request)

        assert response.payment_intent_id == 'pi_test_123'
        assert response.client_secret == 'pi_test_123_secret_abc'
        assert response.amount == 1000

        # Verify Stripe was called correctly
        call_kwargs = mock_stripe_create.call_args[1]
        assert call_kwargs['amount'] == 1000
        assert call_kwargs['currency'] == 'usd'
        assert call_kwargs['automatic_payment_methods'] == {'enabled': True}
        assert call_kwargs['metadata']['user_id'] == '1'

    @patch('src.services.payments.get_user_by_id')
    @patch('src.services.payments.create_payment')
    @patch('stripe.PaymentIntent.create')
    def test_create_payment_intent_with_specific_payment_methods(
        self,
        mock_stripe_create,
        mock_create_payment,
        mock_get_user,
        stripe_service,
        mock_user,
        mock_payment
    ):
        """Test payment intent with specific payment methods"""

        mock_get_user.return_value = mock_user
        mock_create_payment.return_value = mock_payment

        mock_intent = Mock()
        mock_intent.id = 'pi_test_123'
        mock_intent.client_secret = 'pi_test_123_secret'
        mock_intent.status = 'requires_payment_method'
        mock_intent.amount = 1000
        mock_intent.currency = 'usd'
        mock_intent.next_action = None
        mock_stripe_create.return_value = mock_intent

        request = CreatePaymentIntentRequest(
            amount=1000,
            currency=StripeCurrency.USD,
            payment_method_types=[StripePaymentMethodType.CARD],
            automatic_payment_methods=False
        )

        response = stripe_service.create_payment_intent(user_id=1, request=request)

        # Verify payment_method_types was used
        call_kwargs = mock_stripe_create.call_args[1]
        assert 'payment_method_types' in call_kwargs
        assert call_kwargs['payment_method_types'] == ['card']


class TestWebhooks:
    """Test webhook processing"""

    @patch('stripe.Webhook.construct_event')
    @patch.object(StripeService, '_handle_checkout_completed')
    def test_handle_checkout_completed_webhook(
        self,
        mock_handle_checkout,
        mock_construct_event,
        stripe_service
    ):
        """Test checkout.session.completed webhook"""

        mock_event = {
            'id': 'evt_test_123',
            'type': 'checkout.session.completed',
            'data': {
                'object': {'id': 'cs_test_123'}
            }
        }
        mock_construct_event.return_value = mock_event

        payload = b'test_payload'
        signature = 'test_signature'

        result = stripe_service.handle_webhook(payload, signature)

        assert result.success is True
        assert result.event_type == 'checkout.session.completed'
        assert result.event_id == 'evt_test_123'
        mock_handle_checkout.assert_called_once_with({'id': 'cs_test_123'})

    @patch('stripe.Webhook.construct_event')
    def test_handle_webhook_invalid_signature(
        self,
        mock_construct_event,
        stripe_service
    ):
        """Test webhook with invalid signature"""

        mock_construct_event.side_effect = ValueError("Invalid signature")

        with pytest.raises(ValueError, match="Invalid signature"):
            stripe_service.handle_webhook(b'payload', 'bad_signature')

    @patch('stripe.Webhook.construct_event')
    @patch('src.services.payments.add_credits_to_user')
    @patch('src.services.payments.update_payment_status')
    def test_checkout_completed_adds_credits(
        self,
        mock_update_payment,
        mock_add_credits,
        mock_construct_event,
        stripe_service
    ):
        """Test checkout completed webhook adds credits to user"""

        mock_session = {
            'id': 'cs_test_123',
            'payment_intent': 'pi_test_123',
            'metadata': {
                'user_id': '1',
                'credits': '1000',  # 1000 cents = $10
                'payment_id': '1'
            }
        }

        mock_event = {
            'id': 'evt_test_123',
            'type': 'checkout.session.completed',
            'data': {'object': mock_session}
        }
        mock_construct_event.return_value = mock_event

        result = stripe_service.handle_webhook(b'payload', 'signature')

        # Verify credits were added (1000 cents / 100 = $10)
        mock_add_credits.assert_called_once()
        call_args = mock_add_credits.call_args[1]
        assert call_args['user_id'] == 1
        assert call_args['credits'] == 10.0  # $10
        assert call_args['transaction_type'] == 'purchase'

        # Verify payment updated
        mock_update_payment.assert_called_once_with(
            payment_id=1,
            status='completed',
            stripe_payment_intent_id='pi_test_123'
        )

    @patch('stripe.Webhook.construct_event')
    @patch('src.services.payments.get_payment_by_stripe_intent')
    @patch('src.services.payments.update_payment_status')
    @patch('src.services.payments.add_credits_to_user')
    def test_payment_intent_succeeded_webhook(
        self,
        mock_add_credits,
        mock_update_payment,
        mock_get_payment,
        mock_construct_event,
        stripe_service
    ):
        """Test payment_intent.succeeded webhook"""

        mock_get_payment.return_value = {
            'id': 1,
            'user_id': 1,
            'amount': 10.0,
            'status': 'pending'
        }

        mock_event = {
            'id': 'evt_test_123',
            'type': 'payment_intent.succeeded',
            'data': {
                'object': {'id': 'pi_test_123'}
            }
        }
        mock_construct_event.return_value = mock_event

        result = stripe_service.handle_webhook(b'payload', 'signature')

        assert result.success is True
        mock_update_payment.assert_called_once_with(
            payment_id=1,
            status='completed'
        )
        mock_add_credits.assert_called_once()

    @patch('stripe.Webhook.construct_event')
    @patch('src.services.payments.get_payment_by_stripe_intent')
    @patch('src.services.payments.update_payment_status')
    def test_payment_intent_failed_webhook(
        self,
        mock_update_payment,
        mock_get_payment,
        mock_construct_event,
        stripe_service
    ):
        """Test payment_intent.payment_failed webhook"""

        mock_get_payment.return_value = {
            'id': 1,
            'user_id': 1,
            'amount': 10.0,
            'status': 'pending'
        }

        mock_event = {
            'id': 'evt_test_123',
            'type': 'payment_intent.payment_failed',
            'data': {
                'object': {'id': 'pi_test_123'}
            }
        }
        mock_construct_event.return_value = mock_event

        result = stripe_service.handle_webhook(b'payload', 'signature')

        assert result.success is True
        mock_update_payment.assert_called_once_with(
            payment_id=1,
            status='failed'
        )


class TestCreditPackages:
    """Test credit package listings"""

    def test_get_credit_packages(self, stripe_service):
        """Test get credit packages"""

        response = stripe_service.get_credit_packages()

        assert len(response.packages) >= 2
        assert response.currency == StripeCurrency.USD

        # Check starter pack
        starter = next((p for p in response.packages if p.id == "starter"), None)
        assert starter is not None
        assert starter.credits == 1000
        assert starter.amount == 1000

        # Check professional pack
        pro = next((p for p in response.packages if p.id == "professional"), None)
        assert pro is not None
        assert pro.credits == 5000
        assert pro.amount == 4500
        assert pro.discount_percentage == 10.0
        assert pro.popular is True


class TestRefunds:
    """Test refund processing"""

    @patch('stripe.Refund.create')
    def test_create_refund_success(self, mock_stripe_refund, stripe_service):
        """Test successful refund creation"""

        mock_refund = Mock()
        mock_refund.id = 're_test_123'
        mock_refund.payment_intent = 'pi_test_123'
        mock_refund.amount = 1000
        mock_refund.currency = 'usd'
        mock_refund.status = 'succeeded'
        mock_refund.reason = 'requested_by_customer'
        mock_refund.created = int(datetime.now(timezone.utc).timestamp())
        mock_stripe_refund.return_value = mock_refund

        request = CreateRefundRequest(
            payment_intent_id='pi_test_123',
            amount=1000,
            reason='requested_by_customer'
        )

        response = stripe_service.create_refund(request)

        assert response.refund_id == 're_test_123'
        assert response.payment_intent_id == 'pi_test_123'
        assert response.amount == 1000
        assert response.status == 'succeeded'

    @patch('stripe.Refund.create')
    def test_create_refund_stripe_error(self, mock_stripe_refund, stripe_service):
        """Test refund handles Stripe errors"""

        mock_stripe_refund.side_effect = stripe.StripeError("Refund failed")

        request = CreateRefundRequest(
            payment_intent_id='pi_test_123',
            amount=1000,
            reason='requested_by_customer'
        )

        with pytest.raises(Exception, match="Refund failed"):
            stripe_service.create_refund(request)


class TestSessionRetrieval:
    """Test session and intent retrieval"""

    @patch('stripe.checkout.Session.retrieve')
    def test_retrieve_checkout_session(self, mock_retrieve, stripe_service):
        """Test retrieve checkout session"""

        mock_session = Mock()
        mock_session.id = 'cs_test_123'
        mock_session.payment_status = 'paid'
        mock_session.status = 'complete'
        mock_session.amount_total = 1000
        mock_session.currency = 'usd'
        mock_session.customer_email = 'test@example.com'
        mock_session.payment_intent = 'pi_test_123'
        mock_session.metadata = {'user_id': '1'}
        mock_retrieve.return_value = mock_session

        result = stripe_service.retrieve_checkout_session('cs_test_123')

        assert result['id'] == 'cs_test_123'
        assert result['payment_status'] == 'paid'
        assert result['amount_total'] == 1000

    @patch('stripe.PaymentIntent.retrieve')
    def test_retrieve_payment_intent(self, mock_retrieve, stripe_service):
        """Test retrieve payment intent"""

        mock_intent = Mock()
        mock_intent.id = 'pi_test_123'
        mock_intent.status = 'succeeded'
        mock_intent.amount = 1000
        mock_intent.currency = 'usd'
        mock_intent.customer = 'cus_test_123'
        mock_intent.payment_method = 'pm_test_123'
        mock_intent.metadata = {'user_id': '1'}
        mock_retrieve.return_value = mock_intent

        result = stripe_service.retrieve_payment_intent('pi_test_123')

        assert result['id'] == 'pi_test_123'
        assert result['status'] == 'succeeded'
        assert result['amount'] == 1000


@pytest.mark.integration
class TestPaymentIntegration:
    """Integration tests for complete payment flows"""

    @patch('src.services.payments.get_user_by_id')
    @patch('src.services.payments.create_payment')
    @patch('stripe.checkout.Session.create')
    @patch('src.services.payments.update_payment_status')
    @patch('stripe.Webhook.construct_event')
    @patch('src.services.payments.add_credits_to_user')
    def test_complete_payment_flow(
        self,
        mock_add_credits,
        mock_construct_event,
        mock_update_payment,
        mock_stripe_create,
        mock_create_payment,
        mock_get_user,
        stripe_service,
        mock_user,
        mock_payment
    ):
        """Test complete payment flow: create session → webhook → credits added"""

        # Step 1: Create checkout session
        mock_get_user.return_value = mock_user
        mock_create_payment.return_value = mock_payment

        mock_session = Mock()
        mock_session.id = 'cs_test_123'
        mock_session.url = 'https://checkout.stripe.com/pay/cs_test_123'
        mock_session.expires_at = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
        mock_stripe_create.return_value = mock_session

        request = CreateCheckoutSessionRequest(
            amount=1000,
            currency=StripeCurrency.USD,
            customer_email="test@example.com"
        )

        session_response = stripe_service.create_checkout_session(user_id=1, request=request)
        assert session_response.session_id == 'cs_test_123'

        # Step 2: Process webhook (customer completed payment)
        mock_event = {
            'id': 'evt_test_123',
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'id': 'cs_test_123',
                    'payment_intent': 'pi_test_123',
                    'metadata': {
                        'user_id': '1',
                        'credits': '1000',
                        'payment_id': '1'
                    }
                }
            }
        }
        mock_construct_event.return_value = mock_event

        webhook_result = stripe_service.handle_webhook(b'payload', 'signature')

        # Verify credits were added
        assert webhook_result.success is True
        mock_add_credits.assert_called_once()
        assert mock_add_credits.call_args[1]['credits'] == 10.0  # $10
