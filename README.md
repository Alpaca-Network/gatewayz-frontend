# OpenRouter AI Gateway with Supabase

A production-ready FastAPI application that provides a credit-metered API gateway for OpenRouter. Users authenticate with generated API keys and usage is metered based on token counts. The application uses Supabase as the database backend and provides access to hundreds of AI models through OpenRouter.

## 🚀 Features

- **Multi-Model Support**: Access to hundreds of AI models via OpenRouter
- **User Management**: Generate and manage API keys with credit tracking
- **Credit System**: Token-based credit deduction with real-time balance checking
- **Real-time Rate Limiting**: Configurable rate limits per user with minute/hour/day windows
- **Comprehensive Monitoring**: Usage analytics and metrics for both users and admins
- **Production Ready**: Clean, optimized codebase with minimal logging
- **Interactive Documentation**: Swagger UI and ReDoc for easy API exploration
- **Scalable**: Built with FastAPI for high-performance async operations

## 📋 Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **OpenRouter API Key**: Get your API key from [openrouter.ai](https://openrouter.ai)

## 🛠️ Setup Instructions

### 1. Supabase Database Setup

1. Create a new project in Supabase
2. Go to the SQL Editor and run the following SQL to create the required tables:

```sql
-- Run the complete database schema from database_schema.sql
-- This includes users, usage_records, rate_limits, rate_limit_usage, and system_settings tables
```

3. Get your Supabase URL and API key from the project settings

### 2. Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_SITE_URL=https://your-site.com  # Optional
OPENROUTER_SITE_NAME=Your Site Name        # Optional
```

### 3. Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## 📊 API Endpoints

### Public Endpoints (No Authentication)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with system status |
| `/models/simple` | GET | Get available AI models |
| `/` | GET | API information and endpoints |

### Admin Endpoints (No Authentication)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/create_user` | POST | Create new user with API key |
| `/admin/add_credits` | POST | Add credits to existing user |
| `/admin/balance` | GET | Get all user balances and API keys |
| `/admin/monitor` | GET | System-wide monitoring dashboard |
| `/admin/limit` | POST | Set rate limits for users |

### Protected Endpoints (Authentication Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/user/balance` | GET | Get current user balance |
| `/user/monitor` | GET | User-specific usage metrics |
| `/user/limit` | GET | Get current user rate limits |
| `/v1/chat/completions` | POST | Chat completion with OpenRouter |

## 🔐 Authentication

All protected endpoints require a Bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     http://localhost:8000/user/balance
```

## 📈 Monitoring & Analytics

### User Monitoring (`/user/monitor`)

Provides detailed usage metrics for individual users:

```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "user_id": 123,
  "api_key": "mdlz_sk_abc...",
  "current_credits": 850,
  "usage_metrics": {
    "total_requests": 150,
    "total_tokens": 15000,
    "total_cost": 0.30,
    "requests_today": 5,
    "tokens_today": 500,
    "cost_today": 0.01,
    "requests_this_month": 45,
    "tokens_this_month": 4500,
    "cost_this_month": 0.09,
    "average_tokens_per_request": 100.0,
    "most_used_model": "deepseek/deepseek-r1-0528",
    "last_request_time": "2024-01-15T10:25:00Z"
  },
  "rate_limits": {
    "requests_per_minute": 60,
    "requests_per_hour": 1000,
    "requests_per_day": 10000,
    "tokens_per_minute": 10000,
    "tokens_per_hour": 100000,
    "tokens_per_day": 1000000
  }
}
```

### Admin Monitoring (`/admin/monitor`)

Provides system-wide analytics and insights:

```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "total_users": 50,
    "active_users_today": 12,
    "total_requests_today": 150,
    "total_tokens_today": 15000,
    "total_cost_today": 0.30,
    "top_users_by_usage": [
      {
        "api_key": "mdlz_sk_abc...",
        "tokens_used": 5000,
        "cost": 0.10,
        "requests": 25
      }
    ],
    "recent_activity": [
      {
        "api_key": "mdlz_sk_xyz...",
        "model": "deepseek/deepseek-r1-0528",
        "tokens_used": 150,
        "timestamp": "2024-01-15T10:25:00Z"
      }
    ]
  }
}
```

## ⚡ Rate Limiting

### Rate Limit Configuration

Rate limits can be set per user with the following windows:
- **Minute**: Requests and tokens per minute
- **Hour**: Requests and tokens per hour  
- **Day**: Requests and tokens per day

### Setting Rate Limits (Admin)

```bash
curl -X POST http://localhost:8000/admin/limit \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "mdlz_sk_user123",
    "rate_limits": {
      "requests_per_minute": 60,
      "requests_per_hour": 1000,
      "requests_per_day": 10000,
      "tokens_per_minute": 10000,
      "tokens_per_hour": 100000,
      "tokens_per_day": 1000000
    }
  }'
```

### Checking Rate Limits (User)

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     http://localhost:8000/user/limit
```

Response:
```json
{
  "status": "success",
  "api_key": "mdlz_sk_abc...",
  "current_limits": {
    "requests_per_minute": 60,
    "requests_per_hour": 1000,
    "requests_per_day": 10000,
    "tokens_per_minute": 10000,
    "tokens_per_hour": 100000,
    "tokens_per_day": 1000000
  },
  "current_usage": {
    "allowed": true,
    "reason": "Within limits"
  },
  "reset_times": {
    "minute": "2024-01-15T10:31:00Z",
    "hour": "2024-01-15T11:00:00Z",
    "day": "2024-01-16T00:00:00Z"
  }
}
```

## 💬 Chat Completions

### Pricing

The gateway uses a token-based pricing model:
- **1M tokens = $20**
- **1K tokens = $0.02**
- **1 token = $0.00002**

Costs are calculated based on the total tokens used in each request (prompt + completion tokens).

### Example Request

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-r1-0528",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

### Example Response

```json
{
  "choices": [
    {
      "message": {
        "content": "Hello! I'm doing well, thank you for asking. How can I help you today?"
      }
    }
  ],
  "usage": {
    "total_tokens": 25,
    "prompt_tokens": 8,
    "completion_tokens": 17
  },
  "model": "deepseek/deepseek-r1-0528",
  "gateway_usage": {
    "tokens_charged": 25,
    "user_balance_after": 975,
    "user_api_key": "mdlz_sk_abc..."
  }
}
```

**Note**: The `tokens_charged` represents the total tokens used (25 tokens = $0.0005 at the current rate of $0.02 per 1K tokens).

## 🗄️ Database Schema

The application uses the following tables:

- **users**: User accounts with API keys and credits
- **usage_records**: Detailed usage tracking for analytics
- **rate_limits**: User-specific rate limit configurations
- **rate_limit_usage**: Real-time rate limit tracking
- **system_settings**: Global system configuration

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for various platforms including Vercel, Railway, Heroku, DigitalOcean, and AWS Lambda.

## 🔒 Security Features

- **API Key Authentication**: Secure Bearer token authentication
- **Rate Limiting**: Configurable per-user rate limits
- **Credit Validation**: Prevents usage beyond available credits
- **Input Validation**: Comprehensive request validation with Pydantic
- **Error Handling**: Secure error responses without information leakage
- **CORS Protection**: Configurable cross-origin request handling

## 📊 Error Handling

The API returns appropriate HTTP status codes:

- **200**: Success
- **400**: Bad Request (invalid input)
- **401**: Unauthorized (invalid API key)
- **402**: Payment Required (insufficient credits)
- **422**: Unprocessable Entity (missing Authorization header)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error
- **503**: Service Unavailable (OpenRouter issues)

## 🎯 Use Cases

- **SaaS Applications**: Provide AI capabilities to users with usage tracking
- **API Marketplaces**: Meter and charge for AI model access
- **Internal Tools**: Manage AI usage across organization
- **Development Platforms**: Offer AI services with credit management

## 📚 Documentation

- **Interactive API Docs**: Visit `/docs` for Swagger UI
- **ReDoc Documentation**: Visit `/redoc` for alternative documentation
- **OpenAPI Spec**: Available at `/openapi.json`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
