#!/usr/bin/env python3
"""
Test script to verify usage recording is now working
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import record_usage, get_user

def test_usage_recording():
    """Test that usage recording now works correctly"""
    
    # Test with a new gw_ API key (you'll need to replace this with an actual key)
    test_api_key = input("Enter a new gw_ API key to test usage recording: ").strip()
    
    if not test_api_key.startswith('gw_'):
        print("❌ Please provide a new API key that starts with 'gw_'")
        return
    
    print(f"\n🔑 Testing usage recording for API key: {test_api_key[:20]}...")
    
    try:
        # Test 1: Get user info
        print("\n1. Getting user info...")
        user = get_user(test_api_key)
        if user:
            print(f"✅ User found: ID {user['id']}, Credits: {user['credits']}")
        else:
            print("❌ User not found")
            return
        
        # Test 2: Record usage
        print("\n2. Testing usage recording...")
        record_usage(
            user_id=user['id'],
            api_key=test_api_key,
            model='gpt-4',
            tokens_used=150,
            cost=0.003
        )
        print("✅ Usage recording completed")
        
        print("\n🎉 Usage recording test completed successfully!")
        print("\nThe new API key system should now be working correctly.")
        print("Check the usage_records table in your database to confirm the record was created.")
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_usage_recording()
