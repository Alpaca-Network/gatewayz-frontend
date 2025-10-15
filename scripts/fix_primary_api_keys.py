"""
Migration script to fix is_primary flag for existing API keys.

This script identifies API keys that should be marked as primary (the first/main key
for each user) and updates the is_primary flag in the database.
"""

import logging
import sys
import os

# Add parent directory to path to import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.supabase_config import get_supabase_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def fix_primary_api_keys():
    """
    Fix is_primary flag for existing API keys.

    Strategy:
    1. For each user, find their oldest API key with key_name='Primary Key'
    2. Set is_primary=True for that key
    3. Ensure all other keys have is_primary=False
    """
    try:
        client = get_supabase_client()

        # Get all users
        logger.info("Fetching all users...")
        users_result = client.table('users').select('id, username, api_key').execute()
        users = users_result.data
        logger.info(f"Found {len(users)} users")

        fixed_count = 0
        skipped_count = 0
        error_count = 0

        for user in users:
            user_id = user['id']
            username = user.get('username', 'Unknown')
            legacy_api_key = user.get('api_key')

            try:
                # Get all API keys for this user from api_keys_new table
                keys_result = client.table('api_keys_new').select('*').eq('user_id', user_id).order('created_at', desc=False).execute()
                keys = keys_result.data

                if not keys:
                    logger.info(f"User {user_id} ({username}) has no keys in api_keys_new table")
                    skipped_count += 1
                    continue

                # Find the primary key candidate
                primary_key_candidate = None

                # Strategy 1: Look for a key with key_name='Primary Key' or 'Primary API Key'
                for key in keys:
                    if key.get('key_name') in ['Primary Key', 'Primary API Key']:
                        primary_key_candidate = key
                        break

                # Strategy 2: If no "Primary Key" found, use the oldest key
                if not primary_key_candidate:
                    primary_key_candidate = keys[0]  # Already sorted by created_at ascending

                # Strategy 3: If legacy api_key matches one in api_keys_new, use that
                if legacy_api_key:
                    for key in keys:
                        if key['api_key'] == legacy_api_key:
                            primary_key_candidate = key
                            break

                # Check if the primary key already has is_primary=True
                if primary_key_candidate.get('is_primary', False):
                    logger.info(f"User {user_id} ({username}) already has primary key set: {primary_key_candidate['api_key'][:20]}...")
                    skipped_count += 1
                    continue

                # Update the primary key
                logger.info(f"Setting is_primary=True for user {user_id} ({username}) key: {primary_key_candidate['api_key'][:20]}...")
                client.table('api_keys_new').update({
                    'is_primary': True
                }).eq('id', primary_key_candidate['id']).execute()

                # Ensure all other keys have is_primary=False
                for key in keys:
                    if key['id'] != primary_key_candidate['id'] and key.get('is_primary', False):
                        logger.info(f"Setting is_primary=False for non-primary key: {key['api_key'][:20]}...")
                        client.table('api_keys_new').update({
                            'is_primary': False
                        }).eq('id', key['id']).execute()

                fixed_count += 1
                logger.info(f"✓ Fixed user {user_id} ({username})")

            except Exception as e:
                logger.error(f"Error processing user {user_id} ({username}): {e}")
                error_count += 1
                continue

        logger.info("\n" + "="*60)
        logger.info("Migration complete!")
        logger.info(f"Fixed: {fixed_count} users")
        logger.info(f"Skipped: {skipped_count} users (already correct or no keys)")
        logger.info(f"Errors: {error_count} users")
        logger.info("="*60)

        return fixed_count, skipped_count, error_count

    except Exception as e:
        logger.error(f"Fatal error during migration: {e}")
        raise


if __name__ == "__main__":
    logger.info("Starting API key migration...")
    logger.info("This script will set is_primary=True for each user's primary API key")
    logger.info("")

    try:
        fixed, skipped, errors = fix_primary_api_keys()
        if errors > 0:
            sys.exit(1)
        sys.exit(0)
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)
