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
- Includes model counts, suggested models, and pricing availability
- No authentication required

## User Endpoints

### Authentication & Registration
**POST** `/auth/register`
- Register a new user with unified API key system
- Request body: `UserRegistrationRequest`
- Returns: `UserRegistrationResponse` with primary API key

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
- Returns: `ApiKeyUsageResponse` with audit logging information

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
