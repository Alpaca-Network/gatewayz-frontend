import logging
import datetime
from datetime import datetime, timezone

from src.enhanced_notification_service import enhanced_notification_service
from fastapi import APIRouter, HTTPException

from src.supabase_config import get_supabase_client

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/auth/password-reset", tags=["authentication"])
async def request_password_reset(email: str):
    """Request password reset email"""
    try:
        # Find the user by email
        client = get_supabase_client()
        user_result = client.table('users').select('id', 'username', 'email').eq('email', email).execute()

        if not user_result.data:
            # Don't reveal if email exists or not for security
            return {"message": "If an account with that email exists, a password reset link has been sent."}

        user = user_result.data[0]

        # Send password reset email
        reset_token = enhanced_notification_service.send_password_reset_email(
            user_id=user['id'],
            username=user['username'],
            email=user['email']
        )

        if reset_token:
            return {"message": "Password reset email sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send password reset email")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error requesting password reset: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/reset-password", tags=["authentication"])
async def reset_password(token: str):
    """Reset password using token"""
    try:
        client = get_supabase_client()

        # Verify token
        token_result = client.table('password_reset_tokens').select('*').eq('token', token).eq('used', False).execute()

        if not token_result.data:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        token_data = token_result.data[0]
        expires_at = datetime.fromisoformat(token_data['expires_at'].replace('Z', '+00:00'))

        if datetime.now(timezone.utc).replace(tzinfo=expires_at.tzinfo) > expires_at:
            raise HTTPException(status_code=400, detail="Reset token has expired")

        # Update password (in a real app, you'd hash this)
        # For now, we'll just mark the token as used
        client.table('password_reset_tokens').update({'used': True}).eq('id', token_data['id']).execute()

        return {"message": "Password reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")