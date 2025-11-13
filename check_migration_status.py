#!/usr/bin/env python3
"""
Quick script to check if the API key migration already ran
"""

import sys
from src.config.supabase_config import get_supabase_client

def check_migration_status():
    """Check if migration already applied"""
    try:
        client = get_supabase_client()

        print("=" * 80)
        print("CHECKING MIGRATION STATUS")
        print("=" * 80)
        print()

        # Check if api_keys_new table exists
        print("1. Checking if api_keys_new table exists...")
        try:
            result = client.table("api_keys_new").select("id").limit(1).execute()
            print("   ✅ Table exists")
        except Exception as e:
            print(f"   ❌ Table does not exist: {e}")
            print()
            print("RESULT: Migration NOT applied - table doesn't exist")
            print("ACTION: Run 'supabase db push' to apply migration")
            return False

        print()

        # Check for migrated legacy keys
        print("2. Checking for migrated legacy keys...")
        migrated = client.table("api_keys_new").select("id", count="exact").eq("key_name", "Legacy Primary Key").execute()
        migrated_count = migrated.count or 0

        print(f"   Found {migrated_count} keys with 'Legacy Primary Key' name")
        print()

        # Check total keys in api_keys_new
        print("3. Checking total keys in api_keys_new...")
        total_keys = client.table("api_keys_new").select("id", count="exact").execute()
        total_count = total_keys.count or 0
        print(f"   Total keys in api_keys_new: {total_count}")
        print()

        # Check legacy keys in users table
        print("4. Checking legacy keys in users table...")
        legacy = client.table("users").select("id", count="exact").neq("api_key", "").not_.is_("api_key", "null").execute()
        legacy_count = legacy.count or 0
        print(f"   Users with API keys in users.api_key: {legacy_count}")
        print()

        # Check for unmigrated keys
        print("5. Checking for unmigrated legacy keys...")
        users_with_keys = client.table("users").select("id, api_key").neq("api_key", "").not_.is_("api_key", "null").execute()

        unmigrated = 0
        for user in users_with_keys.data or []:
            api_key = user.get("api_key")
            if api_key and api_key.startswith("gw_"):
                # Check if this key exists in api_keys_new
                check = client.table("api_keys_new").select("id").eq("api_key", api_key).execute()
                if not check.data:
                    unmigrated += 1

        print(f"   Unmigrated legacy keys: {unmigrated}")
        print()

        # Summary
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print()

        if migrated_count > 0:
            print("✅ MIGRATION ALREADY APPLIED!")
            print()
            print(f"   • {migrated_count} legacy keys were migrated")
            print(f"   • {total_count} total keys in api_keys_new")
            print(f"   • {unmigrated} unmigrated keys remaining")
            print()

            if unmigrated > 0:
                print("⚠️  WARNING: Some legacy keys are not migrated yet")
                print("   This could mean:")
                print("   1. Keys were added after migration ran")
                print("   2. Migration was interrupted")
                print()
                print("ACTION: Re-run migration with 'supabase db push'")
                return False
            else:
                print("✅ All legacy keys are migrated!")
                print()
                print("ACTION: Run verification to confirm everything is correct:")
                print("        python scripts/utilities/verify_api_key_migration.py")
                print()
                print("        OR use PowerShell:")
                print("        .\\run_migration.ps1 -VerifyOnly")
                return True

        else:
            print("❌ MIGRATION NOT APPLIED YET")
            print()
            print(f"   • Table exists: Yes")
            print(f"   • Migrated keys: {migrated_count}")
            print(f"   • Legacy keys to migrate: {legacy_count}")
            print()
            print("ACTION: Apply migration with 'supabase db push'")
            return False

    except Exception as e:
        print(f"❌ Error checking migration status: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    try:
        success = check_migration_status()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(130)
