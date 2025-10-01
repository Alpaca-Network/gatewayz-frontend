import json
import logging
from datetime import datetime

from src.supabase_config import get_supabase_client


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


DEFAULT_SCOPE_PERMISSIONS = {
    "read": ["*"],
    "write": ["*"],
    "admin": ["*"]
}


def ensure_scope_permissions_table(table_name: str) -> int:
    client = get_supabase_client()
    updated = 0

    try:
        # Find rows with NULL or empty scope_permissions
        result = client.table(table_name).select("id, scope_permissions").execute()
        rows = result.data or []

        for row in rows:
            scope = row.get("scope_permissions")

            missing = scope is None
            if not missing and isinstance(scope, str):
                try:
                    parsed = json.loads(scope)
                    missing = parsed == {} or parsed is None
                except Exception:
                    missing = True
            elif not missing and isinstance(scope, dict):
                missing = scope == {}

            if missing:
                try:
                    client.table(table_name).update({
                        "scope_permissions": DEFAULT_SCOPE_PERMISSIONS,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", row["id"]).execute()
                    updated += 1
                except Exception as e:
                    logger.warning(f"Failed to update scope_permissions for {table_name}.id={row.get('id')}: {e}")
    except Exception as e:
        logger.error(f"Failed reading from {table_name}: {e}")

    return updated


def main():
    total = 0
    updated_new = ensure_scope_permissions_table("api_keys_new")
    logger.info(f"Updated scope_permissions in api_keys_new: {updated_new}")
    total += updated_new

    updated_legacy = ensure_scope_permissions_table("api_keys")
    logger.info(f"Updated scope_permissions in api_keys (legacy): {updated_legacy}")
    total += updated_legacy

    logger.info(f"Backfill complete. Total keys updated: {total}")


if __name__ == "__main__":
    main()


