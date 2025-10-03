import datetime
import logging

from src.db.users import get_user
from fastapi import APIRouter, Depends

from datetime import datetime, timezone

from fastapi import HTTPException, Request

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.supabase_config import get_supabase_client

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)
router = APIRouter()

security = HTTPBearer()

async def get_api_key(credentials: HTTPAuthorizationCredentials = Depends(security), request: Request = None):
    """Validate an API key from either legacy or new system with access controls"""
    if not credentials:
        raise HTTPException(status_code=422, detail="Authorization header is required")

    api_key = credentials.credentials
    if not api_key:
        raise HTTPException(status_code=401, detail="API key is required")

    # Phase 4 secure validation with IP/domain enforcement
    logger.info(f"Starting Phase 4 validation for key: {api_key[:20]}...")

    # Extract security context from request
    client_ip = "127.0.0.1"  # Default for testing
    referer = None

    if request:
        # Extract real IP and headers
        client_ip = request.client.host if request.client else "127.0.0.1"
        referer = request.headers.get("referer")

    logger.info(f"Phase 4 validation: Client IP: {client_ip}, Referer: {referer}")

    # Phase 4 secure validation with IP/domain enforcement
    client = get_supabase_client()

    # Check both new and legacy API key tables
    tables_to_check = ['api_keys', 'api_keys_new']

    for table_name in tables_to_check:
        logger.info(f"Phase 4 validation: Checking {table_name} table")

        # Get all API keys from this table
        result = client.table(table_name).select('*').execute()

        logger.info(f"Phase 4 validation: Found {len(result.data) if result.data else 0} keys in {table_name}")

        if result.data:
            for key_data in result.data:
                stored_key = key_data['api_key']

                # Check if it's a plain text key (current system)
                if stored_key.startswith(('gw_live_', 'gw_test_', 'gw_staging_', 'gw_dev_')):
                    # Compare with a provided key
                    if stored_key == api_key:
                        # Found matching key, now validate with Phase 4 security checks
                        key_id = key_data['id']

                        logger.info(
                            f"Phase 4 validation: Found matching key {key_id} in {table_name}, IP: {client_ip}, Allowlist: {key_data.get('ip_allowlist', [])}")

                        # Check if the key is active
                        if not key_data.get('is_active', True):
                            logger.warning(f"Key {key_id} is inactive")
                            raise HTTPException(status_code=401, detail="API key is inactive")

                        # Check expiration date
                        if key_data.get('expiration_date'):
                            try:
                                expiration_str = key_data['expiration_date']
                                if expiration_str:
                                    if 'Z' in expiration_str:
                                        expiration_str = expiration_str.replace('Z', '+00:00')
                                    elif not expiration_str.endswith('+00:00'):
                                        expiration_str = expiration_str + '+00:00'

                                    expiration = datetime.fromisoformat(expiration_str)
                                    now = datetime.now(timezone.utc).replace(tzinfo=expiration.tzinfo)

                                    if expiration < now:
                                        logger.warning(f"Key {key_id} has expired")
                                        raise HTTPException(status_code=401, detail="API key has expired")
                            except Exception as date_error:
                                logger.warning(f"Error checking expiration for key {key_id}: {date_error}")

                        # Check request limits
                        if key_data.get('max_requests') is not None:
                            if key_data.get('requests_used', 0) >= key_data['max_requests']:
                                logger.warning(f"Key {key_id} request limit reached")
                                raise HTTPException(status_code=429, detail="API key request limit reached")

                        # IP allowlist enforcement
                        ip_allowlist = key_data.get('ip_allowlist') or []
                        if ip_allowlist and len(ip_allowlist) > 0 and ip_allowlist != ['']:
                            logger.info(f"Checking IP {client_ip} against allowlist {ip_allowlist}")
                            if client_ip not in ip_allowlist:
                                logger.warning(f"IP {client_ip} not in allowlist {ip_allowlist}")
                                raise HTTPException(status_code=403, detail="IP address not allowed for this API key")

                        # Domain referrer enforcement
                        domain_referrers = key_data.get('domain_referrers') or []
                        if domain_referrers and len(domain_referrers) > 0 and domain_referrers != ['']:
                            logger.info(f"Checking domain {referer} against allowlist {domain_referrers}")
                            if not referer or not any(domain in referer for domain in domain_referrers):
                                logger.warning(f"Domain {referer} not in allowlist {domain_referrers}")
                                raise HTTPException(status_code=403, detail="Domain not allowed for this API key")

                        # Update last used timestamp
                        try:
                            client.table(table_name).update({
                                'last_used_at': datetime.now(timezone.utc).isoformat()
                            }).eq('id', key_id).execute()
                        except Exception as update_error:
                            logger.warning(f"Failed to update last_used_at for key {key_id}: {update_error}")

                        logger.info(f"Phase 4 validation successful for key {key_id} from {table_name}")
                        return api_key

    logger.info("Phase 4 validation: No matching key found, falling back to legacy validation")

    # If no matching key found, try legacy validation
    user = get_user(api_key)
    if user:
        # Legacy validation fallback
        logger.info("Using legacy validation fallback")
        return api_key

    # If not found in either system, reject
    raise HTTPException(status_code=401, detail="Invalid API key")
