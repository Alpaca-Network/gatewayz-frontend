#!/usr/bin/env python3
"""
Stripe Payment Routes
Endpoints for handling Stripe webhooks and payment operations
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from fastapi.responses import JSONResponse

from src.schemas.payments import WebhookProcessingResult, CreateCheckoutSessionRequest, CreatePaymentIntentRequest, \
    CreateRefundRequest
from src.services.payments import StripeService

from src.security.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stripe", tags=["Stripe Payments"])

# Initialize Stripe service
stripe_service = StripeService()


# ==================== Webhook Endpoint ====================

@router.post("/webhook", status_code=200)
async def stripe_webhook(
        request: Request,
        stripe_signature: str = Header(None, alias="stripe-signature")
):
    """
    Stripe webhook endpoint - handles all Stripe events

    This endpoint receives webhooks from Stripe for payment events:
    - checkout.session.completed - User completed checkout, add credits
    - checkout.session.expired - Checkout expired, mark payment as canceled
    - payment_intent.succeeded - Payment succeeded, add credits
    - payment_intent.payment_failed - Payment failed, update status
    - payment_intent.canceled - Payment canceled by user
    - charge.refunded - Charge was refunded, deduct credits

    IMPORTANT: This endpoint must be configured in your Stripe Dashboard:
    1. Go to Stripe Dashboard > Developers > Webhooks
    2. Add endpoint: https://your-domain.com/api/stripe/webhook
    3. Select events to listen for (listed above)
    4. Copy webhook signing secret to STRIPE_WEBHOOK_SECRET env variable

    Args:
        request: FastAPI request object containing raw webhook payload
        stripe_signature: Stripe signature header for verification

    Returns:
        JSONResponse with processing result

    Raises:
        HTTPException: If signature verification fails or processing error
    """
    try:
        # Get raw request body
        payload = await request.body()

        if not stripe_signature:
            logger.error("Missing Stripe signature header")
            raise HTTPException(
                status_code=400,
                detail="Missing stripe-signature header"
            )

        # Process webhook through Stripe service
        result: WebhookProcessingResult = stripe_service.handle_webhook(
            payload=payload,
            signature=stripe_signature
        )

        logger.info(
            f"Webhook processed: {result.event_type} - {result.message}"
        )

        return JSONResponse(
            status_code=200,
            content={
                "success": result.success,
                "event_type": result.event_type,
                "event_id": result.event_id,
                "message": result.message,
                "processed_at": result.processed_at.isoformat()
            }
        )

    except ValueError as e:
        # Signature verification failed
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid signature: {str(e)}"
        )

    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Webhook processing failed: {str(e)}"
        )


# ==================== Checkout Sessions ====================

@router.post("/checkout-session", response_model=Dict[str, Any])
async def create_checkout_session(
        request: CreateCheckoutSessionRequest,
        current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a Stripe checkout session for hosted payment page

    This creates a Stripe-hosted payment page where users can complete their purchase.
    After payment, Stripe redirects to success_url or cancel_url.

    Args:
        request: Checkout session parameters (amount, currency, URLs)
        current_user: Authenticated user from token

    Returns:
        Checkout session with URL and session ID

    Example request body:
    {
        "amount": 1000,  # $10.00 in cents
        "currency": "usd",
        "description": "1000 credits purchase",
        "success_url": "https://your-app.com/payment/success",
        "cancel_url": "https://your-app.com/payment/cancel"
    }
    """
    try:
        user_id = current_user['id']

        session = stripe_service.create_checkout_session(
            user_id=user_id,
            request=request
        )

        logger.info(f"Checkout session created for user {user_id}: {session.session_id}")

        return {
            "session_id": session.session_id,
            "url": session.url,
            "payment_id": session.payment_id,
            "status": session.status.value,
            "amount": session.amount,
            "currency": session.currency,
            "expires_at": session.expires_at.isoformat()
        }

    except ValueError as e:
        logger.error(f"Validation error creating checkout session: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create checkout session: {str(e)}"
        )


@router.get("/checkout-session/{session_id}")
async def get_checkout_session(
        session_id: str,
        current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve checkout session details

    Args:
        session_id: Stripe checkout session ID
        current_user: Authenticated user

    Returns:
        Checkout session details
    """
    try:
        session = stripe_service.retrieve_checkout_session(session_id)

        return {
            "session_id": session['id'],
            "payment_status": session['payment_status'],
            "status": session['status'],
            "amount_total": session['amount_total'],
            "currency": session['currency'],
            "customer_email": session['customer_email']
        }

    except Exception as e:
        logger.error(f"Error retrieving checkout session: {e}")
        raise HTTPException(status_code=404, detail=str(e))


# ==================== Payment Intents ====================

@router.post("/payment-intent", response_model=Dict[str, Any])
async def create_payment_intent(
        request: CreatePaymentIntentRequest,
        current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a Stripe payment intent for custom payment flows

    Use this for building your own payment UI with Stripe Elements.
    Returns a client_secret that you use on the frontend.

    Args:
        request: Payment intent parameters
        current_user: Authenticated user

    Returns:
        Payment intent with client_secret

    Example request body:
    {
        "amount": 1000,
        "currency": "usd",
        "description": "1000 credits",
        "automatic_payment_methods": true
    }
    """
    try:
        user_id = current_user['id']

        intent = stripe_service.create_payment_intent(
            user_id=user_id,
            request=request
        )

        logger.info(f"Payment intent created for user {user_id}: {intent.payment_intent_id}")

        return {
            "payment_intent_id": intent.payment_intent_id,
            "client_secret": intent.client_secret,
            "payment_id": intent.payment_id,
            "status": intent.status.value,
            "amount": intent.amount,
            "currency": intent.currency,
            "next_action": intent.next_action
        }

    except ValueError as e:
        logger.error(f"Validation error creating payment intent: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error creating payment intent: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create payment intent: {str(e)}"
        )


@router.get("/payment-intent/{payment_intent_id}")
async def get_payment_intent(
        payment_intent_id: str,
        current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve payment intent details

    Args:
        payment_intent_id: Stripe payment intent ID
        current_user: Authenticated user

    Returns:
        Payment intent details
    """
    try:
        intent = stripe_service.retrieve_payment_intent(payment_intent_id)

        return {
            "payment_intent_id": intent['id'],
            "status": intent['status'],
            "amount": intent['amount'],
            "currency": intent['currency'],
            "customer": intent['customer'],
            "payment_method": intent['payment_method']
        }

    except Exception as e:
        logger.error(f"Error retrieving payment intent: {e}")
        raise HTTPException(status_code=404, detail=str(e))


# ==================== Credit Packages ====================

@router.get("/credit-packages")
async def get_credit_packages():
    """
    Get available credit packages for purchase

    Returns:
        List of available credit packages with pricing

    Example response:
    {
        "packages": [
            {
                "id": "starter",
                "name": "Starter Pack",
                "credits": 1000,
                "amount": 1000,
                "currency": "usd",
                "description": "Perfect for trying out the platform"
            }
        ]
    }
    """
    try:
        packages = stripe_service.get_credit_packages()

        return {
            "packages": [
                {
                    "id": pkg.id,
                    "name": pkg.name,
                    "credits": pkg.credits,
                    "amount": pkg.amount,
                    "currency": pkg.currency.value,
                    "description": pkg.description,
                    "features": pkg.features,
                    "popular": pkg.popular,
                    "discount_percentage": pkg.discount_percentage
                }
                for pkg in packages.packages
            ]
        }

    except Exception as e:
        logger.error(f"Error getting credit packages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Refunds ====================

@router.post("/refund", response_model=Dict[str, Any])
async def create_refund(
        request: CreateRefundRequest,
        current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a refund for a payment (admin only)

    Args:
        request: Refund parameters
        current_user: Authenticated user (must be admin)

    Returns:
        Refund details
    """
    try:
        # Check if user is admin (implement your admin check logic)
        if not current_user.get('is_admin', False):
            raise HTTPException(
                status_code=403,
                detail="Only administrators can create refunds"
            )

        refund = stripe_service.create_refund(request)

        logger.info(f"Refund created: {refund.refund_id}")

        return {
            "refund_id": refund.refund_id,
            "payment_intent_id": refund.payment_intent_id,
            "amount": refund.amount,
            "currency": refund.currency,
            "status": refund.status,
            "reason": refund.reason,
            "created_at": refund.created_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating refund: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Payment History ====================

@router.get("/payments")
async def get_payment_history(
        limit: int = 50,
        offset: int = 0,
        current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get payment history for the authenticated user

    Args:
        limit: Maximum number of payments to return
        offset: Number of payments to skip
        current_user: Authenticated user

    Returns:
        List of user's payment records
    """
    try:
        from src.db.payments import get_user_payments

        user_id = current_user['id']
        payments = get_user_payments(user_id, limit=limit, offset=offset)

        return {
            "payments": [
                {
                    "id": payment['id'],
                    "amount": payment['amount'],
                    "currency": payment['currency'],
                    "status": payment['status'],
                    "payment_method": payment['payment_method'],
                    "stripe_payment_intent_id": payment.get('stripe_payment_intent_id'),
                    "created_at": payment['created_at'],
                    "completed_at": payment.get('completed_at'),
                    "metadata": payment.get('metadata', {})
                }
                for payment in payments
            ],
            "total": len(payments),
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(f"Error getting payment history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payments/{payment_id}")
async def get_payment_details(
        payment_id: int,
        current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get details of a specific payment

    Args:
        payment_id: Payment record ID
        current_user: Authenticated user

    Returns:
        Payment details
    """
    try:
        from src.db.payments import get_payment

        payment = get_payment(payment_id)

        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        # Verify payment belongs to user
        if payment['user_id'] != current_user['id']:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this payment"
            )

        return {
            "id": payment['id'],
            "amount": payment['amount'],
            "currency": payment['currency'],
            "status": payment['status'],
            "payment_method": payment['payment_method'],
            "stripe_payment_intent_id": payment.get('stripe_payment_intent_id'),
            "stripe_session_id": payment.get('stripe_session_id'),
            "stripe_customer_id": payment.get('stripe_customer_id'),
            "created_at": payment['created_at'],
            "updated_at": payment.get('updated_at'),
            "completed_at": payment.get('completed_at'),
            "failed_at": payment.get('failed_at'),
            "metadata": payment.get('metadata', {})
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payment details: {e}")
        raise HTTPException(status_code=500, detail=str(e))