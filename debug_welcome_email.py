#!/usr/bin/env python3
"""
Debug script for welcome email issues
"""

import sys
import os
sys.path.append('src')

from src.enhanced_notification_service import enhanced_notification_service
from src.db.users import get_user_by_privy_id
from src.supabase_config import get_supabase_client

def debug_user_email_issue():
    """Debug why welcome emails aren't being sent"""
    
    print("🔍 Welcome Email Debug Tool")
    print("=" * 40)
    
    # Get your user ID from the database
    client = get_supabase_client()
    
    # Find users with welcome_email_sent = FALSE
    result = client.table('users').select('*').eq('welcome_email_sent', False).execute()
    
    if not result.data:
        print("❌ No users found with welcome_email_sent = FALSE")
        return
    
    print(f"Found {len(result.data)} users with welcome_email_sent = FALSE:")
    
    for user in result.data:
        print(f"\n👤 User Details:")
        print(f"   ID: {user['id']}")
        print(f"   Username: {user.get('username', 'N/A')}")
        print(f"   Email: {user.get('email', 'N/A')}")
        print(f"   Privy User ID: {user.get('privy_user_id', 'N/A')}")
        print(f"   Credits: {user.get('credits', 0)}")
        print(f"   Welcome Email Sent: {user.get('welcome_email_sent', False)}")
        
        # Test the welcome email logic
        print(f"\n🧪 Testing welcome email logic...")
        
        # Test 1: Check if send_welcome_email_if_needed works
        try:
            success = enhanced_notification_service.send_welcome_email_if_needed(
                user_id=user['id'],
                username=user.get('username', 'User'),
                email=user.get('email', ''),
                credits=user.get('credits', 10)
            )
            print(f"   send_welcome_email_if_needed result: {success}")
        except Exception as e:
            print(f"   ❌ Error in send_welcome_email_if_needed: {e}")
        
        # Test 2: Check if direct send_welcome_email works
        try:
            success = enhanced_notification_service.send_welcome_email(
                user_id=user['id'],
                username=user.get('username', 'User'),
                email=user.get('email', ''),
                credits=user.get('credits', 10)
            )
            print(f"   send_welcome_email result: {success}")
        except Exception as e:
            print(f"   ❌ Error in send_welcome_email: {e}")
        
        # Test 3: Check email service configuration
        print(f"\n📧 Email Service Configuration:")
        print(f"   Resend API Key: {'✅ Set' if enhanced_notification_service.resend_api_key else '❌ Not Set'}")
        print(f"   From Email: {enhanced_notification_service.from_email}")
        print(f"   App Name: {enhanced_notification_service.app_name}")
        print(f"   App URL: {enhanced_notification_service.app_url}")
        
        # Ask if user wants to manually send email
        choice = input(f"\nSend welcome email to {user.get('email', 'N/A')}? (y/n): ").strip().lower()
        if choice == 'y':
            try:
                success = enhanced_notification_service.send_welcome_email(
                    user_id=user['id'],
                    username=user.get('username', 'User'),
                    email=user.get('email', ''),
                    credits=user.get('credits', 10)
                )
                if success:
                    print("✅ Welcome email sent successfully!")
                    # Mark as sent
                    from src.db.users import mark_welcome_email_sent
                    mark_welcome_email_sent(user['id'])
                    print("✅ Marked welcome_email_sent as TRUE")
                else:
                    print("❌ Failed to send welcome email")
            except Exception as e:
                print(f"❌ Error sending email: {e}")

if __name__ == "__main__":
    debug_user_email_issue()
