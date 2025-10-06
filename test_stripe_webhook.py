#!/usr/bin/env python3
"""Test script to check if Stripe webhooks are working"""

import os
from dotenv import load_dotenv
import stripe

load_dotenv()

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

print("Checking Stripe Webhook Endpoints...")
print("-" * 80)

# List webhook endpoints configured in Stripe
try:
    webhook_endpoints = stripe.WebhookEndpoint.list(limit=10)

    if webhook_endpoints.data:
        print(f"Found {len(webhook_endpoints.data)} webhook endpoint(s):")
        for endpoint in webhook_endpoints.data:
            print(f"\nURL: {endpoint.url}")
            print(f"Status: {endpoint.status}")
            print(f"Events: {', '.join(endpoint.enabled_events)}")
    else:
        print("No webhook endpoints configured in Stripe!")
        print("\nTo fix this:")
        print("1. Go to https://dashboard.stripe.com/webhooks")
        print("2. Click 'Add endpoint'")
        print("3. Set URL to: https://beta.gatewayz.ai/api/stripe/webhook")
        print("4. Select events: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed")

except Exception as e:
    print(f"Error listing webhook endpoints: {e}")

print("\n" + "-" * 80)

# Check recent events
print("\nRecent Stripe Events (last 10):")
try:
    events = stripe.Event.list(limit=10)

    if events.data:
        for event in events.data:
            print(f"\n{event.type} - {event.created}")
            if event.type in ['checkout.session.completed', 'payment_intent.succeeded', 'payment_intent.payment_failed']:
                print(f"  *** This event should trigger payment registration ***")
    else:
        print("No recent events")

except Exception as e:
    print(f"Error listing events: {e}")
