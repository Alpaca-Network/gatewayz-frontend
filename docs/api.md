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