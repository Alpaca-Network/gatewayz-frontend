#!/usr/bin/env python3
"""
Add unlimited credits to test user
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

    print(f"Looking up user for API key: {api_key[:20]}...")

    # Get user from API key
    key_result = supabase.table("api_keys_new").select("user_id").eq("api_key", api_key).execute()

    if not key_result.data:
        print("❌ API key not found")
        exit(1)

    user_id = key_result.data[0]["user_id"]
    print(f"✅ Found user ID: {user_id}")

    # Get current credits
    user_result = supabase.table("users").select("credits, email").eq("id", user_id).execute()

    if not user_result.data:
        print("❌ User not found")
        exit(1)

    current_credits = user_result.data[0]["credits"]
    email = user_result.data[0]["email"]

    print(f"📧 User email: {email}")
    print(f"💰 Current credits: ${current_credits:.2f}")

    # Add 999999 credits for unlimited testing
    new_credits = 999999.00

    update_result = supabase.table("users").update({
        "credits": new_credits
    }).eq("id", user_id).execute()

    if update_result.data:
        print(f"\n✅ Successfully updated credits!")
        print(f"💰 New balance: ${new_credits:.2f}")
        print(f"\nYou can now test unlimited API calls with your test API key!")
    else:
        print("❌ Failed to update credits")
        exit(1)

except FileNotFoundError:
    print("❌ .test_api_key file not found. Run create_api_key_direct.py first")
    exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
