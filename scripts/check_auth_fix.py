#!/usr/bin/env python3
"""
Test script to verify the API key auth fix
"""
import os
import sys
# Add parent directory to path to import src modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.db.users import get_user, get_user_by_id
from src.supabase_config import get_supabase_client

def test_user_api_key_lookup(user_id: int):
    """Test API key lookup for a specific user"""
    print(f"\n{'='*70}")
    print(f"Testing API Key Lookup for User ID: {user_id}")
    print(f"{'='*70}\n")

    client = get_supabase_client()

    # 1. Get user from users table
    user_result = client.table('users').select('*').eq('id', user_id).execute()

    if not user_result.data:
        print(f"❌ User {user_id} not found in users table")
        return

    user = user_result.data[0]
    print(f"✅ User found in users table:")
    print(f"   Username: {user.get('username')}")
    print(f"   Email: {user.get('email')}")
    print(f"   API Key (users table): {user.get('api_key', 'N/A')[:20]}...")
    print(f"   Credits: {user.get('credits', 0)}")

    # 2. Get API keys from api_keys_new table
    keys_result = client.table('api_keys_new').select('*').eq('user_id', user_id).execute()

    if not keys_result.data:
        print(f"\n⚠️  No API keys found in api_keys_new table")
        print(f"   This user needs to be migrated to the new system")
    else:
        print(f"\n✅ API keys found in api_keys_new table:")
        for idx, key in enumerate(keys_result.data, 1):
            print(f"\n   Key #{idx}:")
            print(f"      Name: {key.get('key_name')}")
            print(f"      API Key: {key.get('api_key', 'N/A')[:20]}...")
            print(f"      Environment: {key.get('environment_tag', 'N/A')}")
            print(f"      Is Primary: {key.get('is_primary', False)}")
            print(f"      Is Active: {key.get('is_active', False)}")

    # 3. Test get_user function with the key from users table
    users_table_key = user.get('api_key')
    if users_table_key:
        print(f"\n{'='*70}")
        print("Testing get_user() with key from users.api_key:")
        print(f"{'='*70}")
        fetched_user = get_user(users_table_key)
        if fetched_user:
            print(f"✅ get_user() successfully found user with users.api_key")
            print(f"   User ID: {fetched_user.get('id')}")
            print(f"   Username: {fetched_user.get('username')}")
        else:
            print(f"❌ get_user() FAILED to find user with users.api_key")
            print(f"   Key tested: {users_table_key[:20]}...")

    # 4. Test get_user function with primary key from api_keys_new
    if keys_result.data:
        primary_keys = [k for k in keys_result.data if k.get('is_primary')]
        if primary_keys:
            primary_key = primary_keys[0]['api_key']
            print(f"\n{'='*70}")
            print("Testing get_user() with primary key from api_keys_new:")
            print(f"{'='*70}")
            fetched_user = get_user(primary_key)
            if fetched_user:
                print(f"✅ get_user() successfully found user with primary key")
                print(f"   User ID: {fetched_user.get('id')}")
                print(f"   Username: {fetched_user.get('username')}")
            else:
                print(f"❌ get_user() FAILED to find user with primary key")
                print(f"   Key tested: {primary_key[:20]}...")

    print(f"\n{'='*70}\n")


def test_auth_flow_simulation(user_id: int):
    """Simulate the auth flow to see what key would be returned"""
    print(f"\n{'='*70}")
    print(f"Simulating Auth Flow for User ID: {user_id}")
    print(f"{'='*70}\n")

    client = get_supabase_client()

    # Get user
    user_result = client.table('users').select('*').eq('id', user_id).execute()

    if not user_result.data:
        print(f"❌ User {user_id} not found")
        return

    existing_user = user_result.data[0]

    # Get primary API key (simulating the fixed auth endpoint logic)
    primary_key_result = client.table('api_keys_new').select('api_key').eq('user_id', user_id).eq('is_primary', True).execute()

    api_key_to_return = existing_user['api_key']  # Default fallback
    if primary_key_result.data and len(primary_key_result.data) > 0:
        api_key_to_return = primary_key_result.data[0]['api_key']
        print(f"✅ Auth endpoint would return primary key from api_keys_new:")
        print(f"   {api_key_to_return[:20]}...")
    else:
        print(f"⚠️  Auth endpoint would return legacy key from users.api_key:")
        print(f"   {api_key_to_return[:20] if api_key_to_return else 'None'}...")

    # Test if this key works with get_user
    print(f"\nTesting if returned key works with get_user()...")
    test_user = get_user(api_key_to_return)
    if test_user:
        print(f"✅ SUCCESS: Key can be used to retrieve user")
        print(f"   User ID: {test_user.get('id')}")
        print(f"   Username: {test_user.get('username')}")
        print(f"   Credits: {test_user.get('credits', 0)}")
    else:
        print(f"❌ FAILURE: Key CANNOT be used to retrieve user")
        print(f"   This user will experience a 403 error")

    print(f"\n{'='*70}\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python test_auth_fix.py <user_id>")
        print("\nExample: python test_auth_fix.py 22")
        sys.exit(1)

    try:
        user_id = int(sys.argv[1])
        test_user_api_key_lookup(user_id)
        test_auth_flow_simulation(user_id)

        print("\n" + "="*70)
        print("FIX VERIFICATION")
        print("="*70)
        print("\nThe fix ensures that:")
        print("1. Auth endpoint queries api_keys_new table for primary key")
        print("2. Falls back to users.api_key only if no primary key exists")
        print("3. Returned key is guaranteed to work with get_user()")
        print("\nIf the tests above show SUCCESS, the fix is working correctly!")
        print("="*70 + "\n")

    except ValueError:
        print(f"Error: '{sys.argv[1]}' is not a valid user ID")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
