#!/usr/bin/env python3
"""Verify that user 29 now has a valid API key"""

from src.supabase_config import get_supabase_client

client = get_supabase_client()

# Get user 29 info
user_result = client.table('users').select('id, email, api_key, privy_user_id').eq('id', 29).execute()

if user_result.data:
    user = user_result.data[0]
    print(f"\nUser 29:")
    print(f"  Email: {user['email']}")
    print(f"  users.api_key: {user['api_key']}")
    print(f"  privy_user_id: {user['privy_user_id']}")

    # Get API keys from api_keys_new
    keys_result = client.table('api_keys_new').select('id, api_key, is_primary, is_active, key_name, environment_tag').eq('user_id', 29).execute()

    if keys_result.data:
        print(f"\n  API keys in api_keys_new table:")
        for key in keys_result.data:
            print(f"    - ID: {key['id']}")
            print(f"      Name: {key['key_name']}")
            print(f"      Key: {key['api_key'][:20]}...")
            print(f"      Primary: {key['is_primary']}")
            print(f"      Active: {key['is_active']}")
            print(f"      Environment: {key['environment_tag']}")
            print()
    else:
        print("  ❌ NO API keys found in api_keys_new table")
else:
    print("User 29 not found")
