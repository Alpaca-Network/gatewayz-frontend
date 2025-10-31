"""
Script to check user plan limits and usage for user_id=1
"""
import sys
import os
import json

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.db.plans import get_user_usage_within_plan_limits

def main():
    user_id = 1
    print(f"Checking plan limits and usage for user_id={user_id}")
    print(f"User API key: gw_temp_lw1xmCuEfLkKn6tsaDF3vw")
    print("-" * 60)

    try:
        # Get user usage within plan limits
        result = get_user_usage_within_plan_limits(user_id)

        if result is None:
            print("ERROR: Unable to retrieve user plan data")
            return 1

        # Print results in a formatted way
        print(f"\nPLAN INFORMATION:")
        print(f"  Plan Name: {result['plan_name']}")

        print(f"\nUSAGE:")
        print(f"  Daily Requests:   {result['usage']['daily_requests']:,}")
        print(f"  Daily Tokens:     {result['usage']['daily_tokens']:,}")
        print(f"  Monthly Requests: {result['usage']['monthly_requests']:,}")
        print(f"  Monthly Tokens:   {result['usage']['monthly_tokens']:,}")

        print(f"\nLIMITS:")
        print(f"  Daily Request Limit:   {result['limits']['daily_request_limit']:,}")
        print(f"  Daily Token Limit:     {result['limits']['daily_token_limit']:,}")
        print(f"  Monthly Request Limit: {result['limits']['monthly_request_limit']:,}")
        print(f"  Monthly Token Limit:   {result['limits']['monthly_token_limit']:,}")

        print(f"\nREMAINING:")
        print(f"  Daily Requests:   {result['remaining']['daily_requests']:,}")
        print(f"  Daily Tokens:     {result['remaining']['daily_tokens']:,}")
        print(f"  Monthly Requests: {result['remaining']['monthly_requests']:,}")
        print(f"  Monthly Tokens:   {result['remaining']['monthly_tokens']:,}")

        print(f"\nLIMIT STATUS:")
        print(f"  Daily Requests Exceeded:   {result['at_limit']['daily_requests']}")
        print(f"  Daily Tokens Exceeded:     {result['at_limit']['daily_tokens']}")
        print(f"  Monthly Requests Exceeded: {result['at_limit']['monthly_requests']}")
        print(f"  Monthly Tokens Exceeded:   {result['at_limit']['monthly_tokens']}")

        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY:")
        monthly_usage_pct = (result['usage']['monthly_requests'] / result['limits']['monthly_request_limit'] * 100) if result['limits']['monthly_request_limit'] > 0 else 0
        print(f"  Monthly requests used: {result['usage']['monthly_requests']:,} / {result['limits']['monthly_request_limit']:,} ({monthly_usage_pct:.2f}%)")

        if result['at_limit']['monthly_requests']:
            print("  WARNING: Monthly request limit EXCEEDED!")
        elif monthly_usage_pct > 80:
            print("  WARNING: Approaching monthly request limit")
        else:
            print("  Status: Within limits")

        print("\nRaw JSON output:")
        print(json.dumps(result, indent=2))

        return 0

    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
