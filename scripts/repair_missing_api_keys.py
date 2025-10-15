#!/usr/bin/env python3
"""
Repair script to fix users who have temp API keys but no entries in api_keys_new table.

This script:
1. Finds all users with gw_temp_* keys in users.api_key
2. Checks if they have any keys in api_keys_new
3. For users missing keys, creates a proper primary key
4. Updates users.api_key with the new primary key
"""

import logging
import sys
import secrets
from datetime import datetime, timezone
from src.supabase_config import get_supabase_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_affected_users():
    """Find users with temp keys but no entries in api_keys_new"""
    client = get_supabase_client()

    # Get all users (we'll filter for temp keys in Python)
    users_result = client.table('users').select('id, email, api_key, privy_user_id').execute()

    if not users_result.data:
        logger.info("No users found")
        return []

    # Filter for users with temp keys
    temp_key_users = [u for u in users_result.data if u.get('api_key', '').startswith('gw_temp_')]

    if not temp_key_users:
        logger.info("No users found with temp API keys")
        return []

    logger.info(f"Found {len(temp_key_users)} users with temp API keys")

    affected_users = []

    for user in temp_key_users:
        # Check if user has any keys in api_keys_new
        keys_result = client.table('api_keys_new').select('id, api_key, is_primary').eq('user_id', user['id']).execute()

        if not keys_result.data:
            logger.warning(f"User {user['id']} ({user['email']}) has NO keys in api_keys_new")
            affected_users.append(user)
        else:
            logger.info(f"User {user['id']} ({user['email']}) has {len(keys_result.data)} key(s) in api_keys_new - OK")

    return affected_users

def repair_user(user_id: int, email: str, dry_run: bool = True):
    """Create a proper primary API key for a user"""
    client = get_supabase_client()

    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Repairing user {user_id} ({email})")

    if dry_run:
        logger.info(f"[DRY RUN] Would create primary API key for user {user_id}")
        return None

    try:
        # Generate new API key
        random_part = secrets.token_urlsafe(32)
        new_key = f"gw_live_{random_part}"

        # Create the API key record (without trial fields that don't exist in schema)
        api_key_data = {
            'user_id': user_id,
            'key_name': "Primary Key (Auto-repaired)",
            'api_key': new_key,
            'is_active': True,
            'is_primary': True,
            'environment_tag': 'live',
            'requests_used': 0,
            'scope_permissions': {
                'read': ['*'],
                'write': ['*'],
                'admin': ['*']
            },
            'ip_allowlist': [],
            'domain_referrers': [],
            'last_used_at': datetime.now(timezone.utc).isoformat()
        }

        # Insert the API key
        result = client.table('api_keys_new').insert(api_key_data).execute()

        if not result.data:
            logger.error(f"❌ Failed to create API key for user {user_id}")
            return None

        logger.info(f"✅ Created primary API key for user {user_id}: {new_key[:15]}...")

        # Update users.api_key
        update_result = client.table('users').update({
            'api_key': new_key
        }).eq('id', user_id).execute()

        if update_result.data:
            logger.info(f"✅ Updated users.api_key for user {user_id}")
        else:
            logger.error(f"❌ Failed to update users.api_key for user {user_id}")

        return new_key

    except Exception as e:
        logger.error(f"❌ Error repairing user {user_id}: {e}")
        return None

def main():
    """Main repair function"""
    import argparse

    parser = argparse.ArgumentParser(description='Repair users with missing API keys')
    parser.add_argument('--execute', action='store_true', help='Actually repair the users (default is dry run)')
    args = parser.parse_args()

    logger.info("=" * 80)
    logger.info("API Key Repair Script - Finding affected users...")
    logger.info("=" * 80)

    # Find affected users
    affected_users = find_affected_users()

    if not affected_users:
        logger.info("✅ No users need repair!")
        return

    logger.info("\n" + "=" * 80)
    logger.info(f"Found {len(affected_users)} users that need repair:")
    logger.info("=" * 80)

    for user in affected_users:
        logger.info(f"  - User ID: {user['id']}, Email: {user['email']}, Temp Key: {user['api_key'][:20]}...")

    if not args.execute:
        logger.info("\n" + "=" * 80)
        logger.info("DRY RUN MODE - No changes will be made")
        logger.info("To actually repair these users, run with --execute flag")
        logger.info("=" * 80)
        return

    logger.info("\n" + "=" * 80)
    logger.info("Starting repair process...")
    logger.info("=" * 80)

    success_count = 0
    fail_count = 0

    for user in affected_users:
        new_key = repair_user(user['id'], user['email'], dry_run=False)
        if new_key:
            success_count += 1
        else:
            fail_count += 1

    logger.info("\n" + "=" * 80)
    logger.info("Repair Complete!")
    logger.info("=" * 80)
    logger.info(f"✅ Successfully repaired: {success_count} user(s)")
    if fail_count > 0:
        logger.warning(f"❌ Failed to repair: {fail_count} user(s)")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nRepair cancelled by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)
