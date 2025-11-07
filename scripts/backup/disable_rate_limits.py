#!/usr/bin/env python3
"""
Disable or adjust rate limits for testing
"""
import os
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
    # Read test API key to get user ID
    with open(".test_api_key", "r") as f:
        api_key = f.read().strip()

    print(f"Looking up API key: {api_key[:20]}...")

    # Get API key record
    key_result = supabase.table("api_keys_new").select("*").eq("api_key", api_key).execute()

    if not key_result.data:
        print("❌ API key not found")
        exit(1)

    api_key_id = key_result.data[0]["id"]
    user_id = key_result.data[0]["user_id"]

    print(f"✅ Found API Key ID: {api_key_id}")
    print(f"✅ User ID: {user_id}")

    # Check if rate_limit_configs table exists and has config for this key
    try:
        existing_config = supabase.table("rate_limit_configs").select("*").eq("api_key_id", api_key_id).execute()

        if existing_config.data:
            print(f"\n📊 Current Rate Limit Configuration:")
            config = existing_config.data[0]
            print(f"   Window Type: {config.get('window_type', 'N/A')}")
            print(f"   Window Size: {config.get('window_size', 'N/A')}s")
            print(f"   Max Requests: {config.get('max_requests', 'N/A')}")
            print(f"   Max Tokens: {config.get('max_tokens', 'N/A')}")
            print(f"   Burst Limit: {config.get('burst_limit', 'N/A')}")
            print(f"   Concurrency Limit: {config.get('concurrency_limit', 'N/A')}")
            print(f"   Is Active: {config.get('is_active', 'N/A')}")

            print(f"\n🔧 Updating rate limits for unlimited testing...")

            # Update with very high limits
            update_result = supabase.table("rate_limit_configs").update({
                "max_requests": 100000,      # 100k requests per hour
                "max_tokens": 100000000,     # 100M tokens per hour
                "burst_limit": 10000,        # 10k burst limit (unlimited for testing)
                "concurrency_limit": 100,    # 100 concurrent requests
                "is_active": True
            }).eq("api_key_id", api_key_id).execute()

            if update_result.data:
                print(f"✅ Rate limits updated successfully!")
                print(f"\n📊 New Rate Limit Configuration:")
                print(f"   Max Requests: 100,000/hour")
                print(f"   Max Tokens: 100M/hour")
                print(f"   Burst Limit: 10,000 (effectively unlimited)")
                print(f"   Concurrency: 100 concurrent requests")
                print(f"\n✅ You can now run tests without rate limiting!")
            else:
                print(f"❌ Failed to update rate limits")
                exit(1)
        else:
            print(f"\n⚠️  No rate limit config found for this API key")
            print(f"   This means rate limiting might be disabled, or using defaults")
            print(f"\n   Creating unlimited rate limit config...")

            # Create new config with unlimited limits
            new_config = {
                "api_key_id": api_key_id,
                "window_type": "sliding",
                "window_size": 3600,         # 1 hour
                "max_requests": 100000,      # 100k requests per hour
                "max_tokens": 100000000,     # 100M tokens per hour
                "burst_limit": 10000,        # 10k burst limit
                "concurrency_limit": 100,    # 100 concurrent requests
                "is_active": True
            }

            create_result = supabase.table("rate_limit_configs").insert(new_config).execute()

            if create_result.data:
                print(f"✅ Rate limit config created successfully!")
                print(f"\n📊 New Configuration:")
                print(f"   Max Requests: 100,000/hour")
                print(f"   Burst Limit: 10,000")
                print(f"   Concurrency: 100")
            else:
                print(f"❌ Failed to create rate limit config")
                exit(1)

    except Exception as e:
        if "rate_limit_configs" in str(e) and "not found" in str(e):
            print(f"\n⚠️  'rate_limit_configs' table doesn't exist in database")
            print(f"   Rate limiting might be handled differently or disabled")
            print(f"   You may not need to configure it.")
        else:
            raise

    print(f"\n🎉 Done! You can now run your tests without rate limits.")
    print(f"\nTest command:")
    print(f"   python3 test_all_models.py")

except FileNotFoundError:
    print("❌ .test_api_key file not found")
    print("   Please run create_api_key_direct.py or create_user_with_credits.py first")
    exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
