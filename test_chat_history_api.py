#!/usr/bin/env python3
"""
Test script to verify chat history endpoints are working
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.supabase_config import get_supabase_client

def test_chat_history_data():
    """Check if chat history data exists in database"""
    try:
        print("🔍 Checking chat history data in database...\n")

        client = get_supabase_client()

        # Check chat_sessions table
        print("📊 Chat Sessions:")
        sessions_result = client.table('chat_sessions').select('id, user_id, title, created_at, is_active').order('created_at', desc=True).limit(10).execute()

        if sessions_result.data:
            print(f"   ✅ Found {len(sessions_result.data)} sessions")
            for session in sessions_result.data[:5]:
                print(f"      - ID: {session.get('id')}, User: {session.get('user_id')}, Title: {session.get('title')}, Active: {session.get('is_active')}")
        else:
            print("   ⚠️  No sessions found in database")

        # Check chat_messages table
        print("\n💬 Chat Messages:")
        messages_result = client.table('chat_messages').select('id, session_id, role, created_at').order('created_at', desc=True).limit(10).execute()

        if messages_result.data:
            print(f"   ✅ Found {len(messages_result.data)} messages")
            for msg in messages_result.data[:5]:
                print(f"      - ID: {msg.get('id')}, Session: {msg.get('session_id')}, Role: {msg.get('role')}")
        else:
            print("   ⚠️  No messages found in database")

        # Check if there are any active users
        print("\n👥 Active Users:")
        users_result = client.table('users').select('id, username, email').limit(5).execute()

        if users_result.data:
            print(f"   ✅ Found {len(users_result.data)} users")
            for user in users_result.data[:3]:
                print(f"      - ID: {user.get('id')}, Username: {user.get('username', 'N/A')}, Email: {user.get('email')}")
        else:
            print("   ⚠️  No users found")

        print("\n" + "="*60)
        print("💡 Summary:")
        print(f"   Sessions: {len(sessions_result.data) if sessions_result.data else 0}")
        print(f"   Messages: {len(messages_result.data) if messages_result.data else 0}")
        print(f"   Users: {len(users_result.data) if users_result.data else 0}")
        print("="*60)

        if not sessions_result.data:
            print("\n📝 To create chat history data:")
            print("   1. Make a request to POST /v1/chat/sessions to create a session")
            print("   2. Use the session_id query param in /v1/chat/completions")
            print("   3. Example: POST /v1/chat/completions?session_id=123")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_chat_history_data()
