#!/usr/bin/env python3
"""
Stripe Service
Handles all Stripe payment operations
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import stripe

from src.db.payments import create_payment, get_payment_by_stripe_intent, update_payment_status
from src.db.users import add_credits_to_user, get_user_by_id
from src.db.webhook_events import is_event_processed, record_processed_event
from src.db.subscription_products import get_tier_from_product_id, get_credits_from_tier
from src.schemas.payments import (
    CheckoutSessionResponse,
    CreateCheckoutSessionRequest,
    CreatePaymentIntentRequest,
    CreateRefundRequest,
    CreateSubscriptionCheckoutRequest,
    CreditPackage,
    CreditPackagesResponse,
    PaymentIntentResponse,
    PaymentStatus,
    RefundResponse,
    StripeCurrency,
    SubscriptionCheckoutResponse,
    WebhookProcessingResult,
)

# Import Stripe SDK with alias to avoid conflict with schema module


logger = logging.getLogger(__name__)


class StripeService:
    """Service class for handling Stripe payment operations"""

    def __init__(self):
        """Initialize Stripe with API key from environment"""
        self.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        self.publishable_key = os.getenv("STRIPE_PUBLISHABLE_KEY")

        if not self.api_key:
            raise ValueError("STRIPE_SECRET_KEY not found in environment variables")

        # Validate webhook secret is configured for security
        if not self.webhook_secret:
            logger.warning(
                "STRIPE_WEBHOOK_SECRET not configured - webhook signature validation will fail"
            )

        # Set Stripe API key
        stripe.api_key = self.api_key

        # Configuration
        self.default_currency = StripeCurrency.USD
        self.min_amount = 50  # $0.50 minimum
        self.max_amount = 99999999  # ~$1M maximum
        self.frontend_url = os.getenv("FRONTEND_URL", "https://gatewayz.ai")

        logger.info("Stripe service initialized")

    # ==================== Checkout Sessions ====================

    def create_checkout_session(
        self, user_id: int, request: CreateCheckoutSessionRequest
    ) -> CheckoutSessionResponse:
        """Create a Stripe checkout session"""
        try:
            # Get user details
            user = get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")

            # Extract real email if stored email is a Privy DID
            user_email = user.get("email", "")
            if user_email.startswith("did:privy:"):
                logger.warning(f"User {user_id} has Privy DID as email: {user_email}")
                # Try to get email from Privy linked accounts via Supabase
                from src.config.supabase_config import get_supabase_client

                client = get_supabase_client()
                user_result = (
                    client.table("users").select("privy_user_id").eq("id", user_id).execute()
                )
                if user_result.data and user_result.data[0].get("privy_user_id"):
                    privy_user_id = user_result.data[0]["privy_user_id"]
                    logger.info(f"Found privy_user_id for user {user_id}: {privy_user_id}")
                    # For now, use request.customer_email if available, otherwise generic email
                    if request.customer_email:
                        user_email = request.customer_email
                    else:
                        # If no customer_email in request, we can't get real email without Privy token
                        user_email = None
                        logger.warning(
                            f"No customer_email in request for user {user_id} with Privy DID"
                        )
                else:
                    user_email = None

            # Create payment record
            payment = create_payment(
                user_id=user_id,
                amount=request.amount / 100,  # Convert cents to dollars
                currency=request.currency.value,
                payment_method="stripe",
                status="pending",
                metadata={"description": request.description, **(request.metadata or {})},
            )

            if not payment:
                raise Exception("Failed to create payment record")

            # Prepare URLs - ALWAYS use request URLs if provided
            success_url = (
                request.success_url
                if request.success_url
                else f"{self.frontend_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
            )
            cancel_url = (
                request.cancel_url if request.cancel_url else f"{self.frontend_url}/payment/cancel"
            )

            logger.info("=== CHECKOUT SESSION URL DEBUG ===")
            logger.info(f"Frontend URL from env: {self.frontend_url}")
            logger.info(f"Request success_url: {request.success_url}")
            logger.info(f"Request cancel_url: {request.cancel_url}")
            logger.info(f"Final success_url being sent to Stripe: {success_url}")
            logger.info(f"Final cancel_url being sent to Stripe: {cancel_url}")
            logger.info("=== END URL DEBUG ===")

            # Calculate credits
            credits = request.amount

            # Create Stripe checkout session
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price_data": {
                            "currency": request.currency.value,
                            "unit_amount": request.amount,
                            "product_data": {
                                "name": "Gatewayz Credits",
                                "description": f"{credits:,} credits for your account",
                            },
                        },
                        "quantity": 1,
                    }
                ],
                mode="payment",
                success_url=success_url,
                cancel_url=cancel_url,
                customer_email=request.customer_email or user_email,
                client_reference_id=str(user_id),
                metadata={
                    "user_id": str(user_id),
                    "payment_id": str(payment["id"]),
                    "credits": str(credits),
                    **(request.metadata or {}),
                },
                expires_at=int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()),
            )

            # Update payment with session ID
            update_payment_status(
                payment_id=payment["id"], status="pending", stripe_payment_intent_id=session.id
            )

            logger.info(f"Checkout session created: {session.id} for user {user_id}")

            return CheckoutSessionResponse(
                session_id=session.id,
                url=session.url,
                payment_id=payment["id"],
                status=PaymentStatus.PENDING,
                amount=request.amount,
                currency=request.currency.value,
                expires_at=datetime.fromtimestamp(session.expires_at, tz=timezone.utc),
            )

        except stripe.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            raise Exception(f"Payment processing error: {str(e)}") from e

        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            raise

    def retrieve_checkout_session(self, session_id: str) -> Dict[str, Any]:
        """Retrieve checkout session details"""
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return {
                "id": session.id,
                "payment_status": session.payment_status,
                "status": session.status,
                "amount_total": session.amount_total,
                "currency": session.currency,
                "customer_email": session.customer_email,
                "payment_intent": session.payment_intent,
                "metadata": session.metadata,
            }
        except stripe.StripeError as e:
            logger.error(f"Error retrieving checkout session: {e}")
            raise Exception(f"Failed to retrieve session: {str(e)}") from e

    # ==================== Payment Intents ====================

    def create_payment_intent(
        self, user_id: int, request: CreatePaymentIntentRequest
    ) -> PaymentIntentResponse:
        """Create a Stripe payment intent"""
        try:
            user = get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")

            payment = create_payment(
                user_id=user_id,
                amount=request.amount / 100,
                currency=request.currency.value,
                payment_method="stripe",
                status="pending",
                metadata={"description": request.description, **(request.metadata or {})},
            )

            intent_params = {
                "amount": request.amount,
                "currency": request.currency.value,
                "metadata": {
                    "user_id": str(user_id),
                    "payment_id": str(payment["id"]),
                    "credits": str(request.amount),
                    **(request.metadata or {}),
                },
                "description": request.description,
            }

            if request.automatic_payment_methods:
                intent_params["automatic_payment_methods"] = {"enabled": True}
            else:
                intent_params["payment_method_types"] = [
                    pm.value for pm in request.payment_method_types
                ]

            intent = stripe.PaymentIntent.create(**intent_params)

            update_payment_status(
                payment_id=payment["id"], status="pending", stripe_payment_intent_id=intent.id
            )

            logger.info(f"Payment intent created: {intent.id} for user {user_id}")

            return PaymentIntentResponse(
                payment_intent_id=intent.id,
                client_secret=intent.client_secret,
                payment_id=payment["id"],
                status=PaymentStatus(intent.status),
                amount=intent.amount,
                currency=intent.currency,
                next_action=intent.next_action,
            )

        except stripe.StripeError as e:
            logger.error(f"Stripe error creating payment intent: {e}")
            raise Exception(f"Payment processing error: {str(e)}") from e

        except Exception as e:
            logger.error(f"Error creating payment intent: {e}")
            raise

    def retrieve_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """Retrieve payment intent details"""
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                "id": intent.id,
                "status": intent.status,
                "amount": intent.amount,
                "currency": intent.currency,
                "customer": intent.customer,
                "payment_method": intent.payment_method,
                "metadata": intent.metadata,
            }
        except stripe.StripeError as e:
            logger.error(f"Error retrieving payment intent: {e}")
            raise Exception(f"Failed to retrieve payment intent: {str(e)}") from e

    # ==================== Webhooks ====================

    def handle_webhook(self, payload: bytes, signature: str) -> WebhookProcessingResult:
        """Handle Stripe webhook events with secure signature validation and deduplication"""
        # Validate webhook secret is configured
        if not self.webhook_secret:
            logger.error("Webhook secret not configured - rejecting webhook")
            raise ValueError("Webhook secret not configured")
        # Validate signature is provided
        if not signature:
            logger.error("Missing webhook signature")
            raise ValueError("Missing webhook signature")
        try:
            # Use Stripe's built-in signature verification (constant-time comparison)
            event = stripe.Webhook.construct_event(payload, signature, self.webhook_secret)

            logger.info(f"Processing webhook: {event['type']} (ID: {event['id']})")

            # Check for duplicate event (idempotency)
            if is_event_processed(event["id"]):
                logger.warning(f"Duplicate webhook event detected, skipping: {event['id']}")
                return WebhookProcessingResult(
                    success=True,
                    event_type=event["type"],
                    event_id=event["id"],
                    message=f"Event {event['id']} already processed (duplicate)",
                    processed_at=datetime.now(timezone.utc),
                )

            # Extract user_id from event metadata if available
            user_id = None
            try:
                event_obj = event["data"]["object"]
                if event_obj.get("metadata"):
                    user_id_str = event_obj["metadata"].get("user_id")
                    if user_id_str:
                        user_id = int(user_id_str)
            except (AttributeError, ValueError, TypeError, KeyError):
                pass

            # Record event as processed immediately after duplicate check to ensure
            # idempotency even if handlers raise exceptions. This prevents duplicate
            # processing when Stripe retries the webhook.
            record_processed_event(
                event_id=event["id"],
                event_type=event["type"],
                user_id=user_id,
                metadata={"stripe_account": event.get("account")}
            )

            # One-time payment events
            if event["type"] == "checkout.session.completed":
                self._handle_checkout_completed(event["data"]["object"])
            elif event["type"] == "payment_intent.succeeded":
                self._handle_payment_succeeded(event["data"]["object"])
            elif event["type"] == "payment_intent.payment_failed":
                self._handle_payment_failed(event["data"]["object"])

            # Subscription events
            elif event["type"] == "customer.subscription.created":
                self._handle_subscription_created(event["data"]["object"])
            elif event["type"] == "customer.subscription.updated":
                self._handle_subscription_updated(event["data"]["object"])
            elif event["type"] == "customer.subscription.deleted":
                self._handle_subscription_deleted(event["data"]["object"])
            elif event["type"] == "invoice.paid":
                self._handle_invoice_paid(event["data"]["object"])
            elif event["type"] == "invoice.payment_failed":
                self._handle_invoice_payment_failed(event["data"]["object"])

            return WebhookProcessingResult(
                success=True,
                event_type=event["type"],
                event_id=event["id"],
                message=f"Event {event['type']} processed successfully",
                processed_at=datetime.now(timezone.utc),
            )

        except ValueError as e:
            logger.error(f"Invalid webhook signature: {e}")
            raise

        except Exception as e:
            logger.error(f"Webhook processing error: {e}")
            raise

    def _handle_checkout_completed(self, session):
        """Handle completed checkout session"""
        try:
            user_id = int(session.metadata.get("user_id"))
            credits = float(session.metadata.get("credits"))
            payment_id = int(session.metadata.get("payment_id"))
            amount_dollars = credits / 100  # Convert cents to dollars

            # Add credits and log transaction
            add_credits_to_user(
                user_id=user_id,
                credits=amount_dollars,
                transaction_type="purchase",
                description=f"Stripe checkout - ${amount_dollars}",
                payment_id=payment_id,
                metadata={
                    "stripe_session_id": session.id,
                    "stripe_payment_intent_id": session.payment_intent,
                },
            )

            # Update payment
            update_payment_status(
                payment_id=payment_id,
                status="completed",
                stripe_payment_intent_id=session.payment_intent,
            )

            logger.info(f"Checkout completed: Added {amount_dollars} credits to user {user_id}")

            # Check for referral bonus (first purchase of $10+)
            try:
                from src.config.supabase_config import get_supabase_client
                from src.services.referral import apply_referral_bonus, mark_first_purchase

                client = get_supabase_client()
                user_result = client.table("users").select("*").eq("id", user_id).execute()

                if user_result.data:
                    user = user_result.data[0]
                    has_made_first_purchase = user.get("has_made_first_purchase", False)
                    referred_by_code = user.get("referred_by_code")

                    # Apply referral bonus if:
                    # 1. This is first purchase
                    # 2. User was referred by someone
                    # 3. Purchase is $10 or more
                    if not has_made_first_purchase and referred_by_code and amount_dollars >= 10.0:
                        success, error_msg, bonus_data = apply_referral_bonus(
                            user_id=user_id,
                            referral_code=referred_by_code,
                            purchase_amount=amount_dollars,
                        )

                        if success:
                            logger.info(
                                f"Referral bonus applied! User {user_id} and referrer both received "
                                f"${bonus_data['user_bonus']} (code: {referred_by_code})"
                            )
                        else:
                            logger.warning(
                                f"Failed to apply referral bonus for user {user_id}: {error_msg}"
                            )

                    # Mark first purchase regardless of referral
                    if not has_made_first_purchase:
                        mark_first_purchase(user_id)

            except Exception as referral_error:
                # Don't fail the payment if referral bonus fails
                logger.error(f"Error processing referral bonus: {referral_error}", exc_info=True)

        except Exception as e:
            logger.error(f"Error handling checkout completed: {e}")
            raise

    def _handle_payment_succeeded(self, payment_intent):
        """Handle successful payment"""
        try:
            payment = get_payment_by_stripe_intent(payment_intent.id)
            if payment:
                update_payment_status(payment_id=payment["id"], status="completed")
                # Add credits and log transaction
                amount = payment.get("amount_usd", payment.get("amount", 0))
                add_credits_to_user(
                    user_id=payment["user_id"],
                    credits=amount,
                    transaction_type="purchase",
                    description=f"Stripe payment - ${amount}",
                    payment_id=payment["id"],
                    metadata={"stripe_payment_intent_id": payment_intent.id},
                )
                logger.info(f"Payment succeeded: {payment_intent.id}")
        except Exception as e:
            logger.error(f"Error handling payment succeeded: {e}")

    def _handle_payment_failed(self, payment_intent):
        """Handle failed payment"""
        try:
            payment = get_payment_by_stripe_intent(payment_intent.id)
            if payment:
                update_payment_status(payment_id=payment["id"], status="failed")
                logger.info(f"Payment failed: {payment_intent.id}")
        except Exception as e:
            logger.error(f"Error handling payment failed: {e}")

    # ==================== Credit Packages ====================

    def get_credit_packages(self) -> CreditPackagesResponse:
        """Get available credit packages"""
        packages = [
            CreditPackage(
                id="starter",
                name="Starter Pack",
                credits=1000,
                amount=1000,
                currency=StripeCurrency.USD,
                description="Perfect for trying out the platform",
                features=["1,000 credits", "~100,000 tokens", "Valid for 30 days"],
            ),
            CreditPackage(
                id="professional",
                name="Professional Pack",
                credits=5000,
                amount=4500,
                currency=StripeCurrency.USD,
                discount_percentage=10.0,
                popular=True,
                description="Best value for regular users",
                features=["5,000 credits", "~500,000 tokens", "10% discount", "Valid for 90 days"],
            ),
        ]

        return CreditPackagesResponse(packages=packages, currency=StripeCurrency.USD)

    # ==================== Refunds ====================

    def create_refund(self, request: CreateRefundRequest) -> RefundResponse:
        """Create a refund"""
        try:
            refund = stripe.Refund.create(
                payment_intent=request.payment_intent_id,
                amount=request.amount,
                reason=request.reason,
            )

            return RefundResponse(
                refund_id=refund.id,
                payment_intent_id=refund.payment_intent,
                amount=refund.amount,
                currency=refund.currency,
                status=refund.status,
                reason=refund.reason,
                created_at=datetime.fromtimestamp(refund.created, tz=timezone.utc),
            )

        except stripe.StripeError as e:
            logger.error(f"Stripe error creating refund: {e}")
            raise Exception(f"Refund failed: {str(e)}") from e

    # ==================== Subscription Checkout ====================

    def create_subscription_checkout(
        self, user_id: int, request: CreateSubscriptionCheckoutRequest
    ) -> SubscriptionCheckoutResponse:
        """
        Create a Stripe checkout session for subscription

        Args:
            user_id: User ID
            request: Subscription checkout request parameters

        Returns:
            SubscriptionCheckoutResponse with session_id and checkout URL
        """
        try:
            # Get user details
            user = get_user_by_id(user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")

            # Extract real email if stored email is a Privy DID
            user_email = user.get("email", "")
            if user_email.startswith("did:privy:"):
                logger.warning(f"User {user_id} has Privy DID as email: {user_email}")
                if request.customer_email:
                    user_email = request.customer_email
                else:
                    user_email = None
                    logger.warning(
                        f"No customer_email in request for user {user_id} with Privy DID"
                    )

            # Get or create Stripe customer
            stripe_customer_id = user.get("stripe_customer_id")

            if not stripe_customer_id:
                # Create new Stripe customer
                logger.info(f"Creating Stripe customer for user {user_id}")
                customer = stripe.Customer.create(
                    email=request.customer_email or user_email,
                    metadata={
                        "user_id": str(user_id),
                        "username": user.get("username", ""),
                    },
                )
                stripe_customer_id = customer.id

                # Save customer ID to database
                from src.config.supabase_config import get_supabase_client

                client = get_supabase_client()
                client.table("users").update(
                    {
                        "stripe_customer_id": stripe_customer_id,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("id", user_id).execute()

                logger.info(f"Stripe customer created: {stripe_customer_id} for user {user_id}")

            # Determine tier from product_id using database configuration
            tier = get_tier_from_product_id(request.product_id)

            logger.info(
                f"Creating subscription checkout for user {user_id}, tier: {tier}, price_id: {request.price_id}"
            )

            # Create Stripe Checkout Session for subscription
            session_params = {
                "customer": stripe_customer_id,
                "payment_method_types": ["card"],
                "line_items": [
                    {
                        "price": request.price_id,
                        "quantity": 1,
                    }
                ],
                "mode": request.mode,
                "success_url": request.success_url,
                "cancel_url": request.cancel_url,
                "metadata": {
                    "user_id": str(user_id),
                    "product_id": request.product_id,
                    "tier": tier,
                    **(request.metadata or {}),
                },
            }

            # Add subscription_data for subscription mode
            if request.mode == "subscription":
                session_params["subscription_data"] = {
                    "metadata": {
                        "user_id": str(user_id),
                        "product_id": request.product_id,
                        "tier": tier,
                    }
                }

            session = stripe.checkout.Session.create(**session_params)

            logger.info(f"Subscription checkout session created: {session.id} for user {user_id}")
            logger.info(f"Checkout URL: {session.url}")

            return SubscriptionCheckoutResponse(
                session_id=session.id,
                url=session.url,
                customer_id=stripe_customer_id,
                status=session.status,
            )

        except stripe.StripeError as e:
            logger.error(f"Stripe error creating subscription checkout: {e}")
            raise Exception(f"Payment processing error: {str(e)}") from e

        except Exception as e:
            logger.error(f"Error creating subscription checkout: {e}")
            raise

    # ==================== Subscription Webhook Handlers ====================

    def _handle_subscription_created(self, subscription):
        """Handle subscription created event"""
        try:
            user_id = int(subscription.metadata.get("user_id"))
            tier = subscription.metadata.get("tier", "pro")
            product_id = subscription.metadata.get("product_id")

            logger.info(f"Subscription created for user {user_id}: {subscription.id}, tier: {tier}")

            # Update user's subscription status and tier
            from src.config.supabase_config import get_supabase_client

            client = get_supabase_client()

            update_data = {
                "subscription_status": "active",
                "tier": tier,
                "stripe_subscription_id": subscription.id,
                "stripe_product_id": product_id,
                "stripe_customer_id": subscription.customer,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            # Add subscription end date if available
            if subscription.current_period_end:
                update_data["subscription_end_date"] = subscription.current_period_end

            client.table("users").update(update_data).eq("id", user_id).execute()

            # Clear trial status for all user's API keys
            client.table("api_keys_new").update(
                {
                    "is_trial": False,
                    "trial_converted": True,
                    "subscription_status": "active",
                    "subscription_plan": tier,
                }
            ).eq("user_id", user_id).execute()

            logger.info(
                f"User {user_id} subscription activated: tier={tier}, subscription_id={subscription.id}, trial status cleared"
            )

        except Exception as e:
            logger.error(f"Error handling subscription created: {e}", exc_info=True)
            raise

    def _handle_subscription_updated(self, subscription):
        """Handle subscription updated event"""
        try:
            user_id = int(subscription.metadata.get("user_id"))
            status = subscription.status  # active, past_due, canceled, etc.
            tier = subscription.metadata.get("tier", "pro")

            logger.info(
                f"Subscription updated for user {user_id}: {subscription.id}, status: {status}, tier: {tier}"
            )

            # Update user's subscription status
            from src.config.supabase_config import get_supabase_client

            client = get_supabase_client()

            update_data = {
                "subscription_status": status,
                "tier": tier,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            if subscription.current_period_end:
                update_data["subscription_end_date"] = subscription.current_period_end

            # If subscription is canceled or past_due, potentially downgrade
            if status in ["canceled", "past_due", "unpaid"]:
                update_data["tier"] = "basic"
                logger.warning(
                    f"User {user_id} subscription status changed to {status}, downgrading to basic tier"
                )

            client.table("users").update(update_data).eq("id", user_id).execute()

            # Clear trial status for all user's API keys when subscription becomes active
            if status == "active":
                client.table("api_keys_new").update(
                    {
                        "is_trial": False,
                        "trial_converted": True,
                        "subscription_status": "active",
                        "subscription_plan": tier,
                    }
                ).eq("user_id", user_id).execute()
                logger.info(f"User {user_id} trial status cleared on subscription update to active")

            logger.info(f"User {user_id} subscription updated: status={status}, tier={tier}")

        except Exception as e:
            logger.error(f"Error handling subscription updated: {e}", exc_info=True)
            raise

    def _handle_subscription_deleted(self, subscription):
        """Handle subscription deleted/canceled event"""
        try:
            user_id = int(subscription.metadata.get("user_id"))

            logger.info(f"Subscription deleted for user {user_id}: {subscription.id}")

            # Downgrade user to basic tier
            from src.config.supabase_config import get_supabase_client

            client = get_supabase_client()

            client.table("users").update(
                {
                    "subscription_status": "canceled",
                    "tier": "basic",
                    "stripe_subscription_id": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", user_id).execute()

            logger.info(f"User {user_id} subscription canceled, downgraded to basic tier")

        except Exception as e:
            logger.error(f"Error handling subscription deleted: {e}", exc_info=True)
            raise

    def _handle_invoice_paid(self, invoice):
        """Handle invoice paid event - add credits for subscription renewal"""
        try:
            # Get subscription from invoice
            if not invoice.subscription:
                logger.info(f"Invoice {invoice.id} is not for a subscription, skipping")
                return

            subscription = stripe.Subscription.retrieve(invoice.subscription)
            user_id = int(subscription.metadata.get("user_id"))
            tier = subscription.metadata.get("tier", "pro")

            # Get credits from database configuration
            credits = get_credits_from_tier(tier)

            if credits > 0:
                # Add credits to user account
                add_credits_to_user(
                    user_id=user_id,
                    credits=credits,
                    transaction_type="subscription_renewal",
                    description=f"Monthly subscription credits - {tier.upper()} tier",
                    metadata={
                        "stripe_invoice_id": invoice.id,
                        "stripe_subscription_id": subscription.id,
                        "tier": tier,
                    },
                )

                logger.info(
                    f"Added {credits} credits to user {user_id} for {tier} subscription renewal (invoice: {invoice.id})"
                )
            else:
                logger.warning(f"No credits configured for tier: {tier}")

        except Exception as e:
            logger.error(f"Error handling invoice paid: {e}", exc_info=True)
            raise

    def _handle_invoice_payment_failed(self, invoice):
        """Handle invoice payment failed event - mark as past_due and downgrade tier"""
        try:
            if not invoice.subscription:
                logger.info(f"Invoice {invoice.id} is not for a subscription, skipping")
                return

            subscription = stripe.Subscription.retrieve(invoice.subscription)
            user_id = int(subscription.metadata.get("user_id"))

            logger.warning(f"Invoice payment failed for user {user_id}: {invoice.id}")

            # Update user's subscription status to past_due and downgrade to basic tier
            from src.config.supabase_config import get_supabase_client

            client = get_supabase_client()

            # Downgrade to basic tier immediately to prevent unauthorized access
            client.table("users").update({
                "subscription_status": "past_due",
                "tier": "basic",  # Downgrade tier on payment failure
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", user_id).execute()

            # Also update API keys to reflect downgrade
            client.table("api_keys_new").update({
                "subscription_status": "past_due",
                "subscription_plan": "basic",
            }).eq("user_id", user_id).execute()

            logger.info(
                f"User {user_id} subscription marked as past_due and downgraded to basic tier due to failed payment"
            )

        except Exception as e:
            logger.error(f"Error handling invoice payment failed: {e}", exc_info=True)
            raise
