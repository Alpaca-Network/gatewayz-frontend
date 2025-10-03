import datetime
import os
import logging



from src.db.users import  get_user
from src.enhanced_notification_service import enhanced_notification_service
from fastapi import APIRouter, Query
from datetime import datetime
from fastapi import Depends, HTTPException
from src.security.deps import get_api_key
from src.schemas.notification import NotificationPreferences, UpdateNotificationPreferencesRequest, \
    NotificationType, SendNotificationRequest, NotificationChannel, NotificationStats
from src.services.notification import notification_service

from src.supabase_config import get_supabase_client

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()

## Notification Endpoints

@router.get("/user/notifications/preferences", response_model=NotificationPreferences, tags=["notifications"])
async def get_notification_preferences(api_key: str = Depends(get_api_key)):
    """Get user notification preferences"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        preferences = notification_service.get_user_preferences(user['id'])
        if not preferences:
            # Create default preferences if they don't exist
            preferences = notification_service.create_user_preferences(user['id'])

        return preferences
    except Exception as e:
        logger.error(f"Error getting notification preferences: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/user/notifications/preferences", tags=["notifications"])
async def update_notification_preferences(
        request: UpdateNotificationPreferencesRequest,
        api_key: str = Depends(get_api_key)
):
    """Update user notification preferences"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Convert request to dict, excluding None values
        updates = {k: v for k, v in request.model_dump().items() if v is not None}

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        success = notification_service.update_user_preferences(user['id'], updates)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update preferences")

        return {
            "status": "success",
            "message": "Notification preferences updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating notification preferences: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/user/notifications/test", tags=["notifications"])
async def test_notification(
        notification_type: NotificationType = Query(..., description="Type of notification to test"),
        api_key: str = Depends(get_api_key)
):
    """Send test notification to a user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Create a test notification based on type
        if notification_type == NotificationType.LOW_BALANCE:
            subject = f"Test Low Balance Alert - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Low Balance Alert</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification for low balance alerts.</p>
                <p>Current Credits: ${user.get('credits', 0):.2f}</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """
        elif notification_type == NotificationType.TRIAL_EXPIRING:
            subject = f"Test Trial Expiry Alert - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Trial Expiry Alert</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification for trial expiry alerts.</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """
        elif notification_type == NotificationType.SUBSCRIPTION_EXPIRING:
            subject = f"Test Subscription Expiry Alert - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Subscription Expiry Alert</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification for subscription expiry alerts.</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """
        else:
            subject = f"Test Notification - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Notification</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification.</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """

        request = SendNotificationRequest(
            user_id=user['id'],
            type=notification_type,
            channel=NotificationChannel.EMAIL,
            subject=subject,
            content=content,
            metadata={'test': True}
        )

        success = notification_service.create_notification(request)

        return {
            "status": "success" if success else "failed",
            "message": "Test notification sent successfully" if success else "Failed to send test notification"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending test notification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/user/notifications/send-usage-report", tags=["notifications"])
async def send_usage_report(
        month: str = Query(..., description="Month to send report for (YYYY-MM)"),
        api_key: str = Depends(get_api_key)
):
    """Send monthly usage report email"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # This is a simplified example - you'd need to implement actual usage tracking
        usage_stats = {
            'total_requests': 1000,
            'tokens_used': 50000,
            'credits_spent': 5.00,
            'remaining_credits': user.get('credits', 0)
        }

        success = enhanced_notification_service.send_monthly_usage_report(
            user_id=user['id'],
            username=user['username'],
            email=user['email'],
            month=month,
            usage_stats=usage_stats
        )

        if success:
            return {"message": "Usage report sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send usage report")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending usage report: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/admin/notifications/stats", response_model=NotificationStats, tags=["admin"])
async def get_notification_stats():
    """Get notification statistics for admin"""
    try:
        client = get_supabase_client()

        # Get notification counts
        logger.info("Fetching notification counts...")
        result = client.table('notifications').select('status').execute()
        notifications = result.data if result.data else []

        total_notifications = len(notifications)
        sent_notifications = len([n for n in notifications if n['status'] == 'sent'])
        failed_notifications = len([n for n in notifications if n['status'] == 'failed'])
        pending_notifications = len([n for n in notifications if n['status'] == 'pending'])

        delivery_rate = (sent_notifications / total_notifications * 100) if total_notifications > 0 else 0

        # Get last 24-hour notifications - use a simpler approach
        logger.info("Fetching recent notifications...")
        try:
            yesterday = (datetime.now(datetime.UTC) - datetime.timedelta(days=1)).isoformat()
            recent_result = client.table('notifications').select('id').gte('created_at', yesterday).execute()
            last_24h_notifications = len(recent_result.data) if recent_result.data else 0
        except Exception as recent_error:
            logger.warning(f"Error fetching recent notifications: {recent_error}")
            # Fallback: get all notifications and filter in Python
            all_notifications = client.table('notifications').select('created_at').execute()
            if all_notifications.data:
                yesterday_dt = datetime.now(datetime.UTC) - datetime.timedelta(days=1)
                last_24h_notifications = len([
                    n for n in all_notifications.data
                    if datetime.fromisoformat(n['created_at'].replace('Z', '+00:00')) >= yesterday_dt
                ])
            else:
                last_24h_notifications = 0

        logger.info(
            f"Notification stats calculated: total={total_notifications}, sent={sent_notifications}, failed={failed_notifications}, pending={pending_notifications}")

        return NotificationStats(
            total_notifications=total_notifications,
            sent_notifications=sent_notifications,
            failed_notifications=failed_notifications,
            pending_notifications=pending_notifications,
            delivery_rate=round(delivery_rate, 2),
            last_24h_notifications=last_24h_notifications
        )
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/admin/notifications/process", tags=["admin"])
async def process_notifications():
    """Process all pending notifications (admin only)"""
    try:
        stats = notification_service.process_notifications()

        return {
            "status": "success",
            "message": "Notifications processed successfully",
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error processing notifications: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
