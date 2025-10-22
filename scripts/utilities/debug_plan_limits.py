"""
Debug script to understand why plan limits differ
"""
import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.supabase_config import get_supabase_client
from src.db.plans import get_user_plan, check_plan_entitlements

def main():
    user_id = 1
    print("DEBUGGING PLAN LIMITS DISCREPANCY")
    print("=" * 70)

    try:
        client = get_supabase_client()

        # Direct database query
        print("\n[1] DIRECT DATABASE QUERY - Plans table:")
        print("-" * 70)
        plan_result = client.table('plans').select('*').eq('id', 1).execute()
        if plan_result.data:
            plan = plan_result.data[0]
            print(f"  Plan Name: {plan['name']}")
            print(f"  Daily Request Limit (DB):   {plan['daily_request_limit']:>10,}")
            print(f"  Monthly Request Limit (DB): {plan['monthly_request_limit']:>10,}")
            print(f"  Daily Token Limit (DB):     {plan['daily_token_limit']:>10,}")
            print(f"  Monthly Token Limit (DB):   {plan['monthly_token_limit']:>10,}")

        # Try get_user_plan function
        print("\n[2] Using get_user_plan() function:")
        print("-" * 70)
        try:
            user_plan = get_user_plan(user_id)
            if user_plan:
                print(f"  Plan Name: {user_plan.get('plan_name', 'N/A')}")
                print(f"  Daily Request Limit:   {user_plan.get('daily_request_limit', 'N/A'):>10,}")
                print(f"  Monthly Request Limit: {user_plan.get('monthly_request_limit', 'N/A'):>10,}")
                print(f"  Daily Token Limit:     {user_plan.get('daily_token_limit', 'N/A'):>10,}")
                print(f"  Monthly Token Limit:   {user_plan.get('monthly_token_limit', 'N/A'):>10,}")
            else:
                print("  get_user_plan() returned None")
        except Exception as e:
            print(f"  get_user_plan() raised exception: {e}")

        # Try check_plan_entitlements function
        print("\n[3] Using check_plan_entitlements() function:")
        print("-" * 70)
        try:
            entitlements = check_plan_entitlements(user_id)
            print(f"  Plan Name: {entitlements.get('plan_name', 'N/A')}")
            print(f"  Has Plan: {entitlements.get('has_plan', 'N/A')}")
            print(f"  Daily Request Limit:   {entitlements.get('daily_request_limit', 'N/A'):>10,}")
            print(f"  Monthly Request Limit: {entitlements.get('monthly_request_limit', 'N/A'):>10,}")
            print(f"  Daily Token Limit:     {entitlements.get('daily_token_limit', 'N/A'):>10,}")
            print(f"  Monthly Token Limit:   {entitlements.get('monthly_token_limit', 'N/A'):>10,}")
        except Exception as e:
            print(f"  check_plan_entitlements() raised exception: {e}")

        # Check user_plans table structure
        print("\n[4] User Plans record structure:")
        print("-" * 70)
        user_plan_result = client.table('user_plans').select('*').eq('user_id', user_id).eq('is_active', True).execute()
        if user_plan_result.data:
            up = user_plan_result.data[0]
            print(f"  Fields in user_plans record:")
            for key, value in up.items():
                print(f"    {key}: {value}")

        print("\n" + "=" * 70)
        print("DIAGNOSIS:")
        print("  The code expects 'start_date' and 'end_date' fields in user_plans,")
        print("  but the database has 'started_at' and 'expires_at' instead.")
        print("  This causes check_plan_entitlements() to fail and fall back to")
        print("  default trial limits instead of using the actual plan limits.")
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
