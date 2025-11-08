# Google OAuth2 JWT Integration Guide

This guide shows how to integrate the new `google_oauth2_jwt` module with existing Gatewayz code.

## Module Overview

The new `google_oauth2_jwt` module provides a lightweight alternative to Google SDKs for obtaining OAuth2 access tokens from service account credentials.

**Location**: `src/services/google_oauth2_jwt.py`
**Size**: ~300 lines, no heavy dependencies
**Use Case**: Serverless deployments (Vercel, Railway) needing minimal footprint

## Integration Points

### 1. With `google_vertex_client.py` (Recommended)

The existing `google_vertex_client.py` already has credential handling. The new module can enhance or replace it:

**Current Approach** (using Google auth library):
```python
# From google_vertex_client.py:40-90
from google.oauth2.service_account import Credentials

credentials = Credentials.from_service_account_info(
    creds_dict, scopes=VERTEX_AI_SCOPES
)
credentials.refresh(Request())
access_token = credentials.token
```

**New Lightweight Approach**:
```python
from src.services.google_oauth2_jwt import get_access_token_from_service_account

access_token = get_access_token_from_service_account(
    service_account_json=os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON"),
    scope="https://www.googleapis.com/auth/cloud-platform"
)
```

### 2. Update `get_google_vertex_access_token()` Function

**File**: `src/services/google_vertex_client.py:149-226`

**Before**:
```python
def get_google_vertex_access_token():
    """Get Google Vertex AI access token for REST API calls"""
    try:
        logger.info("Getting credentials for Vertex AI access token")
        credentials = get_google_vertex_credentials()

        from google.auth.transport.requests import Request as AuthRequest
        if not credentials.valid or credentials.expired:
            logger.info("Refreshing expired or invalid credentials")
            credentials.refresh(AuthRequest())

        if hasattr(credentials, 'token') and credentials.token:
            logger.info(f"Successfully obtained access token")
            return credentials.token

        # ... error handling
```

**After (Optional Enhancement)**:
```python
def get_google_vertex_access_token():
    """Get Google Vertex AI access token for REST API calls"""
    try:
        logger.info("Getting credentials for Vertex AI access token")

        # Try lightweight JWT approach first (no SDK needed)
        try:
            import os
            creds_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
            if creds_json:
                from src.services.google_oauth2_jwt import get_access_token_from_service_account
                token = get_access_token_from_service_account(creds_json)
                logger.info("Using lightweight JWT exchange for access token")
                return token
        except Exception as e:
            logger.debug(f"JWT approach failed, falling back to SDK: {e}")

        # Fallback to SDK approach (existing code)
        credentials = get_google_vertex_credentials()
        from google.auth.transport.requests import Request as AuthRequest
        # ... rest of existing code
```

### 3. Creating a Wrapper Function

**File**: `src/services/google_oauth2_jwt.py` (already done)

**Usage Example**:
```python
# In any service that needs Google API access
from src.services.google_oauth2_jwt import get_access_token_from_service_account

# Get token with default scope
token = get_access_token_from_service_account(
    os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
)

# Get token with custom scope
token = get_access_token_from_service_account(
    os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON"),
    scope="https://www.googleapis.com/auth/aiplatform"
)
```

## Integration Paths

### Path 1: Drop-In Replacement (Recommended for New Code)

For new endpoints or services that don't yet use Vertex AI:

```python
# src/routes/my_new_route.py
from src.services.google_oauth2_jwt import get_access_token_from_service_account
import httpx

@router.post("/my-vertex-endpoint")
async def my_vertex_endpoint(request: MyRequest):
    # Get access token
    access_token = get_access_token_from_service_account(
        os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    )

    # Make API call
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://...-aiplatform.googleapis.com/v1/...",
            headers=headers,
            json=request.dict()
        )

    return response.json()
```

### Path 2: Gradual Migration

For existing code using `google_vertex_client.py`:

1. **Phase 1**: Add JWT module alongside existing code (done)
2. **Phase 2**: Create a compatibility wrapper that tries JWT first, falls back to SDK
3. **Phase 3**: Gradually replace SDK usage in non-critical paths
4. **Phase 4**: (Optional) Remove SDK dependency entirely

**Compatibility Wrapper Example**:
```python
# src/services/google_auth_wrapper.py
import os
from typing import Optional

async def get_access_token(scope: Optional[str] = None) -> str:
    """Get access token using lightweight JWT approach with SDK fallback"""

    # Try JWT approach first (lightweight)
    try:
        from src.services.google_oauth2_jwt import get_access_token_from_service_account
        creds_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
        if creds_json:
            return get_access_token_from_service_account(
                creds_json,
                scope=scope or "https://www.googleapis.com/auth/cloud-platform"
            )
    except Exception as e:
        logger.debug(f"JWT approach failed: {e}")

    # Fallback to SDK approach
    from src.services.google_vertex_client import get_google_vertex_access_token
    return get_google_vertex_access_token()
```

### Path 3: Use Case Specific Integration

**For Serverless Deployments** (Vercel, Railway):
- Use JWT approach exclusively (no SDK overhead)
- Configure only `GOOGLE_VERTEX_CREDENTIALS_JSON` env var
- Reduced startup time and memory usage

**For Docker/Self-Hosted**:
- Keep SDK approach (more features)
- Or use JWT approach (lighter footprint)
- Both approaches work equally well

## Configuration

### Environment Variables

Both approaches use the same environment variables:

```bash
# Service account credentials (raw JSON or base64)
export GOOGLE_VERTEX_CREDENTIALS_JSON='{"type":"service_account",...}'

# GCP project and location
export GOOGLE_PROJECT_ID=my-project-123
export GOOGLE_VERTEX_LOCATION=us-central1
```

### OAuth2 Scopes

The new module supports any Google OAuth2 scope:

```python
# Broad scope (default)
scope="https://www.googleapis.com/auth/cloud-platform"

# Specific scope (recommended)
scope="https://www.googleapis.com/auth/aiplatform"

# Custom scope
scope="https://www.googleapis.com/auth/your-custom-scope"
```

## Testing Integration

### Unit Tests

For testing code that uses the new module:

```python
# tests/services/test_my_service.py
from unittest.mock import patch

@patch("src.services.google_oauth2_jwt.get_access_token_from_service_account")
def test_my_endpoint(mock_token):
    mock_token.return_value = "mock_access_token_xyz"

    # Test your code that uses the token
    result = my_function()

    # Verify token was requested
    mock_token.assert_called_once()
    assert result.status_code == 200
```

### Integration Tests

For testing the full flow with mock Google APIs:

```python
# tests/integration/test_vertex_ai_integration.py
from unittest.mock import patch, MagicMock

@patch("httpx.Client.post")
@patch("src.services.google_oauth2_jwt.exchange_jwt_for_access_token")
def test_vertex_ai_call(mock_exchange, mock_post):
    # Mock token exchange
    mock_exchange.return_value = {
        "access_token": "ya29.mock_token",
        "token_type": "Bearer",
        "expires_in": 3599
    }

    # Mock API response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"candidates": [...]}
    mock_post.return_value = mock_response

    # Test your endpoint
    result = call_my_endpoint()

    # Verify calls were made
    assert mock_exchange.called
    assert mock_post.called
    assert result.status_code == 200
```

## Performance Considerations

### Token Caching

The access token should be cached to avoid repeated exchanges:

```python
# src/services/token_cache.py
from functools import lru_cache
import time

@lru_cache(maxsize=1)
def get_cached_access_token():
    """Get and cache access token for ~1 hour"""
    from src.services.google_oauth2_jwt import get_access_token_from_service_account
    return get_access_token_from_service_account(
        os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    )

# Use in your code:
token = get_cached_access_token()  # First call: exchanges JWT
token = get_cached_access_token()  # Subsequent calls: from cache
```

### Async Integration

For async code, wrap the synchronous function:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=1)

async def get_access_token_async():
    """Async wrapper for token exchange"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        executor,
        get_access_token_from_service_account,
        os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    )
```

## Migration Checklist

- [ ] Review `google_oauth2_jwt.py` implementation
- [ ] Read the quick start guide: `docs/GOOGLE_OAUTH2_JWT_QUICKSTART.md`
- [ ] Check examples: `examples/google_oauth2_jwt_example.py`
- [ ] Run tests: `pytest tests/services/test_google_oauth2_jwt.py -v`
- [ ] Create compatibility wrapper (optional)
- [ ] Test with mock Google APIs
- [ ] Deploy to staging environment
- [ ] Monitor for any issues
- [ ] Gradually migrate other endpoints
- [ ] Collect feedback and optimize

## Rollback Plan

If issues occur:

1. **Immediate**: Revert to SDK approach in production
   - Comment out JWT imports
   - Revert `get_google_vertex_access_token()` to use SDK
   - Deploy fix

2. **Short-term**: Keep both approaches available
   - JWT approach as primary
   - SDK approach as fallback
   - Gradually migrate back to SDK if needed

3. **Long-term**: Address root cause
   - Review error logs
   - Fix configuration issues
   - Re-test thoroughly before re-deploying

## Monitoring & Logging

The module includes comprehensive logging:

```python
import logging

logger = logging.getLogger("google_oauth2_jwt")
logger.setLevel(logging.DEBUG)

# Monitor these log messages:
# - "Building JWT assertion for service account: ..."
# - "JWT assertion built successfully"
# - "Successfully obtained access token"
# - "Google OAuth2 token endpoint returned ..."
```

## Support & Troubleshooting

### Common Issues

1. **"Invalid service account JSON"**
   - Verify JSON is valid: `python3 -m json.tool < service-account.json`
   - Check required fields: `client_email`, `private_key`

2. **"returned 401" (Unauthorized)**
   - Verify private key is valid
   - Check service account hasn't been deleted
   - Ensure credentials haven't expired

3. **"returned 403" (Permission Denied)**
   - Add IAM role: `roles/aiplatform.user`
   - Enable Vertex AI API in GCP Console
   - Check service account has proper permissions

### Getting Help

- Review the full documentation: `docs/GOOGLE_OAUTH2_JWT.md`
- Check the quick start: `docs/GOOGLE_OAUTH2_JWT_QUICKSTART.md`
- Run the examples: `python3 examples/google_oauth2_jwt_example.py`
- Check the tests: `tests/services/test_google_oauth2_jwt.py`

## Next Steps

1. **For New Development**: Use the JWT approach exclusively
2. **For Existing Code**: Keep current approach, migrate gradually if desired
3. **For Serverless**: Switch to JWT approach for reduced overhead
4. **For Monitoring**: Enable debug logging to track token exchanges

---

**Questions?** See the documentation files or check the test cases for usage patterns.
