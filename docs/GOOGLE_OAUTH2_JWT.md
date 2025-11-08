# Google OAuth2 Service Account JWT Exchange

This document describes the Google OAuth2 JWT exchange implementation for obtaining access tokens from service accounts without using Google SDKs.

## Overview

The `google_oauth2_jwt` module provides a lightweight implementation of the Google OAuth2 JWT Bearer flow for service accounts. This is useful for:

1. **Serverless Environments**: Minimal dependencies in Vercel, Railway, and other serverless platforms
2. **Custom Authentication Flows**: Direct control over the JWT building and token exchange process
3. **Reduced Dependencies**: No need for heavy Google Cloud SDK imports
4. **Performance**: Lower memory footprint compared to full SDKs

## How It Works

The OAuth2 JWT Bearer flow consists of three steps:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Build JWT Assertion                                       │
│    Create a signed JWT with service account credentials     │
│    - Header: typ=JWT, alg=RS256                             │
│    - Payload: iss, scope, aud, exp, iat, sub               │
│    - Signature: RS256 (RSA SHA-256)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 2. Exchange JWT for Access Token                             │
│    POST to https://oauth2.googleapis.com/token              │
│    - grant_type: urn:ietf:params:oauth:grant-type:jwt-bearer│
│    - assertion: [signed JWT]                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 3. Use Access Token                                          │
│    Bearer token for Google API calls                        │
│    Authorization: Bearer ya29.xxxxx                         │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### `build_jwt_assertion()`

Builds a signed JWT assertion for Google OAuth2 service account flow.

**Signature:**
```python
def build_jwt_assertion(
    service_account_email: str,
    private_key: str,
    scope: str = "https://www.googleapis.com/auth/cloud-platform",
    subject: Optional[str] = None,
    audience: str = "https://oauth2.googleapis.com/token",
    expiry_seconds: int = 3600,
) -> str:
```

**Parameters:**
- `service_account_email` (str): Service account email from JSON (iss claim)
- `private_key` (str): Private key in PEM format from service account JSON
- `scope` (str): OAuth2 scope required (default: cloud-platform)
- `subject` (str, optional): Subject claim (sub) - defaults to service account email
- `audience` (str): Token endpoint audience (aud) - defaults to Google's token endpoint
- `expiry_seconds` (int): JWT expiry time in seconds (default: 3600 = 1 hour)

**Returns:**
- str: Signed JWT assertion (header.payload.signature format)

**Example:**
```python
from src.services.google_oauth2_jwt import build_jwt_assertion

jwt = build_jwt_assertion(
    service_account_email="my-sa@my-project.iam.gserviceaccount.com",
    private_key=private_key_from_service_account_json,
    scope="https://www.googleapis.com/auth/cloud-platform",
)
```

### `exchange_jwt_for_access_token()`

Exchanges a JWT assertion for an OAuth2 access token.

**Signature:**
```python
def exchange_jwt_for_access_token(jwt_assertion: str) -> Dict[str, str]:
```

**Parameters:**
- `jwt_assertion` (str): Signed JWT assertion from `build_jwt_assertion()`

**Returns:**
- Dict with keys:
  - `access_token` (str): Bearer token for Google APIs
  - `token_type` (str): Always "Bearer"
  - `expires_in` (int): Token expiry in seconds

**Example:**
```python
from src.services.google_oauth2_jwt import exchange_jwt_for_access_token

token_response = exchange_jwt_for_access_token(jwt)
access_token = token_response["access_token"]  # Use this for API calls
```

### `get_access_token_from_service_account()`

High-level function that handles the complete JWT exchange flow.

**Signature:**
```python
def get_access_token_from_service_account(
    service_account_json: str,
    scope: str = "https://www.googleapis.com/auth/cloud-platform",
) -> str:
```

**Parameters:**
- `service_account_json` (str): Service account JSON as string
- `scope` (str): OAuth2 scope required (default: cloud-platform)

**Returns:**
- str: Access token ready for use with Google APIs

**Example:**
```python
from src.services.google_oauth2_jwt import get_access_token_from_service_account

# Load service account JSON from environment or file
service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

# Get access token
access_token = get_access_token_from_service_account(
    service_account_json,
    scope="https://www.googleapis.com/auth/cloud-platform"
)

# Use with Google API
headers = {"Authorization": f"Bearer {access_token}"}
response = httpx.get("https://...", headers=headers)
```

## Integration with Existing Code

The module is designed to work alongside the existing `google_vertex_client.py`. You can use it to enhance credential handling:

### Example: Using JWT Exchange with Google Vertex AI

```python
from src.services.google_oauth2_jwt import get_access_token_from_service_account
import os

# Get service account credentials
service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

# Get access token using JWT exchange (no SDK)
access_token = get_access_token_from_service_account(service_account_json)

# Use with Google Vertex AI REST API
project_id = "my-project"
location = "us-central1"
model = "gemini-2.0-flash"

url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/{model}:generateContent"

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

response = httpx.post(url, json=request_body, headers=headers)
```

## Security Considerations

### Private Key Handling

The private key is read from the service account JSON but never stored or logged:

```python
# ✓ Safe - private key not stored
service_account_data = json.loads(service_account_json)
private_key = service_account_data["private_key"]
jwt = build_jwt_assertion(email, private_key, scope)

# ✗ Unsafe - might log private key
logger.debug(f"Private key: {private_key}")
```

### Token Expiry

JWTs are signed with a default expiry of 1 hour. Tokens obtained from the exchange endpoint are also typically valid for 1 hour:

```python
# Get token response with expiry information
token_response = exchange_jwt_for_access_token(jwt)
expires_in = token_response["expires_in"]  # Usually 3599 seconds

# Token should be cached and refreshed before expiry
cache_until = time.time() + expires_in - 300  # Refresh 5 min before expiry
```

### Scope Restrictions

Use the minimum required scope for your use case:

```python
# ✓ Minimal scope - only what's needed
access_token = get_access_token_from_service_account(
    service_account_json,
    scope="https://www.googleapis.com/auth/aiplatform"  # Just AI Platform
)

# ✗ Overly broad scope
access_token = get_access_token_from_service_account(
    service_account_json,
    scope="https://www.googleapis.com/auth/cloud-platform"  # Everything
)
```

## Supported Google Scopes

Common scopes for Google Cloud services:

| Scope | Use Case |
|-------|----------|
| `https://www.googleapis.com/auth/cloud-platform` | Full Cloud API access (broadest) |
| `https://www.googleapis.com/auth/aiplatform` | Vertex AI only |
| `https://www.googleapis.com/auth/ai-platform` | AI Platform only |
| `https://www.googleapis.com/auth/compute` | Compute Engine only |
| `https://www.googleapis.com/auth/cloud-vision` | Vision API only |

For Vertex AI, use `https://www.googleapis.com/auth/cloud-platform` (required for now).

## Error Handling

The module provides detailed error messages for common issues:

### Invalid Service Account JSON

```python
try:
    access_token = get_access_token_from_service_account("invalid json")
except ValueError as e:
    print(e)  # "Invalid service account JSON: ..."
```

### Missing Required Fields

```python
try:
    # Missing client_email or private_key
    access_token = get_access_token_from_service_account(incomplete_json)
except ValueError as e:
    print(e)  # "Service account JSON missing 'client_email' field"
```

### JWT Exchange Failures

```python
try:
    access_token = get_access_token_from_service_account(json_str)
except ValueError as e:
    # Includes HTTP status code and response details
    print(e)  # "Google OAuth2 token endpoint returned 401..."
```

## Testing

The module includes comprehensive tests in `tests/services/test_google_oauth2_jwt.py`:

```bash
# Run all tests
pytest tests/services/test_google_oauth2_jwt.py -v

# Run specific test
pytest tests/services/test_google_oauth2_jwt.py::test_build_jwt_assertion_structure -v

# Run with coverage
pytest tests/services/test_google_oauth2_jwt.py --cov=src.services.google_oauth2_jwt
```

### Test Coverage

- **Base64URL Encoding**: Round-trip encoding/decoding
- **JWT Building**: Header/payload structure, claims validation, expiry calculation
- **JWT Exchange**: Success cases, error handling (401, 500, network errors)
- **Integration**: Full end-to-end flow with mocked Google APIs

## Performance Considerations

### Token Caching

The access token should be cached to avoid repeated exchange calls:

```python
import time
from functools import lru_cache

@lru_cache(maxsize=1)
def get_cached_access_token():
    """Get cached access token (1-hour expiry)"""
    return get_access_token_from_service_account(service_account_json)

# Token will be cached and reused for subsequent calls
token1 = get_cached_access_token()
token2 = get_cached_access_token()  # Same token, no network call
```

### Async Support

For async code, wrap the synchronous functions:

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
        service_account_json
    )
```

## Comparison with SDKs

### Using google-auth SDK
```python
from google.oauth2.service_account import Credentials

creds = Credentials.from_service_account_info(
    service_account_dict, scopes=scopes)
creds.refresh(Request())
access_token = creds.token
```

**Pros**: Official, well-tested, comprehensive
**Cons**: Heavy dependency, more memory, slower startup

### Using google_oauth2_jwt (this module)
```python
from src.services.google_oauth2_jwt import get_access_token_from_service_account

access_token = get_access_token_from_service_account(service_account_json)
```

**Pros**: Lightweight, minimal dependencies, fast, serverless-friendly
**Cons**: Fewer features, manual token refresh needed

## Troubleshooting

### "Invalid assertion" (401 error)

The JWT assertion is invalid. Check:
1. Private key is valid and in PEM format
2. Service account email matches the credentials
3. JWT expiry hasn't passed

### "Token endpoint returned 500"

Google's servers are having issues. Retry with exponential backoff:

```python
import time

def get_token_with_retry(max_retries=3):
    for attempt in range(max_retries):
        try:
            return get_access_token_from_service_account(json_str)
        except ValueError as e:
            if "returned 500" in str(e) and attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 1s, 2s, 4s
            else:
                raise
```

### Network timeout

Increase the timeout in `exchange_jwt_for_access_token()`:

```python
# Modify the httpx.Client timeout
# (Requires code change in google_oauth2_jwt.py)
# Currently set to 30 seconds
```

## Related Documentation

- [Google OAuth2 Service Account Documentation](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Google Vertex AI Integration](./GOOGLE_VERTEX_AI.md)
- [Google Cloud Credentials Guide](./GOOGLE_CREDENTIALS.md)

## Implementation Details

### JWT Building Process

1. **Header**: Standard JWT header with RS256 algorithm
2. **Payload**: Claims including:
   - `iss`: Service account email
   - `scope`: Requested OAuth2 scope
   - `aud`: Token endpoint URL
   - `exp`: Expiry time (default +1 hour)
   - `iat`: Issued time
   - `sub`: Subject (service account email)

3. **Signature**: RS256 (RSA with SHA-256) signed with service account private key

### Token Exchange Flow

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=[JWT]

Response:
{
  "access_token": "ya29.xxx...",
  "token_type": "Bearer",
  "expires_in": 3599
}
```

## Version History

- **v1.0.0**: Initial implementation
  - JWT building with RS256 signing
  - Token exchange with Google OAuth2 endpoint
  - Error handling and logging
  - Comprehensive test coverage

## License

Part of Gatewayz Universal Inference API (v2.0.3)
