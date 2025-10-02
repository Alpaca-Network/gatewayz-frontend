#!/usr/bin/env python3
"""
Script to fix welcome email issues
"""

import sys
import os
sys.path.append('src')

from src.utils.reset_welcome_emails import get_users_without_welcome_emails, reset_welcome_email_sent
from src.enhanced_notification_service import enhanced_notification_service
from src.supabase_config import get_supabase_client

def fix_welcome_emails():
    """Fix welcome emails for users who should receive them"""
    
    print("🔧 Welcome Email Fix Tool")
    print("=" * 40)
    
    # Get users who haven't received welcome emails
    users_without_emails = get_users_without_welcome_emails()
    
    if not users_without_emails:
        print("✅ All users have welcome_email_sent=True")
        return
    
    print(f"Found {len(users_without_emails)} users without welcome emails:")
    
    for user in users_without_emails:
        print(f"- ID: {user['id']}, Username: {user['username']}, Email: {user['email']}")
    
    print("\nOptions:")
    print("1. Reset welcome_email_sent to False for all users (so they can receive emails)")
    print("2. Send welcome emails to users who don't have welcome_email_sent=True")
    print("3. Check specific user")
    
    choice = input("\nEnter your choice (1-3): ").strip()
    
    if choice == "1":
        # Reset all users
        confirm = input("Are you sure you want to reset ALL users? (yes/no): ").strip().lower()
        if confirm == "yes":
            success = reset_welcome_email_sent(all_users=True)
            if success:
                print("✅ Reset welcome_email_sent for all users")
            else:
                print("❌ Failed to reset users")
        else:
            print("Operation cancelled")
    
    elif choice == "2":
        # Send welcome emails to users who need them
        print("\nSending welcome emails...")
        for user in users_without_emails:
            try:
                success = enhanced_notification_service.send_welcome_email(
                    user_id=user['id'],
                    username=user['username'],
                    email=user['email'],
                    credits=user.get('credits', 10)
                )
                if success:
                    print(f"✅ Sent welcome email to {user['email']}")
                else:
                    print(f"❌ Failed to send welcome email to {user['email']}")
            except Exception as e:
                print(f"❌ Error sending to {user['email']}: {e}")
    
    elif choice == "3":
        # Check specific user
        user_id = input("Enter user ID: ").strip()
        try:
            user_id = int(user_id)
            client = get_supabase_client()
            result = client.table('users').select('*').eq('id', user_id).execute()
            
            if result.data:
                user = result.data[0]
                print(f"\nUser Details:")
                print(f"ID: {user['id']}")
                print(f"Username: {user['username']}")
                print(f"Email: {user['email']}")
                print(f"Welcome Email Sent: {user.get('welcome_email_sent', 'Not set')}")
                print(f"Credits: {user.get('credits', 0)}")
                
                # Ask if they want to send welcome email
                send_email = input("\nSend welcome email to this user? (yes/no): ").strip().lower()
                if send_email == "yes":
                    success = enhanced_notification_service.send_welcome_email(
                        user_id=user['id'],
                        username=user['username'],
                        email=user['email'],
                        credits=user.get('credits', 10)
                    )
                    if success:
                        print("✅ Welcome email sent successfully")
                    else:
                        print("❌ Failed to send welcome email")
            else:
                print("❌ User not found")
        except ValueError:
            print("❌ Invalid user ID")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    else:
        print("❌ Invalid choice")

if __name__ == "__main__":
    fix_welcome_emails()
