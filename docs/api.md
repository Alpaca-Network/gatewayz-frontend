# API Reference

## Base URL

```
https://your-domain.com
```

## Authentication

All API endpoints (except public ones) require authentication using an API key in the Authorization header:

```http
Authorization: Bearer gw_live_your_api_key_here
```

### API Key Types

- **Live Keys**: `gw_live_*` - Production environment
- **Test Keys**: `gw_test_*` - Testing environment  
- **Staging Keys**: `gw_staging_*` - Staging environment
- **Development Keys**: `gw_dev_*` - Development environment

## Public Endpoints

### Health Check

```http
GET /health
```

Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "2.0.1"
}
```

### Ping Service

```http
GET /ping
```

Returns ping statistics and system information.

**Response:**
```json
{
  "status": "pong",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "version": "2.0.1"
}
```

### Get Available Models

```http
GET /models
```

Returns list of available AI models.

**Query Parameters:**
- `provider` (optional): Filter by provider (openrouter, portkey, featherless, chutes)
- `limit` (optional): Limit number of results
- `offset` (optional): Offset for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "openai/gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "context_length": 8192,
      "pricing": {
        "prompt": 0.00003,
        "completion": 0.00006
      }
    }
  ],
  "count": 1
}
```

### Get Model Providers

```http
GET /models/providers
```

Returns provider statistics and information.

**Query Parameters:**
- `moderated_only` (optional): Filter for moderated providers only
- `limit` (optional): Limit number of results
- `offset` (optional): Offset for pagination
- `gateway` (optional): Gateway to use (openrouter, portkey, featherless, chutes, all)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "OpenAI",
      "slug": "openai",
      "description": "OpenAI models",
      "model_count": 10,
      "official_url": "https://openai.com"
    }
  ],
  "count": 1
}
```

### Get Model Rankings

```http
GET /ranking/models
```

Returns ranked list of models for the ranking page.

**Query Parameters:**
- `limit` (optional): Limit number of results
- `offset` (optional): Offset for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "model_name": "GPT-4",
      "author": "openai",
      "logo_url": "https://www.google.com/s2/favicons?domain=openai.com&sz=128",
      "tokens": "8.2B tokens",
      "trend_percentage": "5%",
      "trend_direction": "up"
    }
  ],
  "count": 1,
  "has_logo_urls": true
}
```

## Authentication Endpoints

### Privy Authentication

```http
POST /auth/privy
```

Authenticate using Privy authentication.

**Request Body:**
```json
{
  "token": "privy_token_here",
  "auth_method": "google"
}
```

**Response:**
```json
{
  "success": true,
  "user_id": "123",
  "username": "user@example.com",
  "email": "user@example.com",
  "api_key": "gw_live_...",
  "credits": 10.0,
  "subscription_status": "trial"
}
```

### Get User Balance

```http
GET /user/balance
```

Get user's current credit balance and status.

**Response:**
```json
{
  "api_key": "gw_live_...",
  "credits": 10.0,
  "status": "active",
  "user_id": 123
}
```

## API Key Management

### Create API Key

```http
POST /user/api-keys
```

Create a new API key for the user.

**Request Body:**
```json
{
  "key_name": "My API Key",
  "environment_tag": "live",
  "scope_permissions": {
    "read": ["*"],
    "write": ["*"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "api_key": "gw_live_...",
  "key_name": "My API Key",
  "environment_tag": "live",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### List API Keys

```http
GET /user/api-keys
```

Get all API keys for the current user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "key_name": "My API Key",
      "api_key": "gw_live_...",
      "environment_tag": "live",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### Update API Key

```http
PUT /user/api-keys/{key_id}
```

Update an existing API key.

**Request Body:**
```json
{
  "key_name": "Updated Key Name",
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key updated successfully"
}
```

### Delete API Key

```http
DELETE /user/api-keys/{key_id}
```

Delete an API key.

**Response:**
```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

## Chat Endpoints

### Chat Completions

```http
POST /v1/chat/completions
```

OpenAI-compatible chat completions endpoint.

**Request Body:**
```json
{
  "model": "openai/gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "Hello, world!"
    }
  ],
  "max_tokens": 100,
  "temperature": 0.7
}
```

**Query Parameters:**
- `session_id` (optional): Chat session ID to save messages to

**Response:**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "openai/gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### Unified Responses

```http
POST /v1/responses
```

Unified response API endpoint (OpenAI v1/responses compatible).

**Request Body:**
```json
{
  "model": "openai/gpt-4",
  "input": "Hello, world!",
  "max_tokens": 100,
  "temperature": 0.7,
  "response_format": {
    "type": "json_object"
  }
}
```

**Response:**
```json
{
  "id": "resp-123",
  "object": "response",
  "created": 1677652288,
  "model": "openai/gpt-4",
  "output": "Hello! How can I help you today?",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### Image Generation

```http
POST /images/generate
```

Generate images using AI models.

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over mountains",
  "model": "stability-ai/stable-diffusion-xl",
  "size": "1024x1024",
  "quality": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "url": "https://example.com/generated-image.jpg",
      "revised_prompt": "A beautiful sunset over mountains with dramatic lighting"
    }
  ]
}
```

## Chat History Management

### Create Chat Session

```http
POST /chat/sessions
```

Create a new chat session.

**Request Body:**
```json
{
  "name": "My Chat Session",
  "description": "Discussion about AI"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": 123,
  "name": "My Chat Session",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### List Chat Sessions

```http
GET /chat/sessions
```

Get all chat sessions for the current user.

**Query Parameters:**
- `limit` (optional): Limit number of results
- `offset` (optional): Offset for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "My Chat Session",
      "message_count": 10,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### Get Chat Session

```http
GET /chat/sessions/{session_id}
```

Get a specific chat session with messages.

**Response:**
```json
{
  "success": true,
  "session": {
    "id": 123,
    "name": "My Chat Session",
    "messages": [
      {
        "id": 1,
        "role": "user",
        "content": "Hello!",
        "created_at": "2024-01-01T00:00:00Z"
      },
      {
        "id": 2,
        "role": "assistant",
        "content": "Hi there!",
        "created_at": "2024-01-01T00:00:01Z"
      }
    ]
  }
}
```

### Delete Chat Session

```http
DELETE /chat/sessions/{session_id}
```

Delete a chat session.

**Response:**
```json
{
  "success": true,
  "message": "Chat session deleted successfully"
}
```

## Subscription Plans

### Get All Plans

```http
GET /plans
```

Get all available subscription plans.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "plan_name": "Free",
      "plan_type": "free",
      "description": "Free tier with limited usage",
      "monthly_price": 0.0,
      "daily_request_limit": 100,
      "monthly_request_limit": 1000,
      "features": ["Basic chat", "Limited models"]
    }
  ],
  "count": 1
}
```

### Get Plan Details

```http
GET /plans/{plan_id}
```

Get details for a specific plan.

**Response:**
```json
{
  "success": true,
  "plan": {
    "id": 1,
    "plan_name": "Pro",
    "plan_type": "subscription",
    "description": "Professional plan",
    "monthly_price": 29.99,
    "daily_request_limit": 10000,
    "monthly_request_limit": 100000,
    "features": ["All models", "Priority support", "Advanced analytics"]
  }
}
```

### Get User Plan

```http
GET /user/plan
```

Get the current user's subscription plan.

**Response:**
```json
{
  "success": true,
  "plan": {
    "id": 1,
    "plan_name": "Pro",
    "status": "active",
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-02-01T00:00:00Z"
  }
}
```

## Free Trials

### Start Trial

```http
POST /trials/start
```

Start a free trial for the user.

**Request Body:**
```json
{
  "trial_type": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "trial_id": 123,
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-04T00:00:00Z",
  "credits": 10.0,
  "max_requests": 1000
}
```

### Get Trial Status

```http
GET /trials/status
```

Get the current user's trial status.

**Response:**
```json
{
  "success": true,
  "trial": {
    "is_active": true,
    "remaining_credits": 8.5,
    "remaining_requests": 750,
    "end_date": "2024-01-04T00:00:00Z"
  }
}
```

### Convert Trial

```http
POST /trials/convert
```

Convert a trial to a paid subscription.

**Request Body:**
```json
{
  "plan_id": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trial converted successfully",
  "new_plan": "Pro"
}
```

## Payment Processing

### Create Checkout Session

```http
POST /api/stripe/checkout
```

Create a Stripe checkout session for credit purchase.

**Request Body:**
```json
{
  "amount": 50.00,
  "currency": "usd",
  "success_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_123"
}
```

### Create Payment Intent

```http
POST /api/stripe/payment-intent
```

Create a Stripe payment intent.

**Request Body:**
```json
{
  "amount": 50.00,
  "currency": "usd"
}
```

**Response:**
```json
{
  "success": true,
  "client_secret": "pi_123_secret_...",
  "payment_intent_id": "pi_123"
}
```

## Admin Endpoints

### Create User Account

```http
POST /admin/create
```

Create a new user account (admin only).

**Request Body:**
```json
{
  "username": "newuser@example.com",
  "email": "newuser@example.com",
  "auth_method": "email",
  "environment_tag": "live"
}
```

**Response:**
```json
{
  "success": true,
  "user_id": 123,
  "username": "newuser@example.com",
  "api_key": "gw_live_...",
  "credits": 10.0
}
```

### System Monitoring

```http
GET /admin/monitor
```

Get system monitoring data (admin only).

**Response:**
```json
{
  "success": true,
  "system": {
    "status": "healthy",
    "uptime": 3600,
    "active_users": 150,
    "total_requests": 10000
  },
  "database": {
    "status": "connected",
    "response_time": 5
  }
}
```

### Add Credits

```http
POST /admin/add_credits
```

Add credits to a user account (admin only).

**Request Body:**
```json
{
  "user_id": 123,
  "credits": 50.0,
  "reason": "Support credit"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credits added successfully",
  "new_balance": 60.0
}
```

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "detail": "Error message",
  "status_code": 400,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common Error Codes

- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Invalid or missing API key
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Rate Limiting

Rate limits are applied per API key:

- **Free Plan**: 100 requests/hour
- **Pro Plan**: 10,000 requests/hour
- **Enterprise Plan**: 100,000 requests/hour

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Stripe Webhook

```http
POST /api/stripe/webhook
```

Handles Stripe webhook events for payment processing.

**Headers:**
```http
Stripe-Signature: t=1234567890,v1=...
Content-Type: application/json
```

**Supported Events:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

## SDKs and Libraries

### Python

```python
import requests

# Set your API key
headers = {
    "Authorization": "Bearer gw_live_your_api_key_here",
    "Content-Type": "application/json"
}

# Make a chat completion request
response = requests.post(
    "https://your-domain.com/v1/chat/completions",
    headers=headers,
    json={
        "model": "openai/gpt-4",
        "messages": [{"role": "user", "content": "Hello!"}]
    }
)

print(response.json())
```

### JavaScript

```javascript
const response = await fetch('https://your-domain.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gw_live_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'openai/gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const data = await response.json();
console.log(data);
```

### cURL

```bash
curl -X POST "https://your-domain.com/v1/chat/completions" \
  -H "Authorization: Bearer gw_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Referral System

### Get Referral Code

```http
GET /referrals/code
```

Get user's referral code and statistics.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "referral_code": "ABC123",
  "total_referrals": 5,
  "total_rewards": 50.0,
  "pending_rewards": 10.0
}
```

### Apply Referral Code

```http
POST /referrals/apply
```

Apply a referral code for a new user.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "referral_code": "ABC123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Referral code applied successfully",
  "reward_amount": 10.0,
  "credits_added": 10.0
}
```

### Get Referral Statistics

```http
GET /referrals/stats
```

Get detailed referral statistics.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "total_referrals": 5,
  "active_referrals": 3,
  "total_rewards": 50.0,
  "pending_rewards": 10.0,
  "conversion_rate": 0.6,
  "recent_referrals": [
    {
      "id": "ref_123",
      "referred_email": "user@example.com",
      "status": "completed",
      "reward_amount": 10.0,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Referral History

```http
GET /referrals/history
```

Get complete referral history.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
```

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (pending, completed, paid)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ref_123",
      "referral_code": "ABC123",
      "referred_user_id": "user_456",
      "status": "completed",
      "reward_amount": 10.0,
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-02T00:00:00Z"
    }
  ],
  "total": 5,
  "limit": 50,
  "offset": 0
}
```

## Coupon System

### Create Coupon (Admin)

```http
POST /coupons
```

Create a new coupon code.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "WELCOME10",
  "discount_type": "percentage",
  "discount_value": 10,
  "max_uses": 100,
  "valid_from": "2024-01-01T00:00:00Z",
  "valid_to": "2024-12-31T23:59:59Z",
  "description": "Welcome discount for new users"
}
```

**Response:**
```json
{
  "success": true,
  "coupon": {
    "id": "coupon_123",
    "code": "WELCOME10",
    "discount_type": "percentage",
    "discount_value": 10,
    "max_uses": 100,
    "uses_count": 0,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### List Coupons (Admin)

```http
GET /coupons
```

List all coupons.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
```

**Query Parameters:**
- `is_active` (optional): Filter by active status
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "coupon_123",
      "code": "WELCOME10",
      "discount_type": "percentage",
      "discount_value": 10,
      "max_uses": 100,
      "uses_count": 25,
      "is_active": true,
      "valid_from": "2024-01-01T00:00:00Z",
      "valid_to": "2024-12-31T23:59:59Z"
    }
  ],
  "total": 10
}
```

### Apply Coupon

```http
POST /coupons/apply
```

Apply a coupon code to user's account.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "WELCOME10"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon applied successfully",
  "discount_amount": 10.0,
  "credits_added": 10.0,
  "new_balance": 20.0
}
```

### Get Coupon Details

```http
GET /coupons/{code}
```

Get details for a specific coupon.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "coupon": {
    "code": "WELCOME10",
    "discount_type": "percentage",
    "discount_value": 10,
    "is_active": true,
    "valid_from": "2024-01-01T00:00:00Z",
    "valid_to": "2024-12-31T23:59:59Z",
    "description": "Welcome discount for new users"
  }
}
```

## Role Management (Admin)

### Get User Role

```http
GET /roles/{user_id}
```

Get role information for a specific user.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
```

**Response:**
```json
{
  "success": true,
  "user_id": "user_123",
  "role": "user",
  "permissions": ["api:read", "api:write"],
  "assigned_at": "2024-01-01T00:00:00Z"
}
```

### Update User Role

```http
PUT /roles/{user_id}
```

Update user's role.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "role": "admin",
  "reason": "Promoted to admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role updated successfully",
  "user_id": "user_123",
  "old_role": "user",
  "new_role": "admin",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### List User Roles

```http
GET /roles
```

List all users and their roles.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
```

**Query Parameters:**
- `role` (optional): Filter by role
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "user_123",
      "email": "user@example.com",
      "role": "admin",
      "assigned_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50
}
```

## Activity Tracking

### Log Activity

```http
POST /activity/log
```

Log a user activity event.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "event_type": "api_call",
  "event_data": {
    "model": "openai/gpt-4",
    "tokens": 100,
    "cost": 0.01
  },
  "metadata": {
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "activity_id": "activity_123",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Get Activity History

```http
GET /activity/history
```

Get user's activity history.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
```

**Query Parameters:**
- `event_type` (optional): Filter by event type
- `start_date` (optional): Start date (ISO 8601)
- `end_date` (optional): End date (ISO 8601)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "activity_123",
      "event_type": "api_call",
      "event_data": {
        "model": "openai/gpt-4",
        "tokens": 100,
        "cost": 0.01
      },
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Get Activity Statistics

```http
GET /activity/stats
```

Get aggregated activity statistics.

**Headers:**
```http
Authorization: Bearer gw_live_your_api_key_here
```

**Query Parameters:**
- `start_date` (optional): Start date (ISO 8601)
- `end_date` (optional): End date (ISO 8601)
- `group_by` (optional): Group by (day, week, month)

**Response:**
```json
{
  "success": true,
  "statistics": {
    "total_requests": 1000,
    "total_tokens": 50000,
    "total_cost": 5.0,
    "average_tokens_per_request": 50,
    "by_model": {
      "openai/gpt-4": 500,
      "openai/gpt-3.5-turbo": 500
    },
    "by_day": [
      {
        "date": "2024-01-01",
        "requests": 100,
        "tokens": 5000,
        "cost": 0.5
      }
    ]
  }
}
```

## Transaction Analytics (Admin)

### Get Transaction Analytics

```http
GET /admin/transaction-analytics
```

Get comprehensive transaction analytics.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
```

**Query Parameters:**
- `start_date` (optional): Start date (ISO 8601)
- `end_date` (optional): End date (ISO 8601)
- `user_id` (optional): Filter by user
- `model` (optional): Filter by model
- `provider` (optional): Filter by provider

**Response:**
```json
{
  "success": true,
  "analytics": {
    "total_transactions": 10000,
    "total_revenue": 5000.0,
    "total_credits_used": 50000,
    "average_transaction_value": 0.5,
    "by_model": {
      "openai/gpt-4": {
        "count": 5000,
        "revenue": 2500.0,
        "credits": 25000
      }
    },
    "by_provider": {
      "openrouter": {
        "count": 7000,
        "revenue": 3500.0
      }
    },
    "by_user_tier": {
      "free": {
        "count": 3000,
        "revenue": 0
      },
      "pro": {
        "count": 5000,
        "revenue": 3000.0
      }
    },
    "time_series": [
      {
        "date": "2024-01-01",
        "transactions": 100,
        "revenue": 50.0
      }
    ]
  }
}
```

## Rate Limit Management (Admin)

### Get Rate Limits

```http
GET /admin/rate-limits/{user_id}
```

Get rate limit configuration for a user.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
```

**Response:**
```json
{
  "success": true,
  "user_id": "user_123",
  "rate_limits": {
    "requests_per_minute": 100,
    "requests_per_hour": 5000,
    "requests_per_day": 100000,
    "custom_limits": {
      "chat_completions": 50,
      "image_generation": 10
    }
  },
  "current_usage": {
    "requests_this_minute": 10,
    "requests_this_hour": 500,
    "requests_this_day": 5000
  }
}
```

### Set Rate Limits

```http
POST /admin/rate-limits
```

Set custom rate limits for a user.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "user_123",
  "requests_per_minute": 100,
  "requests_per_hour": 5000,
  "requests_per_day": 100000,
  "reason": "Premium customer"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rate limits updated successfully",
  "user_id": "user_123",
  "rate_limits": {
    "requests_per_minute": 100,
    "requests_per_hour": 5000,
    "requests_per_day": 100000
  }
}
```

## Audit Logs (Admin)

### Get Audit Logs

```http
GET /admin/audit-logs
```

Get system audit logs.

**Headers:**
```http
Authorization: Bearer admin_api_key_here
```

**Query Parameters:**
- `user_id` (optional): Filter by user
- `action` (optional): Filter by action type
- `resource_type` (optional): Filter by resource type
- `start_date` (optional): Start date
- `end_date` (optional): End date
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_123",
      "user_id": "user_123",
      "action": "api_key_created",
      "resource_type": "api_key",
      "resource_id": "key_456",
      "details": {
        "key_name": "Production Key",
        "scopes": ["api:read", "api:write"]
      },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1000,
  "limit": 100,
  "offset": 0
}
```

---

## Best Practices

### API Key Security
- Never expose API keys in client-side code
- Use environment variables for API keys
- Rotate keys regularly
- Use the minimum required permissions
- Monitor key usage for anomalies

### Rate Limiting
- Implement exponential backoff for rate limit errors
- Monitor rate limit headers in responses
- Cache responses when appropriate
- Use bulk operations when available

### Error Handling
- Always check response status codes
- Implement retry logic for transient errors
- Log errors for debugging
- Provide meaningful error messages to users

### Performance
- Use streaming for long responses
- Implement proper pagination
- Cache frequently accessed data
- Use compression for large payloads

---

## Support

For API support:
- **Documentation**: [Full Documentation](README.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/api-gateway-vercel/issues)
- **Email**: support@yourdomain.com

---

**API Version**: 2.0.1  
**Last Updated**: October 2025