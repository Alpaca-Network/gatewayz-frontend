"""
Fix primary keys for existing users
This script ensures all users' primary API keys are properly flagged with is_primary=True
"""
import logging
from src.supabase_config import get_supabase_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_primary_keys():
    """Fix primary keys for all users"""
    try:
        client = get_supabase_client()

        # Get all users
        users_result = client.table('users').select('id, api_key').execute()

        if not users_result.data:
            logger.info("No users found")
            return

        logger.info(f"Found {len(users_result.data)} users")

        fixed_count = 0
        already_correct = 0

        for user in users_result.data:
            user_id = user['id']
            user_api_key = user.get('api_key')

            if not user_api_key:
                logger.warning(f"User {user_id} has no API key in users table")
                continue

            # Check if this key exists in api_keys_new
            key_result = client.table('api_keys_new').select('id, is_primary, key_name').eq('api_key', user_api_key).execute()

            if not key_result.data:
                logger.warning(f"User {user_id}'s API key not found in api_keys_new table: {user_api_key[:15]}...")
                continue

            key_data = key_result.data[0]

            # Check if it's already marked as primary
            if key_data.get('is_primary'):
                already_correct += 1
                logger.info(f"User {user_id}'s key is already marked as primary")
                continue

            # Fix it - mark as primary
            logger.info(f"Fixing user {user_id}'s key - marking as primary")
            client.table('api_keys_new').update({
                'is_primary': True,
                'key_name': 'Primary Key'  # Also ensure it has the right name
            }).eq('id', key_data['id']).execute()

            fixed_count += 1
            logger.info(f"✓ Fixed user {user_id}'s primary key")

        logger.info(f"\n=== Summary ===")
        logger.info(f"Total users: {len(users_result.data)}")
        logger.info(f"Already correct: {already_correct}")
        logger.info(f"Fixed: {fixed_count}")
        logger.info(f"Problematic: {len(users_result.data) - already_correct - fixed_count}")

        return {
            'total': len(users_result.data),
            'already_correct': already_correct,
            'fixed': fixed_count
        }

    except Exception as e:
        logger.error(f"Error fixing primary keys: {e}")
        raise

if __name__ == "__main__":
    print("Starting primary key fix...")
    result = fix_primary_keys()
    print(f"\nDone! Fixed {result['fixed']} primary keys")
