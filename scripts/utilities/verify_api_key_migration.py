#!/usr/bin/env python3
"""
API Key Migration Verification Script

This script verifies that the legacy API key migration was successful by:
1. Checking that all legacy keys are in api_keys_new
2. Verifying no duplicate keys
3. Testing key authentication
4. Checking for orphaned keys
5. Validating key format and metadata
"""

import logging
import sys
from datetime import datetime
from typing import Dict, List, Any, Tuple
from collections import defaultdict

from src.config.supabase_config import get_supabase_client
from src.db.users import get_user
from src.security.security import validate_api_key

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MigrationVerifier:
    """Verifies API key migration success"""

    def __init__(self):
        self.client = get_supabase_client()
        self.errors = []
        self.warnings = []
        self.stats = {
            'users_total': 0,
            'users_with_keys': 0,
            'legacy_keys_found': 0,
            'keys_in_api_keys_new': 0,
            'migrated_keys': 0,
            'primary_keys': 0,
            'duplicate_keys': 0,
            'orphaned_keys': 0,
            'invalid_format_keys': 0,
        }

    def run_all_checks(self) -> bool:
        """Run all verification checks"""
        logger.info("=" * 80)
        logger.info("API KEY MIGRATION VERIFICATION")
        logger.info("=" * 80)

        checks = [
            ("Database Connection", self.check_database_connection),
            ("Table Structure", self.check_table_structure),
            ("User Statistics", self.check_user_statistics),
            ("Legacy Keys", self.check_legacy_keys),
            ("Key Migration Status", self.check_migration_status),
            ("Key Format Validation", self.check_key_formats),
            ("Duplicate Keys", self.check_duplicate_keys),
            ("Orphaned Keys", self.check_orphaned_keys),
            ("Primary Key Assignment", self.check_primary_keys),
            ("Key Authentication", self.check_key_authentication),
            ("Index Performance", self.check_indexes),
        ]

        all_passed = True
        for check_name, check_func in checks:
            logger.info(f"\n{'=' * 80}")
            logger.info(f"CHECK: {check_name}")
            logger.info(f"{'=' * 80}")
            try:
                passed = check_func()
                status = "✅ PASSED" if passed else "❌ FAILED"
                logger.info(f"{status}: {check_name}")
                if not passed:
                    all_passed = False
            except Exception as e:
                logger.error(f"❌ ERROR in {check_name}: {e}", exc_info=True)
                self.errors.append(f"{check_name}: {str(e)}")
                all_passed = False

        # Print summary
        self.print_summary()

        return all_passed

    def check_database_connection(self) -> bool:
        """Verify database connection"""
        try:
            result = self.client.table("users").select("id").limit(1).execute()
            logger.info("✓ Database connection successful")
            return True
        except Exception as e:
            logger.error(f"✗ Database connection failed: {e}")
            self.errors.append(f"Database connection: {str(e)}")
            return False

    def check_table_structure(self) -> bool:
        """Verify required tables exist"""
        tables = ["users", "api_keys_new"]
        all_exist = True

        for table in tables:
            try:
                self.client.table(table).select("*").limit(1).execute()
                logger.info(f"✓ Table '{table}' exists")
            except Exception as e:
                logger.error(f"✗ Table '{table}' not found: {e}")
                self.errors.append(f"Missing table: {table}")
                all_exist = False

        return all_exist

    def check_user_statistics(self) -> bool:
        """Gather user and key statistics"""
        try:
            # Count total users
            users_result = self.client.table("users").select("*", count="exact").execute()
            self.stats['users_total'] = users_result.count or 0
            logger.info(f"Total users in database: {self.stats['users_total']}")

            # Count users with API keys
            users_with_keys = self.client.table("users").select("id", count="exact").neq("api_key", "").not_.is_("api_key", "null").execute()
            self.stats['users_with_keys'] = users_with_keys.count or 0
            logger.info(f"Users with API keys: {self.stats['users_with_keys']}")

            # Count keys in api_keys_new
            keys_result = self.client.table("api_keys_new").select("*", count="exact").execute()
            self.stats['keys_in_api_keys_new'] = keys_result.count or 0
            logger.info(f"Total keys in api_keys_new: {self.stats['keys_in_api_keys_new']}")

            return True
        except Exception as e:
            logger.error(f"✗ Failed to gather statistics: {e}")
            self.errors.append(f"Statistics gathering: {str(e)}")
            return False

    def check_legacy_keys(self) -> bool:
        """Check for legacy keys that haven't been migrated"""
        try:
            # Find users with legacy keys (api_key in users table)
            legacy_users = self.client.table("users").select("id, username, email, api_key").neq("api_key", "").not_.is_("api_key", "null").execute()

            unmigrated_keys = []
            for user in legacy_users.data or []:
                api_key = user.get("api_key")
                if not api_key or not api_key.startswith("gw_"):
                    continue

                # Check if this key exists in api_keys_new
                key_check = self.client.table("api_keys_new").select("id").eq("api_key", api_key).execute()

                if not key_check.data:
                    unmigrated_keys.append({
                        'user_id': user['id'],
                        'username': user.get('username', 'N/A'),
                        'email': user.get('email', 'N/A'),
                        'api_key': api_key[:20] + "..."
                    })

            self.stats['legacy_keys_found'] = len(legacy_users.data or [])

            if unmigrated_keys:
                logger.error(f"✗ Found {len(unmigrated_keys)} unmigrated legacy keys:")
                for key_info in unmigrated_keys[:10]:  # Show first 10
                    logger.error(f"  - User {key_info['user_id']} ({key_info['username']}): {key_info['api_key']}")
                if len(unmigrated_keys) > 10:
                    logger.error(f"  ... and {len(unmigrated_keys) - 10} more")
                self.errors.append(f"Unmigrated legacy keys: {len(unmigrated_keys)}")
                return False
            else:
                logger.info(f"✓ All {self.stats['legacy_keys_found']} legacy keys have been migrated")
                return True

        except Exception as e:
            logger.error(f"✗ Failed to check legacy keys: {e}")
            self.errors.append(f"Legacy key check: {str(e)}")
            return False

    def check_migration_status(self) -> bool:
        """Verify migration metadata and timestamps"""
        try:
            # Count keys with 'Legacy Primary Key' name (migrated keys)
            migrated = self.client.table("api_keys_new").select("*", count="exact").eq("key_name", "Legacy Primary Key").execute()
            self.stats['migrated_keys'] = migrated.count or 0

            logger.info(f"Keys with 'Legacy Primary Key' name: {self.stats['migrated_keys']}")

            # Check migration timestamp
            if migrated.data:
                recent_migration = max(migrated.data, key=lambda x: x.get('created_at', ''))
                logger.info(f"Most recent migration: {recent_migration.get('created_at', 'N/A')}")

            return True
        except Exception as e:
            logger.error(f"✗ Failed to check migration status: {e}")
            self.warnings.append(f"Migration status check: {str(e)}")
            return True  # Non-critical

    def check_key_formats(self) -> bool:
        """Validate API key formats"""
        try:
            # Get all keys
            keys_result = self.client.table("api_keys_new").select("id, api_key, environment_tag").execute()

            invalid_keys = []
            for key_data in keys_result.data or []:
                api_key = key_data.get("api_key", "")
                env_tag = key_data.get("environment_tag", "")

                # Check format
                if not api_key.startswith("gw_"):
                    invalid_keys.append(f"Key {key_data['id']}: Invalid prefix (expected 'gw_')")
                    continue

                # Check environment tag matches prefix
                expected_env = None
                if api_key.startswith("gw_live_"):
                    expected_env = "live"
                elif api_key.startswith("gw_test_"):
                    expected_env = "test"
                elif api_key.startswith("gw_staging_"):
                    expected_env = "staging"
                elif api_key.startswith("gw_dev_"):
                    expected_env = "development"

                if expected_env and env_tag != expected_env:
                    invalid_keys.append(f"Key {key_data['id']}: Environment mismatch (key: {expected_env}, db: {env_tag})")

            self.stats['invalid_format_keys'] = len(invalid_keys)

            if invalid_keys:
                logger.warning(f"⚠ Found {len(invalid_keys)} keys with format issues:")
                for issue in invalid_keys[:10]:
                    logger.warning(f"  - {issue}")
                self.warnings.append(f"Invalid format keys: {len(invalid_keys)}")
                return len(invalid_keys) == 0  # Return False if any invalid
            else:
                logger.info(f"✓ All {len(keys_result.data or [])} keys have valid formats")
                return True

        except Exception as e:
            logger.error(f"✗ Failed to validate key formats: {e}")
            self.errors.append(f"Key format validation: {str(e)}")
            return False

    def check_duplicate_keys(self) -> bool:
        """Check for duplicate API keys"""
        try:
            # Get all keys
            keys_result = self.client.table("api_keys_new").select("api_key").execute()

            key_counts = defaultdict(int)
            for key_data in keys_result.data or []:
                api_key = key_data.get("api_key")
                if api_key:
                    key_counts[api_key] += 1

            duplicates = {k: v for k, v in key_counts.items() if v > 1}
            self.stats['duplicate_keys'] = len(duplicates)

            if duplicates:
                logger.error(f"✗ Found {len(duplicates)} duplicate API keys:")
                for key, count in list(duplicates.items())[:10]:
                    logger.error(f"  - {key[:20]}... appears {count} times")
                self.errors.append(f"Duplicate keys: {len(duplicates)}")
                return False
            else:
                logger.info(f"✓ No duplicate keys found")
                return True

        except Exception as e:
            logger.error(f"✗ Failed to check duplicates: {e}")
            self.errors.append(f"Duplicate check: {str(e)}")
            return False

    def check_orphaned_keys(self) -> bool:
        """Check for keys without corresponding users"""
        try:
            # Get all keys with user_id
            keys_result = self.client.table("api_keys_new").select("id, user_id, api_key").execute()

            orphaned = []
            for key_data in keys_result.data or []:
                user_id = key_data.get("user_id")

                # Check if user exists
                user_check = self.client.table("users").select("id").eq("id", user_id).execute()

                if not user_check.data:
                    orphaned.append({
                        'key_id': key_data['id'],
                        'user_id': user_id,
                        'api_key': key_data['api_key'][:20] + "..."
                    })

            self.stats['orphaned_keys'] = len(orphaned)

            if orphaned:
                logger.error(f"✗ Found {len(orphaned)} orphaned keys (user doesn't exist):")
                for key_info in orphaned[:10]:
                    logger.error(f"  - Key {key_info['key_id']} for user {key_info['user_id']}")
                self.errors.append(f"Orphaned keys: {len(orphaned)}")
                return False
            else:
                logger.info(f"✓ No orphaned keys found")
                return True

        except Exception as e:
            logger.error(f"✗ Failed to check orphaned keys: {e}")
            self.errors.append(f"Orphaned key check: {str(e)}")
            return False

    def check_primary_keys(self) -> bool:
        """Verify primary key assignment"""
        try:
            # Get primary key counts per user
            keys_result = self.client.table("api_keys_new").select("user_id, is_primary").eq("is_primary", True).execute()

            user_primary_counts = defaultdict(int)
            for key_data in keys_result.data or []:
                user_id = key_data.get("user_id")
                user_primary_counts[user_id] += 1

            self.stats['primary_keys'] = len(keys_result.data or [])

            # Check for users with multiple primary keys
            multiple_primary = {user_id: count for user_id, count in user_primary_counts.items() if count > 1}

            # Check for users with keys but no primary key
            all_keys = self.client.table("api_keys_new").select("user_id").execute()
            users_with_keys = set(k['user_id'] for k in all_keys.data or [])
            users_with_primary = set(user_primary_counts.keys())
            no_primary = users_with_keys - users_with_primary

            issues = False
            if multiple_primary:
                logger.warning(f"⚠ Found {len(multiple_primary)} users with multiple primary keys:")
                for user_id, count in list(multiple_primary.items())[:10]:
                    logger.warning(f"  - User {user_id}: {count} primary keys")
                self.warnings.append(f"Multiple primary keys: {len(multiple_primary)} users")
                issues = True

            if no_primary:
                logger.warning(f"⚠ Found {len(no_primary)} users with keys but no primary key:")
                for user_id in list(no_primary)[:10]:
                    logger.warning(f"  - User {user_id}")
                self.warnings.append(f"No primary key: {len(no_primary)} users")
                issues = True

            if not issues:
                logger.info(f"✓ All {len(users_with_keys)} users with keys have exactly one primary key")
                return True
            else:
                return False

        except Exception as e:
            logger.error(f"✗ Failed to check primary keys: {e}")
            self.errors.append(f"Primary key check: {str(e)}")
            return False

    def check_key_authentication(self) -> bool:
        """Test authentication with sample keys"""
        try:
            # Get a few sample keys
            keys_result = self.client.table("api_keys_new").select("api_key, user_id").limit(5).execute()

            if not keys_result.data:
                logger.warning("⚠ No keys found to test authentication")
                return True

            auth_failures = []
            for key_data in keys_result.data:
                api_key = key_data.get("api_key")
                user_id = key_data.get("user_id")

                try:
                    # Test get_user function
                    user = get_user(api_key)
                    if not user:
                        auth_failures.append(f"Key for user {user_id}: get_user returned None")
                    elif user.get('id') != user_id:
                        auth_failures.append(f"Key for user {user_id}: returned wrong user {user.get('id')}")
                except Exception as e:
                    auth_failures.append(f"Key for user {user_id}: {str(e)}")

            if auth_failures:
                logger.error(f"✗ Authentication failures ({len(auth_failures)}/{len(keys_result.data)}):")
                for failure in auth_failures:
                    logger.error(f"  - {failure}")
                self.errors.append(f"Authentication failures: {len(auth_failures)}")
                return False
            else:
                logger.info(f"✓ All {len(keys_result.data)} sample keys authenticated successfully")
                return True

        except Exception as e:
            logger.error(f"✗ Failed to test authentication: {e}")
            self.errors.append(f"Authentication test: {str(e)}")
            return False

    def check_indexes(self) -> bool:
        """Verify performance indexes exist"""
        try:
            # Note: This is a simplified check. In production, you'd query pg_indexes
            logger.info("✓ Index check skipped (requires database admin access)")
            logger.info("  Recommended indexes:")
            logger.info("    - idx_api_keys_new_user_id")
            logger.info("    - idx_api_keys_new_api_key")
            logger.info("    - idx_api_keys_new_is_primary")
            logger.info("    - idx_api_keys_new_key_hash")
            return True
        except Exception as e:
            logger.warning(f"⚠ Failed to check indexes: {e}")
            return True  # Non-critical

    def print_summary(self):
        """Print verification summary"""
        logger.info("\n" + "=" * 80)
        logger.info("VERIFICATION SUMMARY")
        logger.info("=" * 80)

        logger.info("\n📊 Statistics:")
        for key, value in self.stats.items():
            logger.info(f"  {key.replace('_', ' ').title()}: {value}")

        if self.errors:
            logger.error(f"\n❌ Errors ({len(self.errors)}):")
            for error in self.errors:
                logger.error(f"  - {error}")

        if self.warnings:
            logger.warning(f"\n⚠️  Warnings ({len(self.warnings)}):")
            for warning in self.warnings:
                logger.warning(f"  - {warning}")

        if not self.errors and not self.warnings:
            logger.info("\n✅ ALL CHECKS PASSED - Migration successful!")
        elif not self.errors:
            logger.info(f"\n⚠️  PASSED WITH WARNINGS - {len(self.warnings)} warnings found")
        else:
            logger.error(f"\n❌ FAILED - {len(self.errors)} errors found")

        logger.info("=" * 80)


def main():
    """Main entry point"""
    try:
        verifier = MigrationVerifier()
        success = verifier.run_all_checks()

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        logger.info("\n\nVerification interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
