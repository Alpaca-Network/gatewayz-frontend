# API Reference

Base URL: http://localhost:8000

Auth
- Use HTTP Bearer: Authorization: Bearer YOUR_API_KEY

## Public
GET /health
- Returns status, db/openrouter status, user_count, timestamp

GET /models
- Returns catalog from OpenRouter

GET /models/providers
- Provider statistics across models

## User
GET /user/balance
- Requires API key
- Returns masked api_key, credits, user_id

GET /user/monitor
- Current credits and usage metrics

GET /user/profile
PATCH /user/profile
- Fetch and update profile fields

DELETE /user/account
- Delete account and data (requires confirmation)

## API Keys
POST /user/api-keys
- Create key (supports env tag, scopes, expiration, limits, allowlists)

GET /user/api-keys
- List keys

PATCH /user/api-keys/{key_id}
- Update key properties and limits

DELETE /user/api-keys/{key_id}
- Delete key

GET /user/api-keys/{key_id}/usage
- Key-specific usage stats

## Admin
POST /admin/create_user
- Create enhanced user

POST /admin/add_credits
- Add credits to a user

GET /admin/balance
- All user balances

GET /admin/monitor
- System-wide usage metrics

POST /admin/rate_limit
- Set rate limits for a user/key

POST /admin/refresh_models
- Refresh model cache

GET /admin/cache_status
- Get model cache status

## Plans
GET /plans
GET /plans/{plan_id}
GET /user/plan
GET /user/plan/usage
GET /user/plan/entitlements
POST /admin/assign_plan
- Assign plan to a user

## Proxy
POST /v1/chat/completions
- OpenAI-compatible endpoint proxied to OpenRouter
- Example:
```
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-r1-0528",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Common errors
401 Invalid or inactive API key
403 IP/domain restrictions
429 Rate/usage limits reached
500 Internal server error
