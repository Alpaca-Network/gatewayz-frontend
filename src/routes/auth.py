import logging
import datetime
from datetime import datetime, timezone

from src.enhanced_notification_service import enhanced_notification_service
from fastapi import APIRouter, HTTPException

from src.supabase_config import get_supabase_client
from src.models import PrivyAuthRequest, PrivyAuthResponse, AuthMethod
from src.db.users import get_user_by_privy_id, create_enhanced_user

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/auth", response_model=PrivyAuthResponse, tags=["authentication"])
async def privy_auth(request: PrivyAuthRequest):
    """Authenticate user via Privy and return API key"""
    try:
        logger.info(f"Privy auth request for user: {request.user.id}")

        # Extract user info from Privy linked accounts
        email = None
        display_name = None
        auth_method = AuthMethod.EMAIL  # Default

        for account in request.user.linked_accounts:
            if account.type == "email" and account.email:
                email = account.email
                auth_method = AuthMethod.EMAIL
            elif account.type == "google_oauth" and account.email:
                email = account.email
                display_name = account.name
                auth_method = AuthMethod.GOOGLE
            elif account.type == "github" and account.name:
                display_name = account.name
                auth_method = AuthMethod.GITHUB

        # Check if user already exists by privy_user_id
        existing_user = get_user_by_privy_id(request.user.id)

        if existing_user:
            # Existing user - return their info
            logger.info(f"Existing Privy user found: {existing_user['id']}")
            
            # Send welcome email if they haven't received one yet
            user_email = existing_user.get('email') or email
            logger.info(f"Welcome email check - User ID: {existing_user['id']}, Email: {user_email}, Welcome sent: {existing_user.get('welcome_email_sent', 'Not set')}")
            
            if user_email:
                try:
                    logger.info(f"Attempting to send welcome email to user {existing_user['id']} with email {user_email}")
                    success = enhanced_notification_service.send_welcome_email_if_needed(
                        user_id=existing_user['id'],
                        username=existing_user.get('username') or display_name,
                        email=user_email,
                        credits=existing_user.get('credits', 0)
                    )
                    logger.info(f"Welcome email result for user {existing_user['id']}: {success}")
                except Exception as e:
                    logger.error(f"Failed to send welcome email to existing user: {e}")
            else:
                logger.warning(f"No email found for user {existing_user['id']}, skipping welcome email")
            
            return PrivyAuthResponse(
                success=True,
                message="Login successful",
                user_id=existing_user['id'],
                api_key=existing_user['api_key'],
                auth_method=auth_method,
                privy_user_id=request.user.id,
                is_new_user=False,
                display_name=existing_user.get('username') or display_name,
                email=existing_user.get('email') or email,
                credits=existing_user.get('credits', 0),
                timestamp=datetime.now(timezone.utc)
            )
        else:
            # New user - create account
            logger.info(f"Creating new Privy user: {request.user.id}")

            # Generate username from email or privy ID
            username = email.split('@')[0] if email else f"user_{request.user.id[:8]}"

            # Create user with Privy ID
            user_data = create_enhanced_user(
                username=username,
                email=email or f"{request.user.id}@privy.user",
                auth_method=auth_method,
                privy_user_id=request.user.id,
                credits=10  # $10 worth of credits for new users
            )

            # Send welcome email if we have an email
            if email:
                try:
                    success = enhanced_notification_service.send_welcome_email(
                        user_id=user_data['user_id'],
                        username=user_data['username'],
                        email=email,
                        credits=user_data['credits']
                    )
                    # Only mark welcome email as sent if it was actually sent successfully
                    if success:
                        from src.db.users import mark_welcome_email_sent
                        mark_welcome_email_sent(user_data['user_id'])
                        logger.info(f"Welcome email sent and marked as sent for new user {user_data['user_id']}")
                    else:
                        logger.warning(f"Welcome email failed to send for new user {user_data['user_id']}")
                except Exception as e:
                    logger.warning(f"Failed to send welcome email: {e}")

            logger.info(f"New Privy user created: {user_data['user_id']}")

            return PrivyAuthResponse(
                success=True,
                message="Account created successfully",
                user_id=user_data['user_id'],
                api_key=user_data['primary_api_key'],
                auth_method=auth_method,
                privy_user_id=request.user.id,
                is_new_user=True,
                display_name=display_name or user_data['username'],
                email=email,
                credits=user_data['credits'],
                timestamp=datetime.now(timezone.utc)
            )

    except Exception as e:
        logger.error(f"Privy authentication failed: {e}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


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
