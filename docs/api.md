# API Reference

Base URL: `http://localhost:8000` (local) or your deployed URL

## Authentication
All protected endpoints require HTTP Bearer authentication:
```
Authorization: Bearer YOUR_API_KEY
```

## Public Endpoints

### Health Check
**GET** `/health`
- Returns system status, database connectivity, Gatewayz status, user count, and timestamp
- No authentication required

### Models
**GET** `/models`
- Returns available AI models from Gatewayz with pricing, capabilities, and provider information
- Cached for 5 minutes with automatic refresh
- No authentication required

**GET** `/models/providers`
- Returns provider statistics across all available models
- Includes model counts, suggested models, pricing availability, and official provider URLs
- Uses OpenRouter's official providers API for accurate site URLs and policy links
- **Includes provider logo URLs** using hybrid approach (manual mapping + Clearbit API)
- No authentication required

**GET** `/providers`
- Returns available providers directly from OpenRouter API
- Includes official provider information, privacy policies, terms of service, and status pages
- No authentication required

Example response for `/models/providers`:
```json
{
  "status": "success",
  "provider_statistics": {
    "total_providers": 15,
    "total_models": 324,
    "suggested_models": 12,
    "pricing_available": 324,
    "providers": {
      "openai": {
        "name": "OpenAI",
        "model_count": 12,
        "suggested_models": 5,
        "logo_url": "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/openai.svg",
        "site_url": "https://openai.com",
        "privacy_policy_url": "https://openai.com/policies/privacy-policy/",
        "terms_of_service_url": "https://openai.com/policies/row-terms-of-use/",
        "status_page_url": "https://status.openai.com/"
      },
      "anthropic": {
        "name": "Anthropic",
        "model_count": 8,
        "suggested_models": 2,
        "logo_url": "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/anthropic.svg",
        "site_url": "https://www.anthropic.com",
        "privacy_policy_url": "https://www.anthropic.com/privacy",
        "terms_of_service_url": "https://www.anthropic.com/terms",
        "status_page_url": "https://status.anthropic.com/"
      }
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Example response for `/providers`:
```json
{
  "status": "success",
  "total_providers": 25,
  "providers": [
    {
      "name": "OpenAI",
      "slug": "openai",
      "privacy_policy_url": "https://openai.com/policies/privacy-policy/",
      "terms_of_service_url": "https://openai.com/policies/row-terms-of-use/",
      "status_page_url": "https://status.openai.com/"
    },
    {
      "name": "Anthropic",
      "slug": "anthropic",
      "privacy_policy_url": "https://www.anthropic.com/privacy",
      "terms_of_service_url": "https://www.anthropic.com/terms",
      "status_page_url": "https://status.anthropic.com/"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Note**: Logo URLs are still not provided by OpenRouter API, but site URLs and policy links are now accurately sourced from OpenRouter's official providers API.

## User Endpoints

### Authentication & Registration
**POST** `/create`
- Create API key for user after dashboard login
- Automatically sends welcome email with account details
- Request body: `UserRegistrationRequest`
- Returns: `UserRegistrationResponse` with primary API key

**POST** `/auth/password-reset`
- Request password reset email with secure token
- Request body: `email` (string)
- Returns: Success message (doesn't reveal if email exists)

**POST** `/auth/reset-password`
- Reset password using secure token from email
- Request body: `token` (string), `new_password` (string)
- Returns: Success message

### User Management
**GET** `/user/balance`
- Get current user balance and account status
- Returns: masked API key, credits, user ID, status

**GET** `/user/monitor`
- Get comprehensive usage metrics and rate limits
- Returns: current credits, usage statistics, rate limit information

**GET** `/user/limit`
- Get current user rate limits and usage status
- Returns: current limits, usage status, reset times

### Profile Management
**GET** `/user/profile`
- Get user profile information
- Returns: `UserProfileResponse`

**PUT** `/user/profile`
- Update user profile information
- Request body: `UserProfileUpdate`
- Returns: `UserProfileResponse`

**DELETE** `/user/account`
- Delete user account and all associated data
- Request body: `DeleteAccountRequest` (confirmation required)
- Returns: `DeleteAccountResponse`

### API Key Management
**POST** `/user/api-keys`
- Create new API key with enhanced security features
- Request body: `CreateApiKeyRequest`
- Features: IP allowlist, domain restrictions, expiration, usage limits, audit logging
- Returns: new API key with security configuration

**GET** `/user/api-keys`
- List all API keys for authenticated user
- Returns: `ListApiKeysResponse` with security status for each key

**PUT** `/user/api-keys/{key_id}`
- Update or rotate existing API key
- Request body: `UpdateApiKeyRequest`
- Actions: update, rotate, bulk_rotate
- Returns: `UpdateApiKeyResponse`

**DELETE** `/user/api-keys/{key_id}`
- Delete specific API key
- Request body: `DeleteApiKeyRequest` (confirmation required)
- Returns: `DeleteApiKeyResponse`

**GET** `/user/api-keys/usage`
- Get usage statistics for all user API keys

### Notifications & Email
**POST** `/user/notifications/send-usage-report`
- Send monthly usage report email
- Request body: `month` (string, format: YYYY-MM)
- Returns: Success message

**POST** `/user/notifications/test`
- Test notification templates
- Request body: `notification_type` (query parameter)
- Available types: low_balance, trial_expiring, subscription_expiring
- Returns: Test notification sent confirmation

**GET** `/user/notifications/preferences`
- Get user notification preferences
- Returns: `NotificationPreferences` with email settings

**PUT** `/user/notifications/preferences`
- Update user notification preferences
- Request body: `UpdateNotificationPreferencesRequest`
- Returns: Updated preferences

**GET** `/user/api-keys/audit-logs`
- Get audit logs for security monitoring (Phase 4 feature)
- Query parameters: `key_id`, `action`, `start_date`, `end_date`, `limit`
- Returns: audit logs with security events

### Plan Management
**GET** `/plans`
- Get all available subscription plans
- Returns: `List[PlanResponse]`

**GET** `/plans/{plan_id}`
- Get specific plan by ID
- Returns: `PlanResponse`

**GET** `/user/plan`
- Get current user's active plan
- Returns: `UserPlanResponse`

**GET** `/user/plan/usage`
- Get user's plan usage and limits
- Returns: `PlanUsageResponse`

**GET** `/user/plan/entitlements`
- Check user's plan entitlements
- Query parameter: `feature` (optional)
- Returns: `PlanEntitlementsResponse`

**GET** `/user/environment-usage`
- Get user's usage breakdown by environment
- Returns: environment-specific usage statistics

## Admin Endpoints

### User Management
**POST** `/admin/add_credits`
- Add credits to existing user
- Request body: `AddCreditsRequest`
- Returns: success status and new balance

**GET** `/admin/balance`
- Get all user balances and API keys
- Returns: list of all users with their balances

**GET** `/admin/monitor`
- Get system-wide monitoring dashboard
- Returns: `AdminMonitorResponse` with comprehensive metrics

### Rate Limiting
**POST** `/admin/limit`
- Set rate limits for specific user
- Request body: `SetRateLimitRequest`
- Returns: updated rate limit configuration

### Plan Management
**POST** `/admin/assign-plan`
- Assign plan to user (Admin only)
- Request body: `AssignPlanRequest`
- Returns: assignment confirmation

### Notifications & Email
**GET** `/admin/notifications/stats`
- Get notification statistics and metrics
- Returns: `NotificationStats` with email delivery statistics

### Cache Management
**POST** `/admin/refresh-models`
- Force refresh model cache
- Returns: cache refresh status

**GET** `/admin/cache-status`
- Get model cache status information
- Returns: cache statistics and health

## Chat Completions

### OpenAI-Compatible Proxy
**POST** `/v1/chat/completions`
- OpenAI-compatible endpoint proxied to Gatewayz
- Request body: `ProxyRequest`
- Features: credit deduction, rate limiting, plan enforcement, usage tracking
- Returns: OpenAI-compatible response with gateway usage information

Example:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-r1-0528",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Invalid, inactive, or expired API key |
| 402 | Payment Required - Insufficient credits |
| 403 | Forbidden - IP/domain restrictions or insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit or plan limit exceeded |
| 500 | Internal Server Error - Server-side error |
| 503 | Service Unavailable - Gatewayz service unavailable |

## Security Features

### Phase 4 Security Enhancements
- **IP Allowlist**: Restrict API key usage to specific IP addresses
- **Domain Restrictions**: Limit API key usage to specific domains
- **Key Rotation**: Rotate API keys with new credentials
- **Bulk Operations**: Rotate multiple keys simultaneously
- **Audit Logging**: Comprehensive security event tracking
- **Usage Monitoring**: Real-time usage tracking and analytics
- **Plan Enforcement**: Automatic plan limit enforcement
- **Enhanced Validation**: Multi-layer API key validation

### API Key Formats
- **Live**: `gw_live_*`
- **Test**: `gw_test_*`
- **Staging**: `gw_staging_*`
- **Development**: `gw_dev_*`

## Rate Limiting

The API implements comprehensive rate limiting:
- **Per-minute limits**: Requests and tokens per minute
- **Per-hour limits**: Requests and tokens per hour  
- **Per-day limits**: Requests and tokens per day
- **Plan-based limits**: Subscription plan enforcement
- **Key-specific limits**: Individual API key restrictions

## Usage Tracking

All API usage is tracked with:
- Token consumption per request
- Cost calculation and credit deduction
- Model-specific usage statistics
- Environment-based usage breakdown
- Real-time monitoring and analytics

