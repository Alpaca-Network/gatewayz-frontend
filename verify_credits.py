#!/usr/bin/env python3
"""Quick verification of test user credits"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_KEY")
)

# Get user 8 details
result = supabase.table("users").select("*").eq("id", 8).execute()

if result.data:
    user = result.data[0]
    print(f"\n{'='*60}")
    print("📋 TEST USER DETAILS")
    print(f"{'='*60}")
    print(f"User ID: {user['id']}")
    print(f"Email: {user['email']}")
    print(f"Username: {user['username']}")
    print(f"💰 Credits: ${user['credits']:,.2f}")
    print(f"Status: {user['subscription_status']}")
    print(f"Active: {user['is_active']}")
    print(f"{'='*60}\n")
else:
    print("❌ User not found")
