from typing import Optional
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.db.users import get_user
from src.security.deps import get_api_key
from src.services.referral import (
    create_user_referral_code,
    get_referral_stats,
    validate_referral_code,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Get frontend URL from environment variable
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://gatewayz.ai")


# ==================== Request/Response Models ====================


class ValidateReferralRequest(BaseModel):
    referral_code: str = Field(..., description="The referral code to validate")


class ValidateReferralResponse(BaseModel):
    valid: bool
    message: Optional[str] = None
    referrer_username: Optional[str] = None
    referrer_email: Optional[str] = None


class ReferralStatsResponse(BaseModel):
    referral_code: str
    invite_link: str
    total_uses: int
    completed_bonuses: int
    pending_bonuses: int
    remaining_uses: int
    max_uses: int
    total_earned: float
    current_balance: float
    referred_by_code: Optional[str]
    referrals: list


# ==================== Endpoints ====================


@router.get("/referral/stats", tags=["referral"], response_model=ReferralStatsResponse)
async def get_my_referral_stats(api_key: str = Depends(get_api_key)):
    """
    Get referral statistics for the authenticated user.

    Returns information about:
    - Your unique referral code
    - Shareable invite link
    - How many people have used your code
    - How much you've earned from referrals
    - Remaining uses available
    """
    try:
        # Get user from API key
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Get stats
        stats = get_referral_stats(user["id"])

        if not stats:
            raise HTTPException(status_code=404, detail="Unable to fetch referral stats")

        # Add invite link to stats
        referral_code = stats["referral_code"]
        stats["invite_link"] = f"{FRONTEND_URL}/register?ref={referral_code}"

        return stats

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting referral stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/referral/validate", tags=["referral"], response_model=ValidateReferralResponse)
async def validate_referral(request: ValidateReferralRequest, api_key: str = Depends(get_api_key)):
    """
    Validate if a referral code can be used by the authenticated user.

    Checks:
    - Code exists
    - User hasn't already used a referral code
    - User hasn't made their first purchase yet
    - Code hasn't reached its usage limit (10 uses)
    - User isn't trying to use their own code
    """
    try:
        # Get user from API key
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Validate the referral code
        is_valid, error_message, referrer = validate_referral_code(
            request.referral_code, user["id"]
        )

        if is_valid:
            return ValidateReferralResponse(
                valid=True,
                message="Referral code is valid and can be used",
                referrer_username=referrer.get("username") if referrer else None,
                referrer_email=referrer.get("email") if referrer else None,
            )
        else:
            return ValidateReferralResponse(valid=False, message=error_message)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating referral code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/referral/generate", tags=["referral"])
async def generate_my_referral_code(api_key: str = Depends(get_api_key)):
    """
    Generate a referral code for the authenticated user if they don't have one.

    If the user already has a referral code, returns the existing code.
    """
    try:
        # Get user from API key
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Check if user already has a code
        if user.get("referral_code"):
            return {
                "referral_code": user["referral_code"],
                "message": "You already have a referral code",
            }

        # Generate new code
        referral_code = create_user_referral_code(user["id"])

        return {"referral_code": referral_code, "message": "Referral code created successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating referral code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/referral/code", tags=["referral"])
async def get_my_referral_code(api_key: str = Depends(get_api_key)):
    """
    Get your referral code and shareable invite link.

    If you don't have a referral code yet, one will be created automatically.

    Returns:
    - referral_code: Your unique 8-character code
    - invite_link: Shareable URL that pre-fills the code for new users
    - share_message: Copy-paste message with your invite link
    """
    try:
        # Get user from API key
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        referral_code = user.get("referral_code")

        # If no code exists, create one
        if not referral_code:
            referral_code = create_user_referral_code(user["id"])

        # Generate invite link
        invite_link = f"{FRONTEND_URL}/register?ref={referral_code}"

        return {
            "referral_code": referral_code,
            "invite_link": invite_link,
            "share_message": f"Get $10 in free AI credits on gatewayz: {invite_link}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting referral code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
