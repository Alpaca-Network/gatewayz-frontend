#!/usr/bin/env python3
"""
Create a new user with API key and credits
"""
import os
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
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

def create_user_with_credits(
    username=None,
    email=None,
    credits=10.00,
    transaction_type="admin_credit",
    description="Initial credits for testing"
):
    """
    Create a new user with API key and credits

    Args:
        username: Username (auto-generated if not provided)
        email: Email (auto-generated if not provided)
        credits: Amount of credits to add (default: $10.00)
        transaction_type: Type of credit transaction (default: admin_credit)
        description: Description for the transaction

    Returns:
        dict with user info, api_key, and credits
    """
    try:
        # Generate user data
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        username = username or f"test_user_{secrets.token_hex(4)}"
        email = email or f"test_{timestamp}@example.com"

        # Step 1: Create user
        print(f"\n{'='*60}")
        print("🔧 Creating new user...")
        print(f"{'='*60}")

        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=3)

        user_data = {
            "email": email,
            "username": username,
            "auth_method": "email",
            "is_active": True,
            "credits": 0.00,  # Start with 0, we'll add credits next
            "registration_date": trial_start.isoformat(),
            "subscription_status": "trial",
            "trial_expires_at": trial_end.isoformat(),
            "created_at": trial_start.isoformat(),
            "updated_at": trial_start.isoformat()
        }

        user_response = supabase.table("users").insert(user_data).execute()

        if not user_response.data:
            raise Exception("Failed to create user")

        user = user_response.data[0]
        user_id = user["id"]

        print(f"✅ User created successfully")
        print(f"   📧 Email: {email}")
        print(f"   👤 Username: {username}")
        print(f"   🆔 User ID: {user_id}")

        # Step 2: Add credits
        print(f"\n💰 Adding ${credits:.2f} in credits...")

        balance_before = 0.00
        balance_after = credits

        # Update user credits
        credit_update = supabase.table("users").update({
            "credits": balance_after,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", user_id).execute()

        if not credit_update.data:
            raise Exception("Failed to update user credits")

        # Log credit transaction
        try:
            transaction_data = {
                "user_id": user_id,
                "amount": credits,
                "transaction_type": transaction_type,
                "description": description,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "metadata": {
                    "created_via": "create_user_with_credits.py",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                },
                "created_by": "admin_script",
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            supabase.table("credit_transactions").insert(transaction_data).execute()
            print(f"✅ Credits added: ${balance_before:.2f} → ${balance_after:.2f}")
        except Exception as tx_error:
            print(f"⚠️  Credits added but transaction logging failed: {tx_error}")

        # Step 3: Create API key
        print(f"\n🔑 Creating API key...")

        # Generate secure API key
        api_key = f"gw_{secrets.token_urlsafe(32)}"

        api_key_data = {
            "user_id": user_id,
            "api_key": api_key,
            "key_name": "Primary API Key",
            "is_active": True,
            "is_primary": True,
            "requests_used": 0,
            "environment_tag": "development",
            "scope_permissions": {},  # Empty means full access
            "ip_allowlist": [],
            "domain_referrers": [],
            "last_used_at": datetime.now(timezone.utc).isoformat()
        }

        key_response = supabase.table("api_keys_new").insert(api_key_data).execute()

        if not key_response.data:
            raise Exception("Failed to create API key")

        api_key_id = key_response.data[0]["id"]

        print(f"✅ API key created successfully")
        print(f"   🔑 Key ID: {api_key_id}")

        # Step 4: Create rate limit config (optional)
        try:
            rate_limit_config = {
                "api_key_id": api_key_id,
                "window_type": "sliding",
                "window_size": 3600,  # 1 hour
                "max_requests": 1000,
                "max_tokens": 1000000,  # 1M tokens per hour
                "burst_limit": 100,
                "concurrency_limit": 10,
                "is_active": True
            }

            supabase.table("rate_limit_configs").insert(rate_limit_config).execute()
            print(f"✅ Rate limit config created (1000 req/hour)")
        except Exception as rl_error:
            print(f"⚠️  Rate limit config creation failed (non-critical): {rl_error}")

        # Success summary
        print(f"\n{'='*60}")
        print("✅ USER CREATED SUCCESSFULLY!")
        print(f"{'='*60}")
        print(f"\n📋 User Details:")
        print(f"   Email: {email}")
        print(f"   Username: {username}")
        print(f"   User ID: {user_id}")
        print(f"\n💰 Credits:")
        print(f"   Balance: ${credits:.2f}")
        print(f"\n🔑 API Key:")
        print(f"   {api_key}")
        print(f"\n📝 Test Command:")
        print(f"   export API_KEY=\"{api_key}\"")
        print(f"\n   curl -X POST http://localhost:8000/v1/chat/completions \\")
        print(f"     -H \"Content-Type: application/json\" \\")
        print(f"     -H \"Authorization: Bearer {api_key}\" \\")
        print(f"     -d '{{\"model\": \"gemini-2.0-flash\", \"messages\": [{{\"role\": \"user\", \"content\": \"Hello\"}}]}}'")
        print(f"\n{'='*60}")

        # Save to file
        output_file = f".user_{username}.txt"
        with open(output_file, "w") as f:
            f.write(f"User ID: {user_id}\n")
            f.write(f"Email: {email}\n")
            f.write(f"Username: {username}\n")
            f.write(f"Credits: ${credits:.2f}\n")
            f.write(f"API Key: {api_key}\n")

        print(f"\n💾 User details saved to: {output_file}")

        return {
            "user_id": user_id,
            "email": email,
            "username": username,
            "credits": credits,
            "api_key": api_key,
            "api_key_id": api_key_id
        }

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)


if __name__ == "__main__":
    import sys

    # Parse command line arguments
    credits_amount = 10.00
    username = None
    email = None

    if len(sys.argv) > 1:
        try:
            credits_amount = float(sys.argv[1])
        except ValueError:
            print(f"Invalid credits amount: {sys.argv[1]}")
            print("Usage: python create_user_with_credits.py [credits] [username] [email]")
            exit(1)

    if len(sys.argv) > 2:
        username = sys.argv[2]

    if len(sys.argv) > 3:
        email = sys.argv[3]

    # Create user
    result = create_user_with_credits(
        username=username,
        email=email,
        credits=credits_amount,
        description=f"Initial ${credits_amount:.2f} credits for testing"
    )
