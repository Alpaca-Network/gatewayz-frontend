#!/usr/bin/.env python3
"""
Payment Database Operations
CRUD operations for payment records in Supabase
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Dict, List

from src.config.supabase_config import get_supabase_client

from typing import Optional
logger = logging.getLogger(__name__)


# ==================== Create ====================


def create_payment(
    user_id: int,
    amount: float,
    currency: str = "usd",
    payment_method: str = "stripe",
    status: str = "pending",
    stripe_payment_intent_id: Optional[str] = None,
    stripe_session_id: Optional[str] = None,
    stripe_customer_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Create a new payment record

    Args:
        user_id: ID of the user making the payment
        amount: Payment amount in dollars (e.g., 29.99 for $29.99)
        currency: Currency code (default: usd)
        payment_method: Payment method used (default: stripe)
        status: Payment status (pending, completed, failed, refunded, canceled)
        stripe_payment_intent_id: Stripe payment intent ID
        stripe_session_id: Stripe checkout session ID
        stripe_customer_id: Stripe customer ID
        metadata: Additional metadata as JSON

    Returns:
        Created payment record or None if failed
    """
    try:
        client = get_supabase_client()

        # Calculate amount in cents
        amount_cents = int(amount * 100)

        # Prepare payment data
        payment_data = {
            "user_id": user_id,
            "amount_usd": amount,
            "amount_cents": amount_cents,
            "credits_purchased": amount_cents,  # 1 credit = 1 cent
            "bonus_credits": 0,
            "currency": currency.lower(),
            "payment_method": payment_method,
            "status": status,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Add Stripe fields if provided
        if stripe_payment_intent_id:
            payment_data["stripe_payment_intent_id"] = stripe_payment_intent_id

        if stripe_session_id:
            payment_data["stripe_checkout_session_id"] = stripe_session_id

        if stripe_customer_id:
            payment_data["stripe_customer_id"] = stripe_customer_id

        # Insert into Supabase
        result = client.table("payments").insert(payment_data).execute()

        if not result.data:
            logger.error("Failed to create payment record - no data returned")
            return None

        payment = result.data[0]
        logger.info(f"✅ Payment record created successfully: {payment['id']}")

        return payment

    except Exception as e:
        logger.error(f"Error creating payment: {e}", exc_info=True)
        return None


# ==================== Read ====================


def get_payment(payment_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a payment record by ID

    Args:
        payment_id: Payment record ID

    Returns:
        Payment record or None if not found
    """
    try:
        client = get_supabase_client()

        result = client.table("payments").select("*").eq("id", payment_id).execute()

        if not result.data:
            logger.warning(f"Payment {payment_id} not found")
            return None

        return result.data[0]

    except Exception as e:
        logger.error(f"Error getting payment {payment_id}: {e}")
        return None


def get_payment_by_stripe_intent(stripe_payment_intent_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a payment record by Stripe payment intent ID

    Args:
        stripe_payment_intent_id: Stripe payment intent ID or session ID

    Returns:
        Payment record or None if not found
    """
    try:
        client = get_supabase_client()

        # Try payment intent ID first
        result = (
            client.table("payments")
            .select("*")
            .eq("stripe_payment_intent_id", stripe_payment_intent_id)
            .execute()
        )

        if result.data:
            return result.data[0]

        # Try session ID
        result = (
            client.table("payments")
            .select("*")
            .eq("stripe_session_id", stripe_payment_intent_id)
            .execute()
        )

        if not result.data:
            logger.warning(f"Payment with Stripe ID {stripe_payment_intent_id} not found")
            return None

        return result.data[0]

    except Exception as e:
        logger.error(f"Error getting payment by Stripe intent {stripe_payment_intent_id}: {e}")
        return None


def get_user_payments(
    user_id: int, limit: int = 50, offset: int = 0, status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get all payment records for a user

    Args:
        user_id: User ID
        limit: Maximum number of records to return (default: 50)
        offset: Number of records to skip (default: 0)
        status: Optional filter by payment status

    Returns:
        List of payment records
    """
    try:
        client = get_supabase_client()

        query = client.table("payments").select("*").eq("user_id", user_id)

        if status:
            query = query.eq("status", status)

        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        return result.data or []

    except Exception as e:
        logger.error(f"Error getting payments for user {user_id}: {e}")
        return []


def get_recent_payments(limit: int = 20) -> List[Dict[str, Any]]:
    """
    Get recent payments across all users (admin function)

    Args:
        limit: Maximum number of records to return (default: 20)

    Returns:
        List of recent payment records
    """
    try:
        client = get_supabase_client()

        result = (
            client.table("payments")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return result.data or []

    except Exception as e:
        logger.error(f"Error getting recent payments: {e}")
        return []


# ==================== Update ====================


def update_payment_status(
    payment_id: int,
    status: str,
    stripe_payment_intent_id: Optional[str] = None,
    stripe_session_id: Optional[str] = None,
    error_message: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Update payment status and related fields

    Args:
        payment_id: Payment record ID
        status: New status (pending, processing, completed, failed, refunded, canceled)
        stripe_payment_intent_id: Optional Stripe payment intent ID to update
        stripe_session_id: Optional Stripe session ID to update
        error_message: Optional error message for failed payments

    Returns:
        Updated payment record or None if failed
    """
    try:
        client = get_supabase_client()

        update_data = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}

        if stripe_payment_intent_id:
            update_data["stripe_payment_intent_id"] = stripe_payment_intent_id

        if stripe_session_id:
            update_data["stripe_session_id"] = stripe_session_id

        # Add completion timestamp for completed payments
        if status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

        # Add failed timestamp and error for failed payments
        if status == "failed":
            update_data["failed_at"] = datetime.now(timezone.utc).isoformat()
            if error_message:
                # Store error in metadata
                payment = get_payment(payment_id)
                if payment:
                    metadata = payment.get("metadata", {})
                    metadata["error"] = error_message
                    update_data["metadata"] = metadata

        result = client.table("payments").update(update_data).eq("id", payment_id).execute()

        if not result.data:
            logger.error(f"Failed to update payment {payment_id}")
            return None

        logger.info(f"Payment {payment_id} status updated to {status}")
        return result.data[0]

    except Exception as e:
        logger.error(f"Error updating payment {payment_id}: {e}")
        return None


def update_payment_metadata(payment_id: int, metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update payment metadata

    Args:
        payment_id: Payment record ID
        metadata: Metadata dictionary to merge with existing

    Returns:
        Updated payment record or None if failed
    """
    try:
        client = get_supabase_client()

        # Get existing payment
        payment = get_payment(payment_id)
        if not payment:
            return None

        # Merge metadata
        existing_metadata = payment.get("metadata", {})
        updated_metadata = {**existing_metadata, **metadata}

        update_data = {"metadata": updated_metadata, "updated_at": datetime.now(timezone.utc).isoformat()}

        result = client.table("payments").update(update_data).eq("id", payment_id).execute()

        if not result.data:
            logger.error(f"Failed to update payment metadata {payment_id}")
            return None

        logger.info(f"Payment {payment_id} metadata updated")
        return result.data[0]

    except Exception as e:
        logger.error(f"Error updating payment metadata {payment_id}: {e}")
        return None


# ==================== Delete ====================


def delete_payment(payment_id: int) -> bool:
    """
    Delete a payment record (use with extreme caution - typically not recommended)

    Args:
        payment_id: Payment record ID

    Returns:
        True if deleted successfully, False otherwise
    """
    try:
        client = get_supabase_client()

        result = client.table("payments").delete().eq("id", payment_id).execute()

        if not result.data:
            logger.error(f"Failed to delete payment {payment_id}")
            return False

        logger.warning(f"Payment {payment_id} deleted")
        return True

    except Exception as e:
        logger.error(f"Error deleting payment {payment_id}: {e}")
        return False


# ==================== Statistics & Analytics ====================


def get_payment_statistics(user_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Get payment statistics for a user or overall system

    Args:
        user_id: Optional user ID to get statistics for specific user

    Returns:
        Dictionary with payment statistics
    """
    try:
        client = get_supabase_client()

        query = client.table("payments").select("*")

        if user_id:
            query = query.eq("user_id", user_id)

        result = query.execute()
        payments = result.data or []

        # Calculate statistics
        total_payments = len(payments)
        completed = [p for p in payments if p["status"] == "completed"]
        pending = [p for p in payments if p["status"] == "pending"]
        failed = [p for p in payments if p["status"] == "failed"]
        refunded = [p for p in payments if p["status"] == "refunded"]

        total_amount = sum(p.get("amount_usd", p.get("amount", 0)) for p in completed)
        refunded_amount = sum(p.get("amount_usd", p.get("amount", 0)) for p in refunded)

        return {
            "total_payments": total_payments,
            "completed": len(completed),
            "pending": len(pending),
            "failed": len(failed),
            "refunded": len(refunded),
            "total_amount": total_amount,
            "refunded_amount": refunded_amount,
            "net_amount": total_amount - refunded_amount,
            "success_rate": (len(completed) / total_payments * 100) if total_payments > 0 else 0,
            "average_payment": total_amount / len(completed) if completed else 0,
        }

    except Exception as e:
        logger.error(f"Error getting payment statistics: {e}")
        return {
            "total_payments": 0,
            "completed": 0,
            "pending": 0,
            "failed": 0,
            "refunded": 0,
            "total_amount": 0,
            "refunded_amount": 0,
            "net_amount": 0,
            "success_rate": 0,
            "average_payment": 0,
            "error": str(e),
        }


def get_total_revenue(
    start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Get total revenue statistics

    Args:
        start_date: Optional start date filter
        end_date: Optional end date filter

    Returns:
        Dictionary with revenue statistics
    """
    try:
        client = get_supabase_client()

        query = client.table("payments").select("amount, currency, status, created_at")

        if start_date:
            query = query.gte("created_at", start_date.isoformat())

        if end_date:
            query = query.lte("created_at", end_date.isoformat())

        result = query.eq("status", "completed").execute()

        payments = result.data or []

        # Calculate totals by currency
        revenue_by_currency = {}
        total_transactions = len(payments)

        for payment in payments:
            currency = payment.get("currency", "usd")
            amount = payment.get("amount_usd", payment.get("amount", 0))

            if currency not in revenue_by_currency:
                revenue_by_currency[currency] = 0

            revenue_by_currency[currency] += amount

        return {
            "total_transactions": total_transactions,
            "revenue_by_currency": revenue_by_currency,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
        }

    except Exception as e:
        logger.error(f"Error getting revenue statistics: {e}")
        return {"total_transactions": 0, "revenue_by_currency": {}, "error": str(e)}


def get_payment_trends(days: int = 30) -> Dict[str, Any]:
    """
    Get payment trends over specified days

    Args:
        days: Number of days to analyze (default: 30)

    Returns:
        Dictionary with payment trends
    """
    try:
        client = get_supabase_client()

        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        result = (
            client.table("payments").select("*").gte("created_at", start_date.isoformat()).execute()
        )

        payments = result.data or []

        # Group by date
        daily_stats = {}

        for payment in payments:
            date = payment["created_at"][:10]  # Get date part

            if date not in daily_stats:
                daily_stats[date] = {"total": 0, "completed": 0, "failed": 0, "amount": 0}

            daily_stats[date]["total"] += 1

            if payment["status"] == "completed":
                daily_stats[date]["completed"] += 1
                daily_stats[date]["amount"] += payment.get("amount_usd", payment.get("amount", 0))
            elif payment["status"] == "failed":
                daily_stats[date]["failed"] += 1

        return {
            "period_days": days,
            "start_date": start_date.isoformat(),
            "daily_stats": daily_stats,
            "total_payments": len(payments),
        }

    except Exception as e:
        logger.error(f"Error getting payment trends: {e}")
        return {"period_days": days, "daily_stats": {}, "total_payments": 0, "error": str(e)}
