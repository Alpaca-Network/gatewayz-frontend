# Google OAuth2 JWT Exchange - Quick Start Guide

Get started with raw OAuth2 service account JWT exchange in 5 minutes.

## Installation

The module is part of the Gatewayz application and requires only standard dependencies:
- Python 3.10+
- `cryptography` (for RSA signing)
- `httpx` (for HTTP requests)

Both are already in `requirements.txt`.

## Quick Start

### 1. Get Your Service Account JSON

First, you need a Google Cloud service account JSON file. If you don't have one:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Create a new service account or select an existing one
5. Go to **Keys** tab and create a JSON key
6. Download the JSON file

### 2. Set Environment Variable

```bash
# Option 1: Export environment variable
export GOOGLE_VERTEX_CREDENTIALS_JSON='{"type":"service_account",...}'

# Option 2: Use base64-encoded JSON (for Vercel/Railway)
export GOOGLE_VERTEX_CREDENTIALS_JSON=$(base64 -w0 service-account.json)

# Option 3: Use file path
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 3. Get Access Token (One Line!)

```python
from src.services.google_oauth2_jwt import get_access_token_from_service_account
import os

service_account_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
access_token = get_access_token_from_service_account(service_account_json)

print(f"Access token: {access_token}")
```

### 4. Use Token with Google APIs

```python
import httpx

# Make a request to any Google API
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

response = httpx.post(
    "https://us-central1-aiplatform.googleapis.com/v1/...",
    headers=headers,
    json={"your": "request_body"}
)
```

## Common Use Cases

### Google Vertex AI

```python
from src.services.google_oauth2_jwt import get_access_token_from_service_account

# Get token
token = get_access_token_from_service_account(
    os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
)

# Call Vertex AI API
url = "https://us-central1-aiplatform.googleapis.com/v1/projects/[PROJECT_ID]/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent"

response = httpx.post(
    url,
    headers={"Authorization": f"Bearer {token}"},
    json={
        "contents": [{
            "role": "user",
            "parts": [{"text": "Hello!"}]
        }]
    }
)
```

### Custom Scope

```python
# Request a specific scope
token = get_access_token_from_service_account(
    service_account_json,
    scope="https://www.googleapis.com/auth/aiplatform"
)
```

### Token Caching

```python
from functools import lru_cache

@lru_cache(maxsize=1)
def get_cached_token():
    return get_access_token_from_service_account(service_account_json)

# Token is cached - no repeated network calls
token1 = get_cached_token()
token2 = get_cached_token()  # From cache!
```

## API Reference (Short Version)

### `get_access_token_from_service_account(service_account_json, scope)`

**Quick function:** One call to get your access token.

```python
token = get_access_token_from_service_account(
    service_account_json="...",
    scope="https://www.googleapis.com/auth/cloud-platform"  # default
)
```

### `build_jwt_assertion(email, private_key, scope, expiry_seconds)`

**Advanced function:** Build JWT step-by-step if you need more control.

```python
jwt = build_jwt_assertion(
    service_account_email="sa@project.iam.gserviceaccount.com",
    private_key=private_key_pem,
    scope="https://www.googleapis.com/auth/cloud-platform",
    expiry_seconds=3600  # 1 hour
)
```

### `exchange_jwt_for_access_token(jwt_assertion)`

**Advanced function:** Exchange a JWT for a token.

```python
response = exchange_jwt_for_access_token(jwt_assertion)
token = response["access_token"]
```

## Available OAuth2 Scopes

| Scope | Service |
|-------|---------|
| `https://www.googleapis.com/auth/cloud-platform` | All Google Cloud APIs (broadest) |
| `https://www.googleapis.com/auth/aiplatform` | Vertex AI only |
| `https://www.googleapis.com/auth/compute` | Compute Engine only |
| `https://www.googleapis.com/auth/cloud-vision` | Vision API only |

## Troubleshooting

### "Invalid service account JSON"

```
Error: Invalid service account JSON: ...
```

**Solution:** Verify your JSON is valid:
```bash
cat service-account.json | python3 -m json.tool
```

### "client_email field missing"

```
Error: Service account JSON missing 'client_email' field
```

**Solution:** Your JSON is missing required fields. Download a fresh key from Google Cloud Console.

### "returned 401" (Unauthorized)

```
Error: Google OAuth2 token endpoint returned 401
```

**Solution:** Check that:
1. Your private key is valid
2. Your service account email is correct
3. The credentials haven't been revoked

### "returned 403" (Permission Denied)

```
Error: Google OAuth2 token endpoint returned 403
```

**Solution:** Your service account lacks permissions. Add required IAM roles in Google Cloud Console.

### "Network timeout"

```
Error: Failed to exchange JWT for access token: ...
```

**Solution:** Increase the timeout or retry with backoff:
```python
import time

for attempt in range(3):
    try:
        token = get_access_token_from_service_account(json_str)
        break
    except ValueError as e:
        if attempt < 2:
            time.sleep(2 ** attempt)
        else:
            raise
```

## Testing

### Run Tests

```bash
pytest tests/services/test_google_oauth2_jwt.py -v
```

### Write Tests

```python
from unittest.mock import patch
from src.services.google_oauth2_jwt import build_jwt_assertion

@patch("src.services.google_oauth2_jwt._sign_with_rsa_sha256")
def test_my_code(mock_sign):
    mock_sign.return_value = b"mock_signature"

    jwt = build_jwt_assertion(
        service_account_email="test@example.com",
        private_key="-----BEGIN RSA PRIVATE KEY-----\n...",
        scope="https://www.googleapis.com/auth/cloud-platform"
    )

    assert "." in jwt  # JWT has three parts
```

## Performance Tips

1. **Cache tokens**: They're valid for ~1 hour, reuse them!
   ```python
   from functools import lru_cache

   @lru_cache(maxsize=1)
   def get_token():
       return get_access_token_from_service_account(json_str)
   ```

2. **Use minimal scopes**: Only request what you need
   ```python
   # Good - just what you need
   scope="https://www.googleapis.com/auth/aiplatform"

   # Bad - everything
   scope="https://www.googleapis.com/auth/cloud-platform"
   ```

3. **Async wrapper**: For async code
   ```python
   import asyncio

   async def get_token_async():
       loop = asyncio.get_event_loop()
       return await loop.run_in_executor(
           None,
           get_access_token_from_service_account,
           json_str
       )
   ```

## Security Checklist

- ✓ Never log private keys
- ✓ Store credentials in environment variables, not code
- ✓ Use minimum required scopes
- ✓ Rotate service account keys periodically
- ✓ Don't commit JSON files to git (use `.gitignore`)

## Next Steps

1. Read the [full documentation](./GOOGLE_OAUTH2_JWT.md)
2. Check out [examples](../examples/google_oauth2_jwt_example.py)
3. Run the test suite to verify your setup
4. Integrate with your application

## Support

- **Documentation**: [GOOGLE_OAUTH2_JWT.md](./GOOGLE_OAUTH2_JWT.md)
- **Examples**: [google_oauth2_jwt_example.py](../examples/google_oauth2_jwt_example.py)
- **Tests**: [test_google_oauth2_jwt.py](../tests/services/test_google_oauth2_jwt.py)
- **Issue**: Create a GitHub issue if you encounter problems

---

**That's it!** You now have a lightweight, dependency-minimal way to get OAuth2 tokens for Google Cloud APIs. 🚀
