"""Quick fix - insert API key with minimal fields"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
client = create_client(supabase_url, supabase_key)

existing_api_key = "gw_temp_lw1xmCuEfLkKn6tsaDF3vw"
user_id = 1

print(f"Checking API key: {existing_api_key}")

# Check what columns exist
try:
    test_query = client.table('api_keys_new').select('*').limit(0).execute()
    print("Table exists")
except Exception as e:
    print(f"Error accessing table: {e}")

# Try to insert with only required fields
try:
    existing = client.table('api_keys_new').select('*').eq('api_key', existing_api_key).execute()
    if existing.data:
        print("API key already exists!")
        print(existing.data[0])
    else:
        # Insert with minimal fields
        result = client.table('api_keys_new').insert({
            'user_id': user_id,
            'api_key': existing_api_key,
            'key_name': 'Default Key',
            'environment_tag': 'live',
            'is_active': True,
            'scope_permissions': ['chat', 'models', 'images']
        }).execute()
        print("Created API key!")
        print(result.data[0])

        # Create rate limit config
        api_key_id = result.data[0]['id']
        client.table('rate_limit_configs').insert({
            'api_key_id': api_key_id,
            'requests_per_minute': 60,
            'requests_per_hour': 3600,
            'requests_per_day': 86400
        }).execute()
        print("Created rate limit config")

except Exception as e:
    print(f"Error: {e}")

# Assign to free plan
try:
    plan = client.table('plans').select('*').eq('name', 'Free').execute()
    if plan.data:
        plan_id = plan.data[0]['id']
        user_plan = client.table('user_plans').select('*').eq('user_id', user_id).eq('is_active', True).execute()
        if not user_plan.data:
            client.table('user_plans').insert({
                'user_id': user_id,
                'plan_id': plan_id,
                'is_active': True
            }).execute()
            print("Assigned to Free plan")
        else:
            print("Already has a plan")
except Exception as e:
    print(f"Plan error: {e}")
