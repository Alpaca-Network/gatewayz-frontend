#!/usr/bin/env python3
"""Comprehensive payment diagnostics"""

import os
from datetime import datetime, timezone
from dotenv import load_dotenv
import stripe
from src.supabase_config import get_supabase_client

load_dotenv()

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

print("=" * 100)
print("PAYMENT FLOW DIAGNOSTICS")
print("=" * 100)

# 1. Check Supabase payments table
print("\n1. SUPABASE PAYMENTS TABLE:")
print("-" * 100)
client = get_supabase_client()
payments_result = client.table('payments').select('*').order('created_at', desc=True).limit(5).execute()

if payments_result.data:
    print(f"Found {len(payments_result.data)} payment(s) in database:")
    for p in payments_result.data:
        print(f"  ID: {p.get('id')} | User: {p.get('user_id')} | Status: {p.get('status')} | Amount: ${p.get('amount_usd')}")
else:
    print("  NO PAYMENTS IN DATABASE [EMPTY]")

# 2. Check recent Stripe checkout sessions
print("\n2. RECENT STRIPE CHECKOUT SESSIONS:")
print("-" * 100)
try:
    sessions = stripe.checkout.Session.list(limit=5)
    if sessions.data:
        print(f"Found {len(sessions.data)} recent checkout session(s):")
        for session in sessions.data:
            print(f"\n  Session ID: {session.id}")
            print(f"  Payment Status: {session.payment_status}")
            print(f"  Status: {session.status}")
            print(f"  Amount: ${session.amount_total / 100 if session.amount_total else 0}")
            print(f"  Created: {datetime.fromtimestamp(session.created, tz=timezone.utc)}")
            print(f"  Metadata: {session.metadata}")

            # Check if this session created a payment record
            if session.metadata.get('payment_id'):
                payment_id = session.metadata.get('payment_id')
                payment_check = client.table('payments').select('*').eq('id', payment_id).execute()
                if payment_check.data:
                    print(f"  [OK] Payment record EXISTS in database")
                else:
                    print(f"  [FAIL] Payment record NOT FOUND in database (payment_id: {payment_id})")
    else:
        print("  No recent checkout sessions")
except Exception as e:
    print(f"  Error: {e}")

# 3. Check Stripe webhook endpoint configuration
print("\n3. WEBHOOK CONFIGURATION:")
print("-" * 100)
try:
    webhooks = stripe.WebhookEndpoint.list(limit=10)
    beta_webhook = None

    for webhook in webhooks.data:
        if 'beta.gatewayz.ai' in webhook.url:
            beta_webhook = webhook
            print(f"  URL: {webhook.url}")
            print(f"  Status: {webhook.status}")
            print(f"  Events: {', '.join(webhook.enabled_events)}")

            # Check if required events are enabled
            required_events = ['checkout.session.completed', 'payment_intent.succeeded', 'payment_intent.payment_failed']
            missing_events = [e for e in required_events if e not in webhook.enabled_events]

            if missing_events:
                print(f"  [WARNING] MISSING EVENTS: {', '.join(missing_events)}")
            else:
                print(f"  [OK] All required events configured")

    if not beta_webhook:
        print("  [FAIL] No webhook configured for beta.gatewayz.ai")

except Exception as e:
    print(f"  Error: {e}")

# 4. Check recent webhook deliveries
print("\n4. RECENT WEBHOOK EVENTS:")
print("-" * 100)
try:
    events = stripe.Event.list(limit=5, type='checkout.session.completed')
    if events.data:
        print(f"Found {len(events.data)} recent checkout.session.completed event(s):")
        for event in events.data:
            session = event.data.object
            print(f"\n  Event ID: {event.id}")
            print(f"  Created: {datetime.fromtimestamp(event.created, tz=timezone.utc)}")
            print(f"  Session ID: {session.get('id')}")
            print(f"  Payment Status: {session.get('payment_status')}")
            print(f"  Metadata: {session.get('metadata')}")
    else:
        print("  No recent checkout.session.completed events")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 100)
print("DIAGNOSIS SUMMARY:")
print("=" * 100)
print("\nTo ensure payments are registered:")
print("1. Webhook must be configured at: https://beta.gatewayz.ai/api/stripe/webhook")
print("2. Webhook must listen to: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed")
print("3. STRIPE_WEBHOOK_SECRET must be set in environment variables")
print("4. Checkout sessions must include user_id and payment_id in metadata")
