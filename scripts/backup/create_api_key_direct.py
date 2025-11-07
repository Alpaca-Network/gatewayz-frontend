#!/usr/bin/env python3
"""
Create API key directly through Supabase
"""
import os
import secrets
import hashlib
from datetime import datetime, timezone
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase credentials not found in .env")
    exit(1)

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    # Generate a secure API key
    api_key = f"gw_{secrets.token_urlsafe(32)}"

    # Hash the API key for storage
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

    # Create test user data
    test_user = {
        "email": f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
        "username": f"test_user_{secrets.token_hex(4)}",
        "auth_method": "email",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Insert user
    print("Creating test user...")
    user_response = supabase.table("users").insert(test_user).execute()

    if not user_response.data:
        print("❌ Failed to create user")
        exit(1)

    user_id = user_response.data[0]["id"]
    print(f"✅ Created user: {test_user['email']} (ID: {user_id})")

    # Create API key (only include fields that exist in schema)
    api_key_data = {
        "user_id": user_id,
        "api_key": api_key,  # Store the actual key
        "key_name": "Test API Key",
        "is_active": True,
        "is_primary": True,  # Primary keys have full permissions
        "requests_used": 0,
        "environment_tag": "development",
        "scope_permissions": {},  # Empty means full access
        "ip_allowlist": [],
        "domain_referrers": [],
        "last_used_at": datetime.now(timezone.utc).isoformat()
    }

    print("Creating API key...")
    key_response = supabase.table("api_keys_new").insert(api_key_data).execute()

    if not key_response.data:
        print("❌ Failed to create API key")
        exit(1)

    print("\n" + "="*60)
    print("✅ API Key created successfully!")
    print("="*60)
    print(f"\nYour API Key: {api_key}")
    print(f"\nUser Email: {test_user['email']}")
    print(f"User ID: {user_id}")
    print("\n" + "="*60)
    print("\nTest it with:")
    print(f'export API_KEY="{api_key}"')
    print(f'\ncurl -X POST http://localhost:8000/v1/chat/completions \\')
    print(f'  -H "Content-Type: application/json" \\')
    print(f'  -H "Authorization: Bearer {api_key}" \\')
    print(f'  -d \'{{"model": "gemini-2.0-flash", "messages": [{{"role": "user", "content": "Hello"}}]}}\'')
    print("\n" + "="*60)

    # Save to file
    with open(".test_api_key", "w") as f:
        f.write(api_key)
    print("\n💾 API key saved to .test_api_key")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
