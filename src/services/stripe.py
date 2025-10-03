#!/usr/bin/.env python3
"""
Stripe Payment Service
Service layer for handling Stripe payment operations
"""

import os
import logging
import stripe
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta

from src.schemas.stripe import (
    StripePaymentStatus,
    StripeCurrency,
    CreateCheckoutSessionRequest,
    CheckoutSessionResponse,
    CreatePaymentIntentRequest,
    PaymentIntentResponse,
    CreateStripeCustomerRequest,
    StripeCustomerResponse,
    CreateRefundRequest,
    RefundResponse,
    StripeWebhookEvent,
    WebhookProcessingResult,
    StripePaymentRecord,
    PaymentHistoryResponse,
    CreditPackage,
    CreditPackagesResponse,
    PaymentSummary,
    StripeErrorResponse,
)
from src.db.payments import (
    create_payment,
    update_payment_status,
    get_payment,
    get_payment_by_stripe_intent,
    get_user_payments,
)
from src.db.users import get_user_by_id, add_credits_to_user
from src.config import Config

logger = logging.getLogger(__name__)


class StripeService:
    """Service class for handling Stripe payment operations"""

    def __init__(self):
        """Initialize Stripe with API key from environment"""
        self.api_key = os.getenv('STRIPE_SECRET_KEY')
        self.webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        self.publishable_key = os.getenv('STRIPE_PUBLISHABLE_KEY')

        if not self.api_key:
            raise ValueError("STRIPE_SECRET_KEY not found in environment variables")

        stripe.api_key = self.api_key

        # Configuration
        self.default_currency = StripeCurrency.USD
        self.min_amount = 50  # $0.50 minimum
        self.max_amount = 99999999  # ~$1M maximum
        self.frontend_url = os.getenv('FRONTEND_URL', 'https://gatewayz.ai')

        logger.info("Stripe service initialized")

    # ==================== Checkout Sessions ====================

    def create_checkout_session(
            self,
            user_id: int,
            request: CreateCheckoutSessionRequest
    ) -> CheckoutSessionResponse:
        """
        Create a Stripe checkout session for hosted payment page

        Args:
            user_id: User ID making the payment
            request: Checkout session request details

        Returns:
            CheckoutSessionResponse with session details
        """
        try:
            # Get user details
            user = get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")

            # Create payment record in database first
            payment = create_payment(
                user_id=user_id,
                amount=request.amount / 100,  # Convert cents to dollars
                currency=request.currency.value,
                payment_method="stripe",
                status="pending",
                metadata={
                    "description": request.description,
                    **(request.metadata or {})
                }
            )

            if not payment:
                raise Exception("Failed to create payment record")

            # Prepare success and cancel URLs
            success_url = request.success_url or f"{self.frontend_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = request.cancel_url or f"{self.frontend_url}/payment/cancel"

            # Calculate credits (1 cent = 1 credit)
            credits = request.amount

            # Create Stripe checkout session
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': request.currency.value,
                        'unit_amount': request.amount,
                        'product_data': {
                            'name': 'Gatewayz Credits',
                            'description': f'{credits:,} credits for your account',
                            'images': [f'{self.frontend_url}/logo.png'],
                        },
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=success_url,
                cancel_url=cancel_url,
                customer_email=request.customer_email or user.get('email'),
                client_reference_id=str(user_id),
                metadata={
                    'user_id': str(user_id),
                    'payment_id': str(payment['id']),
                    'credits': str(credits),
                    **(request.metadata or {})
                },
                expires_at=int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
            )

            # Update payment with session ID
            update_payment_status(
                payment_id=payment['id'],
                status='pending',
                stripe_payment_intent_id=session.id
            )

            logger.info(f"Checkout session created: {session.id} for user {user_id}")

            return CheckoutSessionResponse(
                session_id=session.id,
                url=session.url,
                payment_id=payment['id'],
                status=StripePaymentStatus.PENDING,
                amount=request.amount,
                currency=request.currency.value,
                expires_at=datetime.fromtimestamp(session.expires_at, tz=timezone.utc)
            )

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            raise Exception(f"Payment processing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            raise

    def retrieve_checkout_session(self, session_id: str) -> Dict[str, Any]:
        """Retrieve checkout session details"""
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return {
                'id': session.id,
                'payment_status': session.payment_status,
                'status': session.status,
                'amount_total': session.amount_total,
                'currency': session.currency,
                'customer_email': session.customer_email,
                'payment_intent': session.payment_intent,
                'metadata': session.metadata
            }
        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving checkout session: {e}")
            raise Exception(f"Failed to retrieve session: {str(e)}")

    # ==================== Payment Intents ====================

    def create_payment_intent(
            self,
            user_id: int,
            request: CreatePaymentIntentRequest
    ) -> PaymentIntentResponse:
        """
        Create a Stripe payment intent for custom payment flows

        Args:
            user_id: User ID making the payment
            request: Payment intent request details

        Returns:
            PaymentIntentResponse with client secret
        """
        try:
            # Get user details
            user = get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")

            # Create payment record
            payment = create_payment(
                user_id=user_id,
                amount=request.amount / 100,
                currency=request.currency.value,
                payment_method="stripe",
                status="pending",
                metadata={
                    "description": request.description,
                    **(request.metadata or {})
                }
            )

            # Prepare payment intent params
            intent_params = {
                'amount': request.amount,
                'currency': request.currency.value,
                'metadata': {
                    'user_id': str(user_id),
                    'payment_id': str(payment['id']),
                    'credits': str(request.amount),
                    **(request.metadata or {})
                },
                'description': request.description,
            }

            # Add automatic payment methods or specific types
            if request.automatic_payment_methods:
                intent_params['automatic_payment_methods'] = {'enabled': True}
            else:
                intent_params['payment_method_types'] = [
                    pm.value for pm in request.payment_method_types
                ]

            # Create payment intent
            intent = stripe.PaymentIntent.create(**intent_params)

            # Update payment with intent ID
            update_payment_status(
                payment_id=payment['id'],
                status='pending',
                stripe_payment_intent_id=intent.id
            )

            logger.info(f"Payment intent created: {intent.id} for user {user_id}")

            return PaymentIntentResponse(
                payment_intent_id=intent.id,
                client_secret=intent.client_secret,
                payment_id=payment['id'],
                status=StripePaymentStatus(intent.status),
                amount=intent.amount,
                currency=intent.currency,
                next_action=intent.next_action
            )

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating payment intent: {e}")
            raise Exception(f"Payment processing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error creating payment intent: {e}")
            raise

    def retrieve_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """Retrieve payment intent details"""
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                'id': intent.id,
                'status': intent.status,
                'amount': intent.amount,
                'currency': intent.currency,
                'customer': intent.customer,
                'payment_method': intent.payment_method,
                'metadata': intent.metadata
            }
        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving payment intent: {e}")
            raise Exception(f"Failed to retrieve payment intent: {str(e)}")

    def cancel_payment_intent(self, payment_intent_id: str) -> bool:
        """Cancel a payment intent"""
        try:
            intent = stripe.PaymentIntent.cancel(payment_intent_id)

            # Update payment in database
            payment = get_payment_by_stripe_intent(payment_intent_id)
            if payment:
                update_payment_status(
                    payment_id=payment['id'],
                    status='canceled'
                )

            logger.info(f"Payment intent canceled: {payment_intent_id}")
            return True
        except stripe.error.StripeError as e:
            logger.error(f"Error canceling payment intent: {e}")
            return False

    # ==================== Customers ====================

    def create_customer(
            self,
            user_id: int,
            request: CreateStripeCustomerRequest
    ) -> StripeCustomerResponse:
        """Create a Stripe customer"""
        try:
            customer = stripe.Customer.create(
                email=request.email,
                name=request.name,
                phone=request.phone,
                description=request.description or f"Gatewayz User {user_id}",
                metadata={
                    'user_id': str(user_id),
                    **(request.metadata or {})
                }
            )

            logger.info(f"Stripe customer created: {customer.id} for user {user_id}")

            return StripeCustomerResponse(
                customer_id=customer.id,
                email=customer.email,
                name=customer.name,
                created_at=datetime.fromtimestamp(customer.created, tz=timezone.utc),
                metadata=customer.metadata
            )

        except stripe.error.StripeError as e:
            logger.error(f"Error creating Stripe customer: {e}")
            raise Exception(f"Failed to create customer: {str(e)}")

    def retrieve_customer(self, customer_id: str) -> Dict[str, Any]:
        """Retrieve customer details"""
        try:
            customer = stripe.Customer.retrieve(customer_id)
            return {
                'id': customer.id,
                'email': customer.email,
                'name': customer.name,
                'phone': customer.phone,
                'metadata': customer.metadata,
                'created': customer.created
            }
        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving customer: {e}")
            raise Exception(f"Failed to retrieve customer: {str(e)}")

    # ==================== Refunds ====================

    def create_refund(self, request: CreateRefundRequest) -> RefundResponse:
        """Create a refund for a payment"""
        try:
            # Get payment from database
            payment = get_payment_by_stripe_intent(request.payment_intent_id)
            if not payment:
                raise ValueError(f"Payment not found for intent: {request.payment_intent_id}")

            # Create refund params
            refund_params = {
                'payment_intent': request.payment_intent_id,
                'metadata': request.metadata or {}
            }

            if request.amount:
                refund_params['amount'] = request.amount

            if request.reason:
                refund_params['reason'] = request.reason

            # Create refund
            refund = stripe.Refund.create(**refund_params)

            # Update payment status
            update_payment_status(
                payment_id=payment['id'],
                status='refunded' if refund.status == 'succeeded' else 'pending'
            )

            # Deduct credits from user if refund successful
            if refund.status == 'succeeded':
                credits_to_deduct = refund.amount  # 1 cent = 1 credit
                # Note: Implement credit deduction logic as needed
                logger.info(f"Refund processed: {refund.id}, credits to deduct: {credits_to_deduct}")

            logger.info(f"Refund created: {refund.id} for payment {payment['id']}")

            return RefundResponse(
                refund_id=refund.id,
                payment_intent_id=refund.payment_intent,
                amount=refund.amount,
                currency=refund.currency,
                status=refund.status,
                reason=refund.reason,
                created_at=datetime.fromtimestamp(refund.created, tz=timezone.utc)
            )

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating refund: {e}")
            raise Exception(f"Refund processing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error creating refund: {e}")
            raise

    # ==================== Webhooks ====================

    def handle_webhook(
            self,
            payload: bytes,
            signature: str
    ) -> WebhookProcessingResult:
        """
        Handle Stripe webhook events

        Args:
            payload: Raw webhook payload
            signature: Stripe signature header

        Returns:
            WebhookProcessingResult with processing details
        """
        if not self.webhook_secret:
            raise ValueError("STRIPE_WEBHOOK_SECRET not configured")

        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )

            event_type = event['type']
            event_id = event['id']

            logger.info(f"Received webhook event: {event_type} ({event_id})")

            # Route to appropriate handler
            handlers = {
                'checkout.session.completed': self._handle_checkout_completed,
                'checkout.session.expired': self._handle_checkout_expired,
                'payment_intent.succeeded': self._handle_payment_succeeded,
                'payment_intent.payment_failed': self._handle_payment_failed,
                'payment_intent.canceled': self._handle_payment_canceled,
                'charge.refunded': self._handle_charge_refunded,
            }

            handler = handlers.get(event_type)

            if handler:
                result = handler(event['data']['object'])
                return WebhookProcessingResult(
                    success=True,
                    event_type=event_type,
                    event_id=event_id,
                    processed_at=datetime.now(timezone.utc),
                    message=f"Event {event_type} processed successfully",
                    **result
                )
            else:
                logger.info(f"Unhandled event type: {event_type}")
                return WebhookProcessingResult(
                    success=True,
                    event_type=event_type,
                    event_id=event_id,
                    processed_at=datetime.now(timezone.utc),
                    message=f"Event {event_type} ignored (no handler)"
                )

        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            raise Exception("Invalid signature")

        except Exception as e:
            logger.error(f"Error handling webhook: {e}")
            raise

    def _handle_checkout_completed(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """Handle successful checkout session completion"""
        try:
            session_id = session['id']
            payment_intent_id = session.get('payment_intent')
            user_id = int(session['metadata']['user_id'])
            payment_id = int(session['metadata']['payment_id'])
            amount = session['amount_total']

            # Update payment status
            update_payment_status(
                payment_id=payment_id,
                status='completed',
                stripe_payment_intent_id=payment_intent_id
            )

            # Convert cents to credits (1 cent = 1 credit)
            credits_to_add = amount

            # Add credits to user account
            add_credits_to_user(user_id, credits_to_add / 100)  # Convert to dollars

            logger.info(f"Checkout completed: Added {credits_to_add} credits to user {user_id}")

            return {
                'user_id': user_id,
                'payment_id': payment_id,
                'credits_added': credits_to_add
            }

        except Exception as e:
            logger.error(f"Error handling checkout completion: {e}")
            raise

    def _handle_checkout_expired(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """Handle expired checkout session"""
        try:
            payment_id = int(session['metadata']['payment_id'])

            update_payment_status(
                payment_id=payment_id,
                status='canceled',
                error_message='Checkout session expired'
            )

            logger.info(f"Checkout expired for payment {payment_id}")

            return {'payment_id': payment_id}

        except Exception as e:
            logger.error(f"Error handling checkout expiration: {e}")
            raise

    def _handle_payment_succeeded(self, payment_intent: Dict[str, Any]) -> Dict[str, Any]:
        """Handle successful payment intent"""
        try:
            intent_id = payment_intent['id']

            payment = get_payment_by_stripe_intent(intent_id)

            if not payment:
                logger.warning(f"Payment not found for intent: {intent_id}")
                return {}

            # Update payment status
            update_payment_status(
                payment_id=payment['id'],
                status='completed'
            )

            # Add credits to user
            credits_to_add = payment_intent['amount']
            add_credits_to_user(payment['user_id'], credits_to_add / 100)

            logger.info(f"Payment succeeded: Added {credits_to_add} credits to user {payment['user_id']}")

            return {
                'user_id': payment['user_id'],
                'payment_id': payment['id'],
                'credits_added': credits_to_add
            }

        except Exception as e:
            logger.error(f"Error handling payment success: {e}")
            raise

    def _handle_payment_failed(self, payment_intent: Dict[str, Any]) -> Dict[str, Any]:
        """Handle failed payment intent"""
        try:
            intent_id = payment_intent['id']
            error_message = payment_intent.get('last_payment_error', {}).get('message', 'Payment failed')

            payment = get_payment_by_stripe_intent(intent_id)

            if not payment:
                logger.warning(f"Payment not found for intent: {intent_id}")
                return {}

            update_payment_status(
                payment_id=payment['id'],
                status='failed',
                error_message=error_message
            )

            logger.warning(f"Payment failed for user {payment['user_id']}: {error_message}")

            return {
                'user_id': payment['user_id'],
                'payment_id': payment['id'],
                'error': error_message
            }

        except Exception as e:
            logger.error(f"Error handling payment failure: {e}")
            raise

    def _handle_payment_canceled(self, payment_intent: Dict[str, Any]) -> Dict[str, Any]:
        """Handle canceled payment intent"""
        try:
            intent_id = payment_intent['id']

            payment = get_payment_by_stripe_intent(intent_id)

            if not payment:
                return {}

            update_payment_status(
                payment_id=payment['id'],
                status='canceled'
            )

            logger.info(f"Payment canceled for user {payment['user_id']}")

            return {'user_id': payment['user_id'], 'payment_id': payment['id']}

        except Exception as e:
            logger.error(f"Error handling payment cancellation: {e}")
            raise

    def _handle_charge_refunded(self, charge: Dict[str, Any]) -> Dict[str, Any]:
        """Handle charge refund"""
        try:
            payment_intent_id = charge.get('payment_intent')

            if not payment_intent_id:
                return {}

            payment = get_payment_by_stripe_intent(payment_intent_id)

            if not payment:
                return {}

            update_payment_status(
                payment_id=payment['id'],
                status='refunded'
            )

            logger.info(f"Charge refunded for payment {payment['id']}")

            return {'user_id': payment['user_id'], 'payment_id': payment['id']}

        except Exception as e:
            logger.error(f"Error handling charge refund: {e}")
            raise

    # ==================== Credit Packages ====================

    def get_credit_packages(self) -> CreditPackagesResponse:
        """Get available credit packages"""
        packages = [
            CreditPackage(
                id="starter",
                name="Starter Pack",
                credits=1000,
                amount=1000,  # $10.00
                currency=StripeCurrency.USD,
                description="Perfect for trying out the platform",
                features=["1,000 credits", "~100,000 tokens", "Valid for 30 days"]
            ),
            CreditPackage(
                id="professional",
                name="Professional Pack",
                credits=5000,
                amount=4500,  # $45.00 (10% discount)
                currency=StripeCurrency.USD,
                discount_percentage=10.0,
                popular=True,
                description="Best value for regular users",
                features=["5,000 credits", "~500,000 tokens", "10% discount", "Valid for 90 days"]
            ),
            CreditPackage(
                id="enterprise",
                name="Enterprise Pack",
                credits=20000,
                amount=16000,  # $160.00 (20% discount)
                currency=StripeCurrency.USD,
                discount_percentage=20.0,
                description="For heavy usage and teams",
                features=["20,000 credits", "~2,000,000 tokens", "20% discount", "Valid for 1 year", "Priority support"]
            ),
        ]

        return CreditPackagesResponse(
            packages=packages,
            currency=StripeCurrency.USD
        )

    # ==================== Payment History ====================

    def get_payment_history(
            self,
            user_id: int,
            limit: int = 50
    ) -> PaymentHistoryResponse:
        """Get user's payment history"""
        try:
            payments = get_user_payments(user_id, limit=limit)

            total_amount = sum(p['amount'] for p in payments if p['status'] == 'completed')

            payment_records = [
                StripePaymentRecord(
                    id=p['id'],
                    user_id=p['user_id'],
                    stripe_payment_intent_id=p.get('stripe_payment_intent_id'),
                    stripe_customer_id=p.get('stripe_customer_id'),
                    amount=int(p['amount'] * 100),  # Convert to cents
                    currency=p['currency'],
                    status=StripePaymentStatus(p['status']),
                    description=p.get('metadata', {}).get('description'),
                    metadata=p.get('metadata', {}),
                    created_at=datetime.fromisoformat(p['created_at'].replace('Z', '+00:00')),
                    updated_at=datetime.fromisoformat(p['updated_at'].replace('Z', '+00:00')) if p.get(
                        'updated_at') else None,
                    error_message=p.get('metadata', {}).get('error')
                )
                for p in payments
            ]

            return PaymentHistoryResponse(
                total_payments=len(payments),
                total_amount=int(total_amount * 100),
                currency='usd',
                payments=payment_records
            )

        except Exception as e:
            logger.error(f"Error getting payment history: {e}")
            raise

    def get_payment_summary(self, user_id: int) -> PaymentSummary:
        """Get payment summary for user"""
        try:
            payments = get_user_payments(user_id, limit=1000)

            successful = [p for p in payments if p['status'] == 'completed']
            failed = [p for p in payments if p['status'] == 'failed']
            refunded = [p for p in payments if p['status'] == 'refunded']

            total_spent = sum(p['amount'] for p in successful)
            refunded_amount = sum(p['amount'] for p in refunded)

            last_payment = max(
                (datetime.fromisoformat(p['created_at'].replace('Z', '+00:00')) for p in successful),
                default=None
            )

            return PaymentSummary(
                total_spent=int(total_spent * 100),
                total_payments=len(payments),
                successful_payments=len(successful),
                failed_payments=len(failed),
                refunded_amount=int(refunded_amount * 100),
                currency=StripeCurrency.USD,
                last_payment_date=last_payment,
                lifetime_credits_purchased=int(total_spent * 100)
            )

        except Exception as e:
            logger.error(f"Error getting payment summary: {e}")
            raise


# Singleton instance
_stripe_service: Optional[StripeService] = None


def get_stripe_service() -> StripeService:
    """Get or create Stripe service instance"""
    global _stripe_service
    if _stripe_service is None:
        _stripe_service = StripeService()
    return _stripe_service