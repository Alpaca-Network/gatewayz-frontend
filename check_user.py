#!/usr/bin/env python3
"""Check user and payments"""

from src.supabase_config import get_supabase_client

client = get_supabase_client()

# Get users
users_result = client.table('users').select('id, email, credits').order('created_at', desc=True).limit(5).execute()

if users_result.data:
    print('Recent users:')
    print('-' * 80)
    for user in users_result.data:
        print(f"ID: {user.get('id')} | Email: {user.get('email')} | Credits: {user.get('credits')}")
    print('-' * 80)
else:
    print('No users found')

# Check if payments table exists and its structure
print('\nPayments table structure:')
payments_result = client.table('payments').select('*').limit(1).execute()
if payments_result.data:
    print(f"Columns: {list(payments_result.data[0].keys())}")
else:
    print("No payments in table (table may be empty)")
