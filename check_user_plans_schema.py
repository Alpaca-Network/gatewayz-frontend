"""
Script to check the user_plans table schema
"""
import sys
import os
import json

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.supabase_config import get_supabase_client

def main():
    print("Checking user_plans table for user_id=1")
    print("-" * 60)

    try:
        client = get_supabase_client()

        # Get user_plans record
        result = client.table('user_plans').select('*').eq('user_id', 1).eq('is_active', True).execute()

        if result.data:
            print("User Plans Records Found:")
            for record in result.data:
                print(json.dumps(record, indent=2, default=str))
        else:
            print("No active user_plans found for user_id=1")

        # Also check all user_plans regardless of is_active
        print("\n" + "=" * 60)
        print("All user_plans records for user_id=1:")
        all_result = client.table('user_plans').select('*').eq('user_id', 1).execute()

        if all_result.data:
            for record in all_result.data:
                print(json.dumps(record, indent=2, default=str))
        else:
            print("No user_plans records found at all for user_id=1")

        return 0

    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
