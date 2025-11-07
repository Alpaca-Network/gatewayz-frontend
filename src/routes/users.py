import logging

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException

import src.db.rate_limits as rate_limits_module
import src.db.users as users_module
import src.db.credit_transactions as credit_transactions_module
from src.schemas import (
    UserProfileResponse,
    DeleteAccountResponse,
    UserProfileUpdate,
    DeleteAccountRequest,
)
from src.security.deps import get_api_key
from fastapi import APIRouter
import src.services.trial_validation as trial_module
from src.utils.security_validators import sanitize_for_logging

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


# Backwards compatibility wrappers for tests to patch
def get_user(*args, **kwargs):
    return users_module.get_user(*args, **kwargs)


def get_user_usage_metrics(*args, **kwargs):
    return users_module.get_user_usage_metrics(*args, **kwargs)


def get_user_profile(*args, **kwargs):
    return users_module.get_user_profile(*args, **kwargs)


def update_user_profile(*args, **kwargs):
    return users_module.update_user_profile(*args, **kwargs)


def delete_user_account(*args, **kwargs):
    return users_module.delete_user_account(*args, **kwargs)


def get_user_rate_limits(*args, **kwargs):
    return rate_limits_module.get_user_rate_limits(*args, **kwargs)


def check_rate_limit(*args, **kwargs):
    return rate_limits_module.check_rate_limit(*args, **kwargs)


def validate_trial_access(*args, **kwargs):
    return trial_module.validate_trial_access(*args, **kwargs)


def get_user_transactions(*args, **kwargs):
    return credit_transactions_module.get_user_transactions(*args, **kwargs)


def get_transaction_summary(*args, **kwargs):
    return credit_transactions_module.get_transaction_summary(*args, **kwargs)


@router.get("/user/balance", tags=["authentication"])
async def get_user_balance(api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Check if this is a trial user
        trial_validation = validate_trial_access(api_key)

        if trial_validation.get("is_trial", False):
            # For trial users, show trial credits and tokens
            return {
                "api_key": f"{api_key[:10]}...",
                "credits": trial_validation.get("remaining_credits", 0.0),
                "tokens_remaining": trial_validation.get("remaining_tokens", 0),
                "requests_remaining": trial_validation.get("remaining_requests", 0),
                "status": "trial",
                "trial_end_date": trial_validation.get("trial_end_date"),
                "user_id": user.get("id"),
            }
        else:
            # For non-trial users, show regular credits
            return {
                "api_key": f"{api_key[:10]}...",
                "credits": user["credits"],
                "status": "active",
                "user_id": user.get("id"),
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting user balance: %s", sanitize_for_logging(str(e)))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/monitor", tags=["authentication"])
async def user_monitor(api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        usage_data = get_user_usage_metrics(api_key)

        if not usage_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve usage data")

        rate_limits = get_user_rate_limits(api_key)
        rate_limits_data = {}

        if rate_limits:
            rate_limits_data = {
                "requests_per_minute": rate_limits["requests_per_minute"],
                "requests_per_hour": rate_limits["requests_per_hour"],
                "requests_per_day": rate_limits["requests_per_day"],
                "tokens_per_minute": rate_limits["tokens_per_minute"],
                "tokens_per_hour": rate_limits["tokens_per_hour"],
                "tokens_per_day": rate_limits["tokens_per_day"],
            }

        return {
            "status": "success",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": usage_data["user_id"],
            "api_key": f"{api_key[:10]}...",
            "current_credits": usage_data["current_credits"],
            "usage_metrics": usage_data["usage_metrics"],
            "rate_limits": rate_limits_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting user monitor data: %s", sanitize_for_logging(str(e)))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/limit", tags=["authentication"])
async def user_get_rate_limits(api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        rate_limits = get_user_rate_limits(api_key)

        if not rate_limits:
            return {
                "status": "success",
                "api_key": f"{api_key[:10]}...",
                "current_limits": {
                    "requests_per_minute": 60,
                    "requests_per_hour": 1000,
                    "requests_per_day": 10000,
                    "tokens_per_minute": 10000,
                    "tokens_per_hour": 100000,
                    "tokens_per_day": 1000000,
                },
                "current_usage": {"allowed": True, "reason": "No rate limits configured"},
                "reset_times": {
                    "minute": datetime.now(timezone.utc).replace(second=0, microsecond=0)
                    + timedelta(minutes=1),
                    "hour": datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
                    + timedelta(hours=1),
                    "day": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                    + timedelta(days=1),
                },
            }

        current_usage = check_rate_limit(api_key)

        return {
            "status": "success",
            "api_key": f"{api_key[:10]}...",
            "current_limits": {
                "requests_per_minute": rate_limits["requests_per_minute"],
                "requests_per_hour": rate_limits["requests_per_hour"],
                "requests_per_day": rate_limits["requests_per_day"],
                "tokens_per_minute": rate_limits["tokens_per_minute"],
                "tokens_per_hour": rate_limits["tokens_per_hour"],
                "tokens_per_day": rate_limits["tokens_per_day"],
            },
            "current_usage": current_usage,
            "reset_times": {
                "minute": datetime.now(timezone.utc).replace(second=0, microsecond=0) + timedelta(minutes=1),
                "hour": datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
                + timedelta(hours=1),
                "day": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                + timedelta(days=1),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting user rate limits: %s", sanitize_for_logging(str(e)))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/profile", response_model=UserProfileResponse, tags=["authentication"])
async def get_user_profile_endpoint(api_key: str = Depends(get_api_key)):
    """Get user profile information"""
    try:
        logger.info(
            "Getting user profile for API key: %s", sanitize_for_logging(api_key[:10] + "...")
        )

        user = get_user(api_key)
        if not user:
            logger.warning(
                "User not found for API key: %s", sanitize_for_logging(api_key[:10] + "...")
            )
            raise HTTPException(status_code=401, detail="Invalid API key")

        logger.info(
            "User found: %s, fetching profile...", sanitize_for_logging(str(user.get("id")))
        )

        profile = get_user_profile(api_key)
        if not profile:
            logger.error(
                "Failed to get profile for user %s", sanitize_for_logging(str(user.get("id")))
            )
            raise HTTPException(status_code=500, detail="Failed to retrieve user profile")

        logger.info(
            "Profile retrieved successfully for user %s", sanitize_for_logging(str(user.get("id")))
        )

        # Ensure credits is an integer for Pydantic validation
        if profile and "credits" in profile:
            profile["credits"] = int(profile["credits"])

        return profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting user profile: %s", sanitize_for_logging(str(e)), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.put("/user/profile", response_model=UserProfileResponse, tags=["authentication"])
async def update_user_profile_endpoint(
    profile_update: UserProfileUpdate, api_key: str = Depends(get_api_key)
):
    """Update user profile information"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Validate that at least one field is provided
        if not any(
            [
                profile_update.name is not None,
                profile_update.email is not None,
                profile_update.preferences is not None,
                profile_update.settings is not None,
            ]
        ):
            raise HTTPException(
                status_code=400, detail="At least one profile field must be provided"
            )

        # Update user profile
        updated_user = update_user_profile(api_key, profile_update.model_dump(exclude_unset=True))

        if not updated_user:
            raise HTTPException(status_code=500, detail="Failed to update user profile")

        # Return updated profile
        profile = get_user_profile(api_key)
        return profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating user profile: %s", sanitize_for_logging(str(e)))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/user/account", response_model=DeleteAccountResponse, tags=["authentication"])
async def delete_user_account_endpoint(
    confirmation: DeleteAccountRequest, api_key: str = Depends(get_api_key)
):
    """Delete a user account and all associated data"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Verify confirmation
        if confirmation.confirmation != "DELETE_ACCOUNT":
            raise HTTPException(
                status_code=400,
                detail="Confirmation must be 'DELETE_ACCOUNT' to proceed with account deletion",
            )

        # Delete a user account
        success = delete_user_account(api_key)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete user account")

        logger.debug(
            "Account deletion returning user id %s (%s)", user.get("id"), type(user.get("id"))
        )
        return {
            "status": "success",
            "message": "User account deleted successfully",
            "user_id": str(user["id"]),
            "timestamp": datetime.now(timezone.utc),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting user account: %s", sanitize_for_logging(str(e)))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/credit-transactions", tags=["authentication"])
async def get_credit_transactions_endpoint(
    limit: int = 50,
    offset: int = 0,
    transaction_type: str = None,
    api_key: str = Depends(get_api_key),
):
    """
    Get credit transaction history for the authenticated user

    Shows all credit additions and deductions including:
    - Trial credits
    - Stripe purchases
    - API usage
    - Admin adjustments
    - Refunds
    - Bonuses

    Args:
        limit: Maximum number of transactions to return (default: 50)
        offset: Number of transactions to skip (default: 0)
        transaction_type: Optional filter by type (trial, purchase, api_usage, etc.)
        api_key: Authenticated user's API key

    Returns:
        List of credit transactions with running balance
    """
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        user_id = user["id"]

        # Get transactions
        transactions = get_user_transactions(
            user_id=user_id, limit=limit, offset=offset, transaction_type=transaction_type
        )

        # Get summary
        summary = get_transaction_summary(user_id)

        return {
            "transactions": [
                {
                    "id": txn["id"],
                    "amount": float(txn["amount"]),
                    "transaction_type": txn["transaction_type"],
                    "description": txn.get("description", ""),
                    "balance_before": float(txn["balance_before"]),
                    "balance_after": float(txn["balance_after"]),
                    "created_at": txn["created_at"],
                    "payment_id": txn.get("payment_id"),
                    "metadata": txn.get("metadata", {}),
                }
                for txn in transactions
            ],
            "summary": summary,
            "total": len(transactions),
            "limit": limit,
            "offset": offset,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting credit transactions: %s", sanitize_for_logging(str(e)))
        raise HTTPException(status_code=500, detail="Internal server error")
