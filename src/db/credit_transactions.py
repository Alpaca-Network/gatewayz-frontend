#!/usr/bin/env python3
"""
Credit Transactions Database Operations
Tracks all credit additions and deductions with full audit trail
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from src.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


# Transaction Types
class TransactionType:
    """Enum for transaction types"""
    TRIAL = "trial"                    # Free trial credits
    PURCHASE = "purchase"              # Stripe payment
    ADMIN_CREDIT = "admin_credit"      # Admin manually added credits
    ADMIN_DEBIT = "admin_debit"        # Admin manually removed credits
    API_USAGE = "api_usage"            # Credits used for API calls
    REFUND = "refund"                  # Refund from payment
    BONUS = "bonus"                    # Promotional/bonus credits
    TRANSFER = "transfer"              # Credits transferred between accounts


def log_credit_transaction(
        user_id: int,
        amount: float,
        transaction_type: str,
        description: str,
        balance_before: float,
        balance_after: float,
        payment_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None
) -> Optional[Dict[str, Any]]:
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
            'user_id': user_id,
            'amount': amount,
            'transaction_type': transaction_type,
            'description': description,
            'balance_before': balance_before,
            'balance_after': balance_after,
            'payment_id': payment_id,
            'metadata': metadata or {},
            'created_by': created_by,
            'created_at': datetime.now(timezone.utc).isoformat()
        }

        result = client.table('credit_transactions').insert(transaction_data).execute()

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
        transaction_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get credit transaction history for a user

    Args:
        user_id: User ID
        limit: Maximum number of records to return
        offset: Number of records to skip
        transaction_type: Optional filter by transaction type

    Returns:
        List of transaction records
    """
    try:
        client = get_supabase_client()

        query = client.table('credit_transactions').select('*').eq('user_id', user_id)

        if transaction_type:
            query = query.eq('transaction_type', transaction_type)

        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()

        return result.data or []

    except Exception as e:
        logger.error(f"Error getting transactions for user {user_id}: {e}")
        return []


def get_transaction_summary(user_id: int) -> Dict[str, Any]:
    """
    Get summary of credit transactions for a user

    Args:
        user_id: User ID

    Returns:
        Dictionary with transaction summary by type
    """
    try:
        client = get_supabase_client()

        result = client.table('credit_transactions').select('*').eq('user_id', user_id).execute()

        transactions = result.data or []

        summary = {
            'total_transactions': len(transactions),
            'total_credits_added': 0,
            'total_credits_used': 0,
            'by_type': {}
        }

        for transaction in transactions:
            amount = transaction['amount']
            trans_type = transaction['transaction_type']

            # Track totals
            if amount > 0:
                summary['total_credits_added'] += amount
            else:
                summary['total_credits_used'] += abs(amount)

            # Track by type
            if trans_type not in summary['by_type']:
                summary['by_type'][trans_type] = {
                    'count': 0,
                    'total_amount': 0
                }

            summary['by_type'][trans_type]['count'] += 1
            summary['by_type'][trans_type]['total_amount'] += amount

        return summary

    except Exception as e:
        logger.error(f"Error getting transaction summary for user {user_id}: {e}")
        return {
            'total_transactions': 0,
            'total_credits_added': 0,
            'total_credits_used': 0,
            'by_type': {},
            'error': str(e)
        }
