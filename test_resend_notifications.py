#!/usr/bin/env python3
"""
Test script for Resend notification system
Tests low balance notifications and trial expiry alerts using Resend
"""

import requests
import json
import time
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
BASE_URL = "http://localhost:8000"

def test_resend_configuration():
    """Test Resend configuration"""
    print("🔧 Testing Resend Configuration...")
    
    # Debug: Show all environment variables that start with RESEND
    print("\n🔍 Debugging Environment Variables:")
    resend_vars = {k: v for k, v in os.environ.items() if 'RESEND' in k.upper() or 'FROM_EMAIL' in k.upper() or 'APP_NAME' in k.upper()}
    
    if resend_vars:
        for key, value in resend_vars.items():
            if 'KEY' in key.upper():
                print(f"   {key}: {value[:8]}...{value[-4:] if len(value) > 12 else '***'}")
            else:
                print(f"   {key}: {value}")
    else:
        print("   No Resend-related environment variables found")
    
    # Check if Resend API key is set
    resend_key = os.environ.get("RESEND_API_KEY")
    if not resend_key:
        print("\n❌ RESEND_API_KEY environment variable not set")
        print("   Please set one of the following:")
        print("   1. export RESEND_API_KEY=your_resend_api_key")
        print("   2. Create a .env file with RESEND_API_KEY=your_resend_api_key")
        print("   3. Set it in your system environment variables")
        return False
    
    print(f"\n✅ RESEND_API_KEY is configured: {resend_key[:8]}...")
    
    # Check other required environment variables
    from_email = os.environ.get("FROM_EMAIL", "noreply@yourdomain.com")
    app_name = os.environ.get("APP_NAME", "AI Gateway")
    
    print(f"✅ FROM_EMAIL: {from_email}")
    print(f"✅ APP_NAME: {app_name}")
    
    return True

def test_notification_preferences():
    """Test notification preferences endpoints"""
    print("\n🔔 Testing Notification Preferences...")
    
    # You'll need a valid API key for testing
    api_key = input("Enter your API key for testing: ").strip()
    
    if not api_key:
        print("❌ No API key provided, skipping user tests")
        return
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Test get preferences
        print("\n1. Getting notification preferences...")
        response = requests.get(f"{BASE_URL}/user/notifications/preferences", headers=headers)
        
        if response.status_code == 200:
            prefs = response.json()
            print(f"✅ Preferences retrieved:")
            print(f"   Email Notifications: {prefs.get('email_notifications')}")
            print(f"   Low Balance Threshold: ${prefs.get('low_balance_threshold')}")
            print(f"   Trial Expiry Reminder Days: {prefs.get('trial_expiry_reminder_days')}")
        else:
            print(f"❌ Error getting preferences: {response.status_code} - {response.text}")
        
        # Test update preferences
        print("\n2. Updating notification preferences...")
        update_data = {
            "low_balance_threshold": 5.0,
            "trial_expiry_reminder_days": 2
        }
        
        response = requests.put(
            f"{BASE_URL}/user/notifications/preferences", 
            headers=headers,
            json=update_data
        )
        
        if response.status_code == 200:
            print("✅ Preferences updated successfully")
        else:
            print(f"❌ Error updating preferences: {response.status_code} - {response.text}")
        
        # Test send test notification
        print("\n3. Sending test notification via Resend...")
        test_data = {"notification_type": "low_balance"}
        
        response = requests.post(
            f"{BASE_URL}/user/notifications/test",
            headers=headers,
            json=test_data
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Test notification: {result.get('status')} - {result.get('message')}")
            print("   Check your email inbox for the test notification!")
        else:
            print(f"❌ Error sending test notification: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Exception during preference testing: {e}")

def test_admin_notifications():
    """Test admin notification endpoints"""
    print("\n🔧 Testing Admin Notification Features...")
    
    admin_key = input("Enter admin API key for testing (or press Enter to skip): ").strip()
    
    if not admin_key:
        print("❌ No admin key provided, skipping admin tests")
        return
    
    headers = {
        'Authorization': f'Bearer {admin_key}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Test notification stats
        print("\n1. Getting notification statistics...")
        response = requests.get(f"{BASE_URL}/admin/notifications/stats", headers=headers)
        
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Notification stats:")
            print(f"   Total Notifications: {stats.get('total_notifications')}")
            print(f"   Sent Notifications: {stats.get('sent_notifications')}")
            print(f"   Failed Notifications: {stats.get('failed_notifications')}")
            print(f"   Delivery Rate: {stats.get('delivery_rate')}%")
            print(f"   Last 24h Notifications: {stats.get('last_24h_notifications')}")
        else:
            print(f"❌ Error getting stats: {response.status_code} - {response.text}")
        
        # Test process notifications
        print("\n2. Processing notifications...")
        response = requests.post(f"{BASE_URL}/admin/notifications/process", headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Notifications processed: {result.get('message')}")
            if 'stats' in result:
                stats = result['stats']
                print(f"   Low Balance Alerts Sent: {stats.get('low_balance_alerts_sent', 0)}")
                print(f"   Trial Expiry Alerts Sent: {stats.get('trial_expiry_alerts_sent', 0)}")
                print(f"   Errors: {stats.get('errors', 0)}")
        else:
            print(f"❌ Error processing notifications: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Exception during admin testing: {e}")

def test_resend_direct():
    """Test Resend directly"""
    print("\n📧 Testing Resend Direct Integration...")
    
    try:
        import resend
        
        # Check if resend is properly installed
        print("✅ Resend SDK imported successfully")
        
        # Test Resend API key
        api_key = os.environ.get("RESEND_API_KEY")
        if api_key:
            resend.api_key = api_key
            print("✅ Resend API key set")
            
            # Test sending a simple email
            print("\nSending test email via Resend...")
            response = resend.Emails.send({
                "from": os.environ.get("FROM_EMAIL", "noreply@yourdomain.com"),
                "to": [input("Enter your email address for testing: ").strip()],
                "subject": "Test Email from AI Gateway",
                "html": "<h1>Test Email</h1><p>This is a test email sent via Resend!</p>"
            })
            
            if response and response.get('id'):
                print(f"✅ Test email sent successfully! ID: {response['id']}")
                print("   Check your email inbox!")
            else:
                print(f"❌ Failed to send test email: {response}")
        else:
            print("❌ RESEND_API_KEY not found in environment")
            
    except ImportError:
        print("❌ Resend SDK not installed. Run: pip install resend")
    except Exception as e:
        print(f"❌ Error testing Resend directly: {e}")

def test_notification_system_health():
    """Test notification system health"""
    print("\n🏥 Testing Notification System Health...")
    
    try:
        # Test health endpoint
        response = requests.get(f"{BASE_URL}/health")
        
        if response.status_code == 200:
            print("✅ API is healthy")
        else:
            print(f"❌ API health check failed: {response.status_code}")
        
        # Test if notification endpoints are available
        response = requests.get(f"{BASE_URL}/docs")
        
        if response.status_code == 200:
            print("✅ API documentation is accessible")
            print("   Visit http://localhost:8000/docs to see notification endpoints")
        else:
            print("❌ API documentation not accessible")
            
    except Exception as e:
        print(f"❌ Exception during health check: {e}")

def main():
    """Run all Resend notification tests"""
    print("🚀 Testing Resend Notification System")
    print("=" * 50)
    
    # Test system health
    test_notification_system_health()
    
    # Test Resend configuration
    if not test_resend_configuration():
        print("\n❌ Resend configuration incomplete. Please set up environment variables first.")
        return
    
    # Test Resend direct integration
    test_resend_direct()
    
    # Test user notification features
    test_notification_preferences()
    
    # Test admin notification features
    test_admin_notifications()
    
    print("\n" + "=" * 50)
    print("✅ Resend notification system testing complete!")
    print("\n📋 Next Steps:")
    print("1. Run the migration: migrations/add_notification_tables.sql")
    print("2. Set up Resend credentials:")
    print("   - Get API key from https://resend.com")
    print("   - Set RESEND_API_KEY environment variable")
    print("   - Set FROM_EMAIL (must be verified in Resend)")
    print("   - Set APP_NAME (your app name)")
    print("3. Verify your domain in Resend dashboard")
    print("4. Test the notification system with real users")
    print("5. Set up a cron job to process notifications regularly")

if __name__ == "__main__":
    main()
