"""
Comprehensive script to check user plan limits and usage for user_id=1
"""
import sys
import os
import json

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.db.plans import get_user_usage_within_plan_limits
from src.supabase_config import get_supabase_client

def main():
    user_id = 1
    print("=" * 70)
    print("GATEWAYZ USER PLAN & USAGE REPORT")
    print("=" * 70)
    print(f"User ID: {user_id}")
    print(f"API Key: gw_temp_lw1xmCuEfLkKn6tsaDF3vw")
    print(f"Date: 2025-10-20")
    print("=" * 70)

    try:
        client = get_supabase_client()

        # Get user details
        print("\n[1] USER DETAILS:")
        print("-" * 70)
        user_result = client.table('users').select('*').eq('id', user_id).execute()
        if user_result.data:
            user = user_result.data[0]
            print(f"  Email: {user.get('email', 'N/A')}")
            print(f"  Subscription Status: {user.get('subscription_status', 'N/A')}")
            print(f"  Created At: {user.get('created_at', 'N/A')}")

        # Get user_plans details
        print("\n[2] USER PLAN ASSIGNMENT:")
        print("-" * 70)
        user_plan_result = client.table('user_plans').select('*').eq('user_id', user_id).eq('is_active', True).execute()
        if user_plan_result.data:
            up = user_plan_result.data[0]
            print(f"  User Plan ID: {up['id']}")
            print(f"  Plan ID: {up['plan_id']}")
            print(f"  Started At: {up['started_at']}")
            print(f"  Expires At: {up['expires_at'] if up['expires_at'] else 'No expiration'}")
            print(f"  Is Active: {up['is_active']}")

        # Get plan details
        print("\n[3] PLAN DETAILS:")
        print("-" * 70)
        plan_result = client.table('plans').select('*').eq('id', up['plan_id']).execute()
        if plan_result.data:
            plan = plan_result.data[0]
            print(f"  Plan Name: {plan['name']}")
            print(f"  Description: {plan.get('description', 'N/A')}")
            print(f"  Price per Month: ${plan['price_per_month']}")
            print(f"  Daily Request Limit: {plan['daily_request_limit']:,}")
            print(f"  Monthly Request Limit: {plan['monthly_request_limit']:,}")
            print(f"  Daily Token Limit: {plan['daily_token_limit']:,}")
            print(f"  Monthly Token Limit: {plan['monthly_token_limit']:,}")
            print(f"  Features: {plan.get('features', 'N/A')}")

        # Get usage within plan limits
        print("\n[4] USAGE & LIMITS ANALYSIS:")
        print("-" * 70)
        result = get_user_usage_within_plan_limits(user_id)

        if result is None:
            print("  ERROR: Unable to retrieve usage data")
            return 1

        # Current usage
        print("\n  CURRENT USAGE (as of today):")
        print(f"    Today's Requests:  {result['usage']['daily_requests']:>10,}")
        print(f"    Today's Tokens:    {result['usage']['daily_tokens']:>10,}")
        print(f"    Monthly Requests:  {result['usage']['monthly_requests']:>10,}")
        print(f"    Monthly Tokens:    {result['usage']['monthly_tokens']:>10,}")

        # Limits
        print("\n  PLAN LIMITS:")
        print(f"    Daily Request Limit:   {result['limits']['daily_request_limit']:>10,}")
        print(f"    Daily Token Limit:     {result['limits']['daily_token_limit']:>10,}")
        print(f"    Monthly Request Limit: {result['limits']['monthly_request_limit']:>10,}")
        print(f"    Monthly Token Limit:   {result['limits']['monthly_token_limit']:>10,}")

        # Remaining
        print("\n  REMAINING CAPACITY:")
        print(f"    Daily Requests:   {result['remaining']['daily_requests']:>10,}")
        print(f"    Daily Tokens:     {result['remaining']['daily_tokens']:>10,}")
        print(f"    Monthly Requests: {result['remaining']['monthly_requests']:>10,}")
        print(f"    Monthly Tokens:   {result['remaining']['monthly_tokens']:>10,}")

        # Percentages
        print("\n  USAGE PERCENTAGES:")
        daily_req_pct = (result['usage']['daily_requests'] / result['limits']['daily_request_limit'] * 100) if result['limits']['daily_request_limit'] > 0 else 0
        monthly_req_pct = (result['usage']['monthly_requests'] / result['limits']['monthly_request_limit'] * 100) if result['limits']['monthly_request_limit'] > 0 else 0
        daily_token_pct = (result['usage']['daily_tokens'] / result['limits']['daily_token_limit'] * 100) if result['limits']['daily_token_limit'] > 0 else 0
        monthly_token_pct = (result['usage']['monthly_tokens'] / result['limits']['monthly_token_limit'] * 100) if result['limits']['monthly_token_limit'] > 0 else 0

        print(f"    Daily Requests:   {daily_req_pct:>6.2f}%")
        print(f"    Monthly Requests: {monthly_req_pct:>6.2f}%")
        print(f"    Daily Tokens:     {daily_token_pct:>6.2f}%")
        print(f"    Monthly Tokens:   {monthly_token_pct:>6.2f}%")

        # Status check
        print("\n[5] LIMIT STATUS:")
        print("-" * 70)
        any_exceeded = any(result['at_limit'].values())

        if any_exceeded:
            print("  STATUS: LIMIT EXCEEDED")
            if result['at_limit']['daily_requests']:
                print("    [!] Daily request limit EXCEEDED")
            if result['at_limit']['monthly_requests']:
                print("    [!] Monthly request limit EXCEEDED")
            if result['at_limit']['daily_tokens']:
                print("    [!] Daily token limit EXCEEDED")
            if result['at_limit']['monthly_tokens']:
                print("    [!] Monthly token limit EXCEEDED")
        else:
            print("  STATUS: WITHIN LIMITS")
            if monthly_req_pct > 80:
                print("    [WARNING] Approaching monthly request limit (>80%)")
            if monthly_token_pct > 80:
                print("    [WARNING] Approaching monthly token limit (>80%)")
            if monthly_req_pct <= 80 and monthly_token_pct <= 80:
                print("    [OK] Usage is healthy")

        print("\n" + "=" * 70)
        print("SUMMARY:")
        print(f"  - Plan: {plan['name'] if plan_result.data else 'Unknown'}")
        print(f"  - Monthly Requests: {result['usage']['monthly_requests']:,} / {result['limits']['monthly_request_limit']:,} ({monthly_req_pct:.2f}%)")
        print(f"  - Limit Exceeded: {'YES' if any_exceeded else 'NO'}")
        print("=" * 70)

        return 0

    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
