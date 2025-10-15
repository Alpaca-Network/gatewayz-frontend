#!/usr/bin/env python3
"""
Diagnostic script to check why usage_records table is empty
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from supabase_config import get_supabase_client
from db.users import record_usage, get_user
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_usage_records_table():
    """Check if usage_records table is accessible"""
    print("=" * 80)
    print("1. Checking usage_records table accessibility...")
    print("=" * 80)
    
    try:
        client = get_supabase_client()
        
        # Try to query the table
        result = client.table('usage_records').select('*').limit(10).execute()
        
        print(f"✅ Table is accessible")
        print(f"   Current records: {len(result.data)}")
        
        if result.data:
            print(f"\n   Sample record:")
            for key, value in result.data[0].items():
                print(f"     {key}: {value}")
        else:
            print(f"   ⚠️  Table is EMPTY")
        
        return True
        
    except Exception as e:
        print(f"❌ Error accessing table: {e}")
        return False


def test_insert_usage_record():
    """Test inserting a usage record"""
    print("\n" + "=" * 80)
    print("2. Testing insert into usage_records...")
    print("=" * 80)
    
    try:
        client = get_supabase_client()
        
        # Get a test user
        users_result = client.table('users').select('id, email').limit(1).execute()
        
        if not users_result.data:
            print("❌ No users found in database. Create a user first.")
            return False
        
        test_user = users_result.data[0]
        print(f"   Using test user: {test_user['email']} (ID: {test_user['id']})")
        
        # Try direct insert
        from datetime import datetime, timezone
        
        test_data = {
            'user_id': test_user['id'],
            'api_key': 'test_key_diagnostic',
            'model': 'test-model',
            'tokens_used': 100,
            'cost': 0.01,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        print(f"\n   Attempting direct insert...")
        result = client.table('usage_records').insert(test_data).execute()
        
        if result.data:
            print(f"✅ Insert successful!")
            print(f"   Record ID: {result.data[0]['id']}")
            
            # Verify it's there
            verify = client.table('usage_records').select('*').eq('api_key', 'test_key_diagnostic').execute()
            if verify.data:
                print(f"✅ Verified record exists in database")
            
            return True
        else:
            print(f"❌ Insert returned no data")
            return False
            
    except Exception as e:
        print(f"❌ Error inserting record: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False


def test_record_usage_function():
    """Test the record_usage function"""
    print("\n" + "=" * 80)
    print("3. Testing record_usage() function...")
    print("=" * 80)
    
    try:
        client = get_supabase_client()
        
        # Get a test user with API key
        users_result = client.table('users').select('id, email').limit(1).execute()
        api_keys_result = client.table('api_keys_new').select('api_key, user_id').limit(1).execute()
        
        if not users_result.data:
            print("❌ No users found")
            return False
        
        if not api_keys_result.data:
            print("❌ No API keys found")
            return False
        
        test_user = users_result.data[0]
        test_api_key = api_keys_result.data[0]['api_key']
        
        print(f"   User: {test_user['email']} (ID: {test_user['id']})")
        print(f"   API Key: {test_api_key[:20]}...")
        
        print(f"\n   Calling record_usage()...")
        record_usage(
            user_id=test_user['id'],
            api_key=test_api_key,
            model='test-model-via-function',
            tokens_used=200,
            cost=0.02,
            latency_ms=150
        )
        
        print(f"✅ Function call completed without errors")
        
        # Check if it was inserted
        import time
        time.sleep(1)  # Wait a moment
        
        result = client.table('usage_records').select('*').eq('model', 'test-model-via-function').execute()
        
        if result.data:
            print(f"✅ Record found in database!")
            print(f"   Tokens: {result.data[0]['tokens_used']}")
            print(f"   Cost: {result.data[0]['cost']}")
        else:
            print(f"⚠️  Record NOT found in database after insert")
            print(f"   This might be an RLS (Row Level Security) issue")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing function: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_rls_policies():
    """Check Row Level Security policies"""
    print("\n" + "=" * 80)
    print("4. Checking Row Level Security (RLS) policies...")
    print("=" * 80)
    
    try:
        client = get_supabase_client()
        
        # Try to query using service role (bypasses RLS)
        print("   Note: Standard client might have RLS restrictions")
        print("   If inserts work but queries don't, it's an RLS issue")
        
        # Check if we can select with RLS
        result = client.table('usage_records').select('count').execute()
        print(f"   Can query: ✅")
        
    except Exception as e:
        print(f"   Query error: {e}")


def main():
    print("\n" + "=" * 80)
    print("USAGE RECORDS DIAGNOSTIC TOOL")
    print("=" * 80)
    
    # Run all checks
    check_usage_records_table()
    test_insert_usage_record()
    test_record_usage_function()
    check_rls_policies()
    
    print("\n" + "=" * 80)
    print("DIAGNOSIS SUMMARY")
    print("=" * 80)
    print("""
If the table is accessible but empty:
1. ✅ Make an actual API request to /v1/chat/completions
2. ✅ Ensure you're NOT using a trial account (trials don't save to usage_records)
3. ✅ Check that deduct_credits() is succeeding
4. ⚠️  If direct inserts work but usage_records stays empty, check error logs

If inserts fail:
1. ❌ Check Row Level Security (RLS) policies in Supabase dashboard
2. ❌ Ensure SUPABASE_KEY has proper permissions
3. ❌ Check database schema matches migration files

Next steps:
- Run: python check_usage_recording.py
- Make a real API request: curl -X POST http://localhost:8000/v1/chat/completions ...
- Check logs for: "Usage recorded successfully"
    """)


if __name__ == "__main__":
    main()

