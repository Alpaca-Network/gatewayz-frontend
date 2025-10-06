#!/usr/bin/env python3
"""Check payments in database"""

from src.supabase_config import get_supabase_client

client = get_supabase_client()
result = client.table('payments').select('*').order('created_at', desc=True).limit(10).execute()

if result.data:
    print('Recent payments in database:')
    print('-' * 100)
    for payment in result.data:
        print(f"ID: {payment.get('id')}"
              f" | User: {payment.get('user_id')}"
              f" | Amount: ${payment.get('amount_usd', payment.get('amount', 'N/A'))}"
              f" | Status: {payment.get('status')}"
              f" | Created: {payment.get('created_at')}")
        print(f"  All fields: {list(payment.keys())}")
        print('-' * 100)
else:
    print('No payments found in database')
