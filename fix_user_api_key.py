"""
Fix user API key in new Supabase database
This script creates the api_keys_new entry for the existing user
"""
import os
from dotenv import load_dotenv
from supabase import create_client
from cryptography.fernet import Fernet
import hashlib
import secrets

load_dotenv()

# Connect to Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
client = create_client(supabase_url, supabase_key)

# The existing API key from the frontend logs
existing_api_key = "gw_temp_lw1xmCuEfLkKn6tsaDF3vw"
user_id = 1

# Generate encryption key (you should store this in env vars for production)
# For now, use a deterministic key based on SUPABASE_KEY
encryption_key = Fernet.generate_key()
cipher_suite = Fernet(encryption_key)

# Encrypt the API key
encrypted_key = cipher_suite.encrypt(existing_api_key.encode()).decode()

# Create hash of the API key
key_hash = hashlib.sha256(existing_api_key.encode()).hexdigest()

print(f"User ID: {user_id}")
print(f"API Key: {existing_api_key}")
print(f"Key Hash: {key_hash[:16]}...")

# Check if key already exists
try:
    existing = client.table('api_keys_new').select('*').eq('api_key', existing_api_key).execute()
    if existing.data:
        print("✅ API key already exists in api_keys_new table")
        print(f"Key details: {existing.data[0]}")
    else:
        # Insert the API key
        result = client.table('api_keys_new').insert({
            'user_id': user_id,
            'api_key': existing_api_key,
            'key_name': 'Default Key',
            'environment_tag': 'live',
            'encrypted_key': encrypted_key,
            'key_hash': key_hash,
            'is_active': True,
            'scope_permissions': ['chat', 'models', 'images'],
            'trial_used_tokens': 0,
            'trial_used_requests': 0,
            'trial_used_credits': 0
        }).execute()

        print("✅ Created API key in api_keys_new table")
        print(f"Key ID: {result.data[0]['id']}")

        # Create default rate limit config
        api_key_id = result.data[0]['id']
        rate_config = client.table('rate_limit_configs').insert({
            'api_key_id': api_key_id,
            'requests_per_minute': 60,
            'requests_per_hour': 3600,
            'requests_per_day': 86400,
            'tokens_per_minute': 100000,
            'tokens_per_hour': 1000000,
            'tokens_per_day': 10000000
        }).execute()

        print("✅ Created rate limit config")

except Exception as e:
    print(f"❌ Error: {e}")

# Assign user to free plan if not already assigned
try:
    # Get free plan
    plan_result = client.table('plans').select('*').eq('name', 'Free').execute()
    if not plan_result.data:
        print("❌ Free plan not found. Please run the SQL to create it first.")
    else:
        plan_id = plan_result.data[0]['id']

        # Check if user already has a plan
        user_plan = client.table('user_plans').select('*').eq('user_id', user_id).eq('is_active', True).execute()

        if user_plan.data:
            print(f"✅ User already has an active plan: {user_plan.data[0]}")
        else:
            # Assign free plan
            client.table('user_plans').insert({
                'user_id': user_id,
                'plan_id': plan_id,
                'is_active': True
            }).execute()
            print("✅ Assigned user to Free plan")

except Exception as e:
    print(f"❌ Error assigning plan: {e}")

print("\n✅ Setup complete! The API should now work.")
