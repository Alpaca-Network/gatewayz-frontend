#!/usr/bin/env python3
"""
Credit Transactions Database Operations
Tracks all credit additions and deductions with full audit trail
"""

import logging
from datetime import datetime, timezone
from typing import Any

from src.config.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


# Transaction Types
class TransactionType:
    """Enum for transaction types"""

    TRIAL = "trial"  # Free trial credits
    PURCHASE = "purchase"  # Stripe payment
    ADMIN_CREDIT = "admin_credit"  # Admin manually added credits
    ADMIN_DEBIT = "admin_debit"  # Admin manually removed credits
    API_USAGE = "api_usage"  # Credits used for API calls
    REFUND = "refund"  # Refund from payment
    BONUS = "bonus"  # Promotional/bonus credits
    TRANSFER = "transfer"  # Credits transferred between accounts


def log_credit_transaction(
    user_id: int,
    amount: float,
    transaction_type: str,
    description: str,
    balance_before: float,
    balance_after: float,
    payment_id: int | None = None,
    metadata: dict[str, Any] | None = None,
    created_by: str | None = None,
) -> dict[str, Any] | None:
    """
    Log a credit transaction to the audit trail

    Args:
        user_id: User ID
        amount: Amount of credits (positive for additions, negative for deductions)
        transaction_type: Type of transaction (see TransactionType class)
        description: Human-readable description
        balance_before: User's balance before transaction
        balance_after: User's balance after transaction
        payment_id: Optional payment record ID (for purchase/refund transactions)
        metadata: Optional additional data as JSON
        created_by: Optional identifier of who created the transaction

    Returns:
        Created transaction record or None if failed
    """
    try:
        client = get_supabase_client()

        transaction_data = {
            "user_id": user_id,
            "amount": amount,
            "transaction_type": transaction_type,
            "description": description,
            "balance_before": balance_before,
            "balance_after": balance_after,
            "payment_id": payment_id,
            "metadata": metadata or {},
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = client.table("credit_transactions").insert(transaction_data).execute()

        if not result.data:
            logger.error("Failed to log credit transaction - no data returned")
            return None

        transaction = result.data[0]
        logger.info(
            f"Credit transaction logged: user={user_id}, "
            f"type={transaction_type}, amount={amount}, "
            f"balance={balance_before} → {balance_after}"
        )

        return transaction

    except Exception as e:
        logger.error(f"Error logging credit transaction: {e}", exc_info=True)
        return None


def get_user_transactions(
    user_id: int,
    limit: int = 50,
    offset: int = 0,
    transaction_type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    direction: str | None = None,  # 'credit' or 'charge'
    payment_id: int | None = None,
    sort_by: str = "created_at",  # 'created_at', 'amount', 'transaction_type'
    sort_order: str = "desc",  # 'asc' or 'desc'
) -> list[dict[str, Any]]:
    """
    Get credit transaction history for a user with advanced filtering

    Args:
        user_id: User ID
        limit: Maximum number of records to return
        offset: Number of records to skip
        transaction_type: Optional filter by transaction type
        from_date: Start date (YYYY-MM-DD or ISO format)
        to_date: End date (YYYY-MM-DD or ISO format)
        min_amount: Minimum transaction amount (absolute value)
        max_amount: Maximum transaction amount (absolute value)
        direction: Filter by direction - 'credit' (positive amounts) or 'charge' (negative amounts)
        payment_id: Filter by payment ID
        sort_by: Field to sort by ('created_at', 'amount', 'transaction_type')
        sort_order: Sort order ('asc' or 'desc')

    Returns:
        List of transaction records
    """
    try:
        client = get_supabase_client()

        query = client.table("credit_transactions").select("*").eq("user_id", user_id)

        # Filter by transaction type
        if transaction_type:
            query = query.eq("transaction_type", transaction_type)

        # Filter by date range
        if from_date:
            try:
                if "T" not in from_date:
                    from_date = f"{from_date}T00:00:00Z"
                query = query.gte("created_at", from_date)
            except Exception as e:
                logger.warning(f"Invalid from_date format: {from_date}, error: {e}")

        if to_date:
            try:
                if "T" not in to_date:
                    to_date = f"{to_date}T23:59:59Z"
                query = query.lte("created_at", to_date)
            except Exception as e:
                logger.warning(f"Invalid to_date format: {to_date}, error: {e}")

        # Filter by direction (credit = positive, charge = negative)
        if direction:
            if direction.lower() == "credit":
                query = query.gt("amount", 0)
            elif direction.lower() == "charge":
                query = query.lt("amount", 0)

        # Filter by payment_id
        if payment_id is not None:
            query = query.eq("payment_id", payment_id)

        # Sorting
        desc_order = sort_order.lower() == "desc"
        if sort_by == "amount":
            query = query.order("amount", desc=desc_order)
        elif sort_by == "transaction_type":
            query = query.order("transaction_type", desc=desc_order)
        else:  # default to created_at
            query = query.order("created_at", desc=desc_order)

        # Execute query
        result = query.execute()
        transactions = result.data or []

        # Post-process: Apply amount range filtering (for absolute value matching)
        if min_amount is not None or max_amount is not None:
            filtered_transactions = []
            for txn in transactions:
                amount = abs(float(txn.get("amount", 0)))
                include = True
                
                if min_amount is not None and amount < min_amount:
                    include = False
                if max_amount is not None and amount > max_amount:
                    include = False
                
                if include:
                    filtered_transactions.append(txn)
            transactions = filtered_transactions

        # Apply pagination after filtering
        paginated_transactions = transactions[offset : offset + limit]

        return paginated_transactions

    except Exception as e:
        logger.error(f"Error getting transactions for user {user_id}: {e}", exc_info=True)
        return []


def add_credits(
    api_key: str,
    amount: float,
    description: str,
    metadata: dict[str, Any] | None = None,
    transaction_type: str = TransactionType.BONUS,
    user_id: int | None = None,
) -> bool:
    """
    Add credits to a user's account

    Args:
        api_key: User's API key (optional if user_id is provided)
        amount: Amount of credits to add (must be positive)
        description: Human-readable description of the credit addition
        metadata: Optional additional data as JSON
        transaction_type: Type of transaction (defaults to BONUS)
        user_id: Optional user ID (if provided, will use this instead of looking up by api_key)

    Returns:
        True if credits were added successfully, False otherwise
    """
    try:
        if amount <= 0:
            logger.error(f"Cannot add negative or zero credits: {amount}")
            return False

        client = get_supabase_client()

        # Get user by ID if provided, otherwise by API key
        if user_id:
            user_result = client.table("users").select("id, credits").eq("id", user_id).execute()
        else:
            user_result = (
                client.table("users").select("id, credits").eq("api_key", api_key).execute()
            )

        if not user_result.data:
            logger.error(
                f"User not found for {'user_id: ' + str(user_id) if user_id else 'API key: ' + api_key[:15] + '...'}"
            )
            return False

        user = user_result.data[0]
        resolved_user_id = user["id"]
        balance_before = float(user.get("credits", 0) or 0)
        balance_after = balance_before + amount

        # Update user's credits (using same column as payment system)
        update_result = (
            client.table("users")
            .update({"credits": balance_after})
            .eq("id", resolved_user_id)
            .execute()
        )

        if not update_result.data:
            logger.error(f"Failed to update balance for user {resolved_user_id}")
            return False

        # Log the transaction
        log_credit_transaction(
            user_id=resolved_user_id,
            amount=amount,
            transaction_type=transaction_type,
            description=description,
            balance_before=balance_before,
            balance_after=balance_after,
            metadata=metadata,
        )

        logger.info(
            f"Added {amount} credits to user {resolved_user_id}. New balance: {balance_after}"
        )
        return True

    except Exception as e:
        logger.error(f"Error adding credits: {e}", exc_info=True)
        return False


def get_transaction_summary(
    user_id: int,
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict[str, Any]:
    """
    Get comprehensive summary of credit transactions for a user

    Args:
        user_id: User ID
        from_date: Optional start date filter (YYYY-MM-DD or ISO format)
        to_date: Optional end date filter (YYYY-MM-DD or ISO format)

    Returns:
        Dictionary with transaction summary including analytics
    """
    try:
        client = get_supabase_client()

        query = client.table("credit_transactions").select("*").eq("user_id", user_id)

        # Apply date filters if provided
        if from_date:
            try:
                if "T" not in from_date:
                    from_date = f"{from_date}T00:00:00Z"
                query = query.gte("created_at", from_date)
            except Exception as e:
                logger.warning(f"Invalid from_date format: {from_date}, error: {e}")

        if to_date:
            try:
                if "T" not in to_date:
                    to_date = f"{to_date}T23:59:59Z"
                query = query.lte("created_at", to_date)
            except Exception as e:
                logger.warning(f"Invalid to_date format: {to_date}, error: {e}")

        result = query.execute()
        transactions = result.data or []

        if not transactions:
            return {
                "total_transactions": 0,
                "total_credits_added": 0.0,
                "total_credits_used": 0.0,
                "net_change": 0.0,
                "by_type": {},
                "daily_breakdown": [],
                "largest_credit": None,
                "largest_charge": None,
                "average_transaction": 0.0,
                "transaction_count_by_direction": {"credits": 0, "charges": 0},
            }

        # Initialize summary
        summary = {
            "total_transactions": len(transactions),
            "total_credits_added": 0.0,
            "total_credits_used": 0.0,
            "net_change": 0.0,
            "by_type": {},
            "daily_breakdown": {},
            "largest_credit": None,
            "largest_charge": None,
            "average_transaction": 0.0,
            "transaction_count_by_direction": {"credits": 0, "charges": 0},
        }

        for transaction in transactions:
            amount = float(transaction.get("amount", 0))
            trans_type = transaction.get("transaction_type", "unknown")
            created_at = transaction.get("created_at")

            # Track totals
            if amount > 0:
                summary["total_credits_added"] += amount
                summary["transaction_count_by_direction"]["credits"] += 1
                # Track largest credit
                if (
                    summary["largest_credit"] is None
                    or amount > summary["largest_credit"]["amount"]
                ):
                    summary["largest_credit"] = {
                        "id": transaction.get("id"),
                        "amount": amount,
                        "transaction_type": trans_type,
                        "description": transaction.get("description", ""),
                        "created_at": created_at,
                    }
            else:
                summary["total_credits_used"] += abs(amount)
                summary["transaction_count_by_direction"]["charges"] += 1
                # Track largest charge
                if (
                    summary["largest_charge"] is None
                    or abs(amount) > abs(summary["largest_charge"]["amount"])
                ):
                    summary["largest_charge"] = {
                        "id": transaction.get("id"),
                        "amount": amount,
                        "transaction_type": trans_type,
                        "description": transaction.get("description", ""),
                        "created_at": created_at,
                    }

            # Track by type
            if trans_type not in summary["by_type"]:
                summary["by_type"][trans_type] = {
                    "count": 0,
                    "total_amount": 0.0,
                    "average_amount": 0.0,
                }

            summary["by_type"][trans_type]["count"] += 1
            summary["by_type"][trans_type]["total_amount"] += amount

            # Daily breakdown
            if created_at:
                try:
                    date_str = created_at.split("T")[0] if "T" in created_at else created_at[:10]
                    if date_str not in summary["daily_breakdown"]:
                        summary["daily_breakdown"][date_str] = {
                            "credits_added": 0.0,
                            "credits_used": 0.0,
                            "count": 0,
                        }

                    if amount > 0:
                        summary["daily_breakdown"][date_str]["credits_added"] += amount
                    else:
                        summary["daily_breakdown"][date_str]["credits_used"] += abs(amount)

                    summary["daily_breakdown"][date_str]["count"] += 1
                except Exception as e:
                    logger.warning(f"Error parsing date for daily breakdown: {e}")

        # Calculate net change and averages
        summary["net_change"] = summary["total_credits_added"] - summary["total_credits_used"]
        summary["average_transaction"] = (
            summary["net_change"] / len(transactions) if transactions else 0.0
        )

        # Calculate average by type
        for trans_type, type_data in summary["by_type"].items():
            if type_data["count"] > 0:
                type_data["average_amount"] = type_data["total_amount"] / type_data["count"]

        # Sort daily breakdown by date (most recent first) and convert to list format
        daily_list = []
        for date, day_stats in sorted(summary["daily_breakdown"].items(), reverse=True):
            daily_list.append({
                "date": date,
                "credits_added": day_stats["credits_added"],
                "credits_used": day_stats["credits_used"],
                "count": day_stats["count"],
            })
        
        summary["daily_breakdown"] = daily_list

        return summary

    except Exception as e:
        logger.error(f"Error getting transaction summary for user {user_id}: {e}", exc_info=True)
        return {
            "total_transactions": 0,
            "total_credits_added": 0.0,
            "total_credits_used": 0.0,
            "net_change": 0.0,
            "by_type": {},
            "daily_breakdown": [],
            "largest_credit": None,
            "largest_charge": None,
            "average_transaction": 0.0,
            "transaction_count_by_direction": {"credits": 0, "charges": 0},
            "error": str(e),
        }
