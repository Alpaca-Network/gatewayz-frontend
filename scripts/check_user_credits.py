#!/usr/bin/env python3
"""Check user credits and completed payments"""

from src.supabase_config import get_supabase_client

client = get_supabase_client()

# Get user 1 (v@ug.hn)
user_result = client.table('users').select('id, email, credits').eq('id', 1).execute()

if user_result.data:
    user = user_result.data[0]
    print(f"User: {user.get('email')}")
    print(f"Current Credits in DB: ${user.get('credits')}")
    print()

# Get all completed payments for user 1
payments_result = client.table('payments').select('*').eq('user_id', 1).eq('status', 'completed').execute()

if payments_result.data:
    print(f"Completed Payments:")
    print('-' * 80)
    total_from_payments = 0
    for payment in payments_result.data:
        amount = payment.get('amount_usd', 0)
        total_from_payments += amount
        print(f"  ${amount} - {payment.get('created_at')} - {payment.get('status')}")
    print('-' * 80)
    print(f"Total from completed payments: ${total_from_payments}")
    print()
else:
    print("No completed payments found")
    print()

# Get pending payments
pending_result = client.table('payments').select('*').eq('user_id', 1).eq('status', 'pending').execute()

if pending_result.data:
    print(f"Pending Payments:")
    print('-' * 80)
    for payment in pending_result.data:
        amount = payment.get('amount_usd', 0)
        print(f"  ${amount} - {payment.get('created_at')} - {payment.get('status')}")
    print('-' * 80)
    print()

print(f"Expected credits: $10 (trial) + ${total_from_payments if payments_result.data else 0} (completed payments) = ${10 + (total_from_payments if payments_result.data else 0)}")
print(f"Actual credits: ${user.get('credits')}")
print()

if user.get('credits') != (10 + (total_from_payments if payments_result.data else 0)):
    print("⚠️  Credits don't match expected amount!")
else:
    print("✓ Credits match expected amount")
