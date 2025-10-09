# Architecture

## System Overview

The AI Gateway is a production-ready FastAPI application that provides a unified interface for accessing multiple AI models through various providers (OpenRouter, Portkey, Featherless, Chutes), with comprehensive credit management, rate limiting, and security features.

## Project Structure

The project follows a modular architecture with clear separation of concerns:

```
src/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration management
├── models.py              # Legacy models (being phased out)
├── supabase_config.py     # Database configuration
├── db_security.py         # Security utilities
├── enhanced_notification_service.py  # Email service
├── db/                    # Database layer
│   ├── __init__.py
│   ├── api_keys.py        # API key management
│   ├── users.py           # User management
│   ├── plans.py           # Subscription plans
│   ├── payments.py        # Payment processing
│   ├── ranking.py         # Model ranking system
│   ├── rate_limits.py     # Rate limiting
│   ├── trials.py          # Free trial management
│   ├── chat_history.py    # Chat session management
│   ├── coupons.py         # Coupon system
│   ├── roles.py           # Role-based access control
│   ├── activity.py        # Activity tracking
│   ├── credit_transactions.py  # Credit management
│   └── referral.py        # Referral system
├── routes/                # API endpoints
│   ├── __init__.py
│   ├── health.py          # Health checks
│   ├── ping.py            # Ping service
│   ├── chat.py            # Chat completions
│   ├── catalog.py         # Model catalog
│   ├── auth.py            # Authentication
│   ├── users.py           # User management
│   ├── api_keys.py        # API key management
│   ├── admin.py           # Admin operations
│   ├── plans.py           # Subscription plans
│   ├── payments.py        # Payment processing
│   ├── ranking.py         # Model ranking
│   ├── notifications.py   # Notifications
│   ├── chat_history.py    # Chat history
│   ├── images.py          # Image generation
│   ├── coupons.py         # Coupon management
│   ├── roles.py           # Role management
│   ├── activity.py        # Activity tracking
│   ├── audit.py           # Audit logs
│   └── referral.py        # Referral system
├── schemas/               # Pydantic models
│   ├── __init__.py
│   ├── common.py          # Common enums and types
│   ├── auth.py            # Authentication models
│   ├── users.py           # User models
│   ├── api_keys.py        # API key models
│   ├── plans.py           # Plan models
│   ├── payments.py        # Payment models
│   ├── trials.py          # Trial models
│   ├── admin.py           # Admin models
│   ├── proxy.py           # Proxy request models
│   ├── chat.py            # Chat models
│   ├── coupons.py         # Coupon models
│   └── notification.py    # Notification models
├── security/              # Security layer
│   ├── __init__.py
│   ├── security.py        # Security utilities
│   └── deps.py            # Security dependencies
├── services/              # Business logic services
│   ├── __init__.py
│   ├── openrouter_client.py    # OpenRouter integration
│   ├── portkey_client.py       # Portkey integration
│   ├── featherless_client.py   # Featherless integration
│   ├── image_generation_client.py  # Image generation
│   ├── payments.py             # Payment processing
│   ├── notification.py         # Notification service
│   ├── rate_limiting.py        # Rate limiting
│   ├── trial_service.py        # Trial management
│   ├── trial_validation.py     # Trial validation
│   ├── professional_email_templates.py  # Email templates
│   ├── analytics.py            # Analytics
│   ├── pricing.py              # Pricing calculations
│   ├── providers.py            # Provider management
│   └── referral.py             # Referral system
├── trials/                # Trial-specific modules
└── utils/                 # Utility functions
```

## Core Components

### FastAPI Application (`src/main.py`)
- **Framework**: FastAPI 0.104.1 with automatic OpenAPI documentation
- **Title**: "Gatewayz Universal Inference API"
- **Version**: 2.0.1
- **CORS**: Enabled for all origins (configurable for production)
- **Authentication**: HTTP Bearer token authentication with API key validation
- **Route Organization**: Modular route loading system

### Database Layer
- **Primary Database**: Supabase (PostgreSQL)
- **Configuration**: `supabase_config.py` - Client initialization and connection management
- **Data Access**: Modular database functions in `src/db/`
- **Security**: `db_security.py` - Advanced security features and audit logging

### External Integrations
- **OpenRouter API**: AI model access via OpenAI SDK
  - Base URL: `https://openrouter.ai/api/v1`
  - Headers: HTTP-Referer and X-Title for identification
  - Model caching with 5-minute TTL
- **Portkey API**: Alternative AI model provider
- **Featherless API**: Additional model provider
- **Chutes API**: Model provider with custom catalog
- **Supabase**: Database and real-time features
  - User management and authentication
  - API key storage and validation
  - Usage tracking and analytics
- **Resend**: Professional email delivery service
  - Email notifications and templates
  - Secure password reset tokens
  - Usage reports and alerts
- **Stripe**: Payment processing
  - Credit purchases
  - Subscription management
  - Webhook handling

### Security Module (`src/security/`)
- **Advanced Security Manager**: Secure key hashing and encryption
- **Audit Logging**: Comprehensive security event tracking
- **Key Management**: HMAC-SHA256 hashing, Fernet encryption
- **API Key Validation**: Multi-layer validation with fallbacks
- **Rate Limiting**: Per-user and per-key rate limiting
- **IP Allowlists**: IP-based access control
- **Domain Restrictions**: Referer-based access control

## API Endpoints

### Public Endpoints
- `GET /health` - System health check
- `GET /ping` - Ping service with statistics
- `GET /models` - Available AI models
- `GET /models/providers` - Provider statistics
- `GET /ranking/models` - Model ranking data

### Authentication Endpoints
- `POST /auth/privy` - Privy authentication
- `GET /user/balance` - User credit balance
- `POST /user/api-keys` - Create API key
- `GET /user/api-keys` - List user API keys
- `PUT /user/api-keys/{key_id}` - Update API key
- `DELETE /user/api-keys/{key_id}` - Delete API key

### Chat Endpoints
- `POST /v1/chat/completions` - OpenAI-compatible chat completions
- `POST /v1/responses` - Unified response API
- `POST /images/generate` - Image generation
- `POST /chat/sessions` - Create chat session
- `GET /chat/sessions` - List chat sessions
- `GET /chat/sessions/{session_id}` - Get chat session
- `DELETE /chat/sessions/{session_id}` - Delete chat session

### Admin Endpoints
- `POST /admin/create` - Create user account
- `GET /admin/monitor` - System monitoring
- `POST /admin/add_credits` - Add credits to user
- `GET /admin/usage` - Usage analytics
- `POST /admin/rate-limits` - Set rate limits
- `GET /admin/audit-logs` - Audit logs

### Payment Endpoints
- `POST /api/stripe/webhook` - Stripe webhook
- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/payment-intent` - Create payment intent
- `POST /api/stripe/refund` - Process refund

### Plan Management
- `GET /plans` - List subscription plans
- `GET /plans/{plan_id}` - Get plan details
- `GET /user/plan` - Get user's current plan
- `POST /plans/assign` - Assign plan to user

### Trial Management
- `POST /trials/start` - Start free trial
- `GET /trials/status` - Get trial status
- `POST /trials/convert` - Convert trial to paid
- `POST /trials/track-usage` - Track trial usage

## Data Models

### Core Models
- **User Management**: Registration, profiles, authentication methods
- **API Keys**: Creation, management, security features, usage tracking
- **Plans**: Subscription management, entitlements, usage limits
- **Usage Tracking**: Comprehensive metrics and analytics
- **Rate Limiting**: Multi-tier rate limiting configuration
- **Notifications**: Email templates, preferences, delivery tracking
- **Trials**: Free trial management and conversion
- **Payments**: Stripe integration, credit purchases
- **Coupons**: Discount and promotion system
- **Roles**: Role-based access control
- **Referrals**: Referral tracking and rewards

### Request/Response Models
- **Pydantic Models**: Type-safe request/response validation
- **Enum Types**: Auth methods, payment methods, subscription status
- **Optional Fields**: Flexible update operations
- **Validation**: Email validation, date handling, credit management

## Data Flow

### Request Processing
1. **Authentication**: API key validation via `get_api_key` dependency
2. **Authorization**: Permission checks and rate limit validation
3. **Business Logic**: Database operations via modular `db/` functions
4. **External Calls**: AI model requests via provider clients
5. **Usage Tracking**: Credit deduction and usage recording
6. **Response**: Formatted response with gateway metadata

### Security Flow
1. **Key Validation**: Multi-layer API key validation
2. **IP/Domain Checks**: Allowlist enforcement
3. **Rate Limiting**: Per-key and per-user limits
4. **Plan Enforcement**: Subscription limit validation
5. **Audit Logging**: Security event recording
6. **Usage Monitoring**: Real-time analytics

## Database Schema

### Core Tables
- **users**: User accounts, profiles, credits, authentication
- **api_keys**: Legacy API key management
- **api_keys_new**: Enhanced API key system with security features
- **rate_limit_configs**: Per-user rate limiting
- **usage_records**: Comprehensive usage tracking
- **plans**: Subscription plan definitions
- **user_plans**: User plan assignments and history
- **audit_logs**: Security event logging
- **trial_records**: Free trial management
- **payment_records**: Payment transaction history
- **coupons**: Discount and promotion codes
- **referrals**: Referral tracking
- **chat_sessions**: Chat conversation management
- **latest_models**: Model ranking and metadata
- **openrouter_models**: OpenRouter model data

### Relationships
- Users have many API keys
- Users have one active plan
- API keys have usage records
- Plans have rate limit configurations
- Users have trial records
- Users have payment records
- Users have referral records

## Security Features

### API Key Management
- **Prefix-based identification**: `gw_live_`, `gw_test_`, `gw_staging_`, `gw_dev_`
- **Secure generation**: Cryptographically secure random keys
- **Encryption**: Fernet encryption for sensitive data
- **Rotation**: Automatic key rotation capabilities
- **Scope permissions**: Granular permission system
- **Expiration**: Time-based key expiration
- **Rate limiting**: Per-key request limits

### Authentication & Authorization
- **Multi-provider support**: OpenRouter, Portkey, Featherless, Chutes
- **Bearer token authentication**: HTTP Authorization header
- **Session management**: Temporary session keys
- **Role-based access**: Admin, user, and custom roles
- **IP allowlists**: IP-based access control
- **Domain restrictions**: Referer-based access control

### Audit & Monitoring
- **Comprehensive logging**: All API interactions logged
- **Security events**: Failed authentication attempts tracked
- **Usage analytics**: Real-time usage monitoring
- **Performance metrics**: Response time and error tracking
- **Alert system**: Automated security alerts

## Deployment

### Environment Configuration
- **Development**: Local development with hot reload
- **Staging**: Pre-production testing environment
- **Production**: Live production environment
- **Environment-specific**: API key prefixes and configurations

### Platform Support
- **Vercel**: Primary deployment platform
- **Railway**: Alternative deployment option
- **Heroku**: Legacy deployment support
- **Docker**: Containerized deployment
- **Kubernetes**: Scalable deployment option

## Monitoring & Operations

### Health Checks
- **System health**: Database connectivity, external service status
- **Performance metrics**: Response times, error rates
- **Resource usage**: Memory, CPU, database connections
- **Alert system**: Automated monitoring and alerting

### Logging
- **Structured logging**: JSON-formatted logs
- **Log levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Log aggregation**: Centralized log collection
- **Log retention**: Configurable log retention policies

### Analytics
- **Usage tracking**: Per-user and per-model usage
- **Performance metrics**: Response times and throughput
- **Error tracking**: Error rates and types
- **Business metrics**: Revenue, user growth, conversion rates