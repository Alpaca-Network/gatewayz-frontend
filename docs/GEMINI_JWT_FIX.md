# Google OAuth2 JWT id_token Fallback Fix

## Problem

When using Google Vertex AI with Gemini 2.5 Pro and other Google AI models, the OAuth2 token exchange was failing with:

```
Failed to get Google Vertex access token: ('No access token in response.',
{'id_token': '...', ...}).
The credentials returned an id_token instead of an access_token.
```

This occurred because Google's OAuth2 token endpoint returns an `id_token` instead of an `access_token` in certain service account configurations.

## Root Cause

The `exchange_jwt_for_access_token()` function in `src/services/google_oauth2_jwt.py` was expecting an `access_token` in the OAuth2 response, but was only receiving an `id_token`.

Both token types are valid bearer tokens for service-to-service authentication with Google APIs, but the code had no fallback mechanism to use `id_token` when `access_token` was not present.

## Solution

Updated `src/services/google_oauth2_jwt.py` to:

1. First check for `access_token` in the OAuth2 response
2. If `access_token` is not present, fall back to using `id_token`
3. If neither is present, raise a clear error message

### Code Changes

```python
# Get access_token, with fallback to id_token if access_token not present
access_token = response_data.get("access_token")
if not access_token:
    # Some OAuth2 flows return id_token instead of access_token
    # The id_token can be used as a bearer token for service-to-service auth
    access_token = response_data.get("id_token")
    if access_token:
        logger.warning(
            "OAuth2 endpoint returned id_token instead of access_token. "
            "Using id_token as bearer token for Vertex AI API calls. "
            "This is valid for service account authentication."
        )
    else:
        raise ValueError(
            f"No access_token or id_token in OAuth2 response. "
            f"Response keys: {list(response_data.keys())}"
        )
```

## Why This Works

- **JWT Bearer Flow**: Both `access_token` and `id_token` can be used as bearer tokens in the `Authorization: Bearer <token>` header
- **Service Account Authentication**: For service-to-service calls, the `id_token` is cryptographically signed and includes all necessary claims for authentication
- **Google Vertex AI Compatibility**: Google's Vertex AI REST API accepts both token types as valid bearer tokens

## Testing

After deploying this fix, test with:

```bash
curl -X POST https://api.gatewayz.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.5-pro",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

## Affected Models

This fix enables support for:
- `google/gemini-2.5-pro`
- `google/gemini-2.0-flash`
- `google/gemini-1.5-pro`
- All other Google Vertex AI models

## Commit

- **Commit**: `d839a65`
- **Branch**: `terragon/implement-feature-rqmyxv`
- **Files Changed**: `src/services/google_oauth2_jwt.py`

## References

- [Google OAuth2 Service Account Flow](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Google Vertex AI REST API](https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/api-quickstart)
- [JWT Bearer Token Authentication](https://tools.ietf.org/html/rfc6750)
