"""Add credits to user account"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
client = create_client(supabase_url, supabase_key)

user_id = 1
credits_to_add = 10000  # Add 10,000 credits

try:
    # Get current credits
    user = client.table('users').select('credits').eq('id', user_id).execute()
    current_credits = user.data[0]['credits'] if user.data else 0

    # Update credits
    result = client.table('users').update({
        'credits': current_credits + credits_to_add
    }).eq('id', user_id).execute()

    new_credits = result.data[0]['credits']
    print(f"Credits updated successfully!")
    print(f"Previous: {current_credits}")
    print(f"Added: {credits_to_add}")
    print(f"New total: {new_credits}")

except Exception as e:
    print(f"Error: {e}")
