# Architecture

## System Overview

The AI Gateway (Gatewayz) is a production-ready, enterprise-grade FastAPI application that provides a unified interface for accessing multiple AI models through various providers. It features comprehensive credit management, rate limiting, security features, and advanced functionality for production use.

**Version**: 2.0.1  
**Framework**: FastAPI 0.104.1  
**Language**: Python 3.8+

## Architecture Principles

The AI Gateway is built on the following principles:

1. **Modularity**: Clear separation of concerns with distinct layers
2. **Scalability**: Designed to handle high traffic and scale horizontally
3. **Security**: Security-first approach with encryption, authentication, and audit logging
4. **Reliability**: Fault-tolerant design with proper error handling
5. **Maintainability**: Clean code structure with comprehensive documentation
6. **Performance**: Optimized for low latency with caching and efficient database queries

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Clients                          │
│              (Web Apps, Mobile Apps, CLI Tools)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS / REST API
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      FastAPI Gateway                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Middleware Layer                          │   │
│  │  • CORS Handler                                           │   │
│  │  • Authentication & Authorization                         │   │
│  │  • Rate Limiting                                          │   │
│  │  • Request/Response Logging                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Route Layer                               │   │
│  │  • Chat Endpoints        • Admin Endpoints                │   │
│  │  • Auth Endpoints        • Payment Endpoints              │   │
│  │  • User Endpoints        • Referral Endpoints             │   │
│  │  • Catalog Endpoints     • Activity Endpoints             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Service Layer                             │   │
│  │  • OpenRouter Client     • Pricing Service                │   │
│  │  • Portkey Client        • Payment Service                │   │
│  │  • Featherless Client    • Notification Service           │   │
│  │  • Image Gen Client      • Analytics Service              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Database Layer                            │   │
│  │  • User Management       • Coupon Management              │   │
│  │  • API Key Management    • Referral Management            │   │
│  │  • Plan Management       • Chat History                   │   │
│  │  • Payment Records       • Activity Logging               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────┬───────────────────────────┘
                      │               │
        ┌─────────────▼───────────┐   │
        │      Supabase           │   │
        │   (PostgreSQL)          │   │
        │  • User Data            │   │
        │  • API Keys             │   │
        │  • Usage Records        │   │
        │  • Audit Logs           │   │
        └─────────────────────────┘   │
                                      │
┌─────────────────────────────────────▼───────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  OpenRouter  │  │    Portkey    │  │ Featherless  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Chutes    │  │    Stripe     │  │    Resend    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐                                                │
│  │    Redis     │  (Optional - Caching & Rate Limiting)          │
│  └──────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘
```

## Project Structure

The project follows a clean, modular architecture with clear separation of concerns:

```
gateway/
├── api/
│   └── index.py                    # Vercel serverless function entry point
├── src/
│   ├── main.py                     # FastAPI application factory
│   ├── config.py                   # Configuration management
│   ├── models.py                   # Legacy models (being phased out)
│   ├── supabase_config.py          # Database client initialization
│   ├── db_config.py                # Database configuration
│   ├── db_security.py              # Security utilities
│   ├── redis_config.py             # Redis configuration
│   ├── cache.py                    # Caching utilities
│   ├── enhanced_notification_service.py  # Email service
│   │
│   ├── db/                         # Database Access Layer
│   │   ├── __init__.py
│   │   ├── users.py                # User CRUD operations
│   │   ├── api_keys.py             # API key management
│   │   ├── plans.py                # Subscription plans
│   │   ├── payments.py             # Payment records
│   │   ├── ranking.py              # Model ranking
│   │   ├── rate_limits.py          # Rate limit configs
│   │   ├── trials.py               # Free trial management
│   │   ├── chat_history.py         # Chat session management
│   │   ├── coupons.py              # Coupon management
│   │   ├── roles.py                # Role-based access control
│   │   ├── activity.py             # Activity tracking
│   │   ├── credit_transactions.py  # Credit transactions
│   │   ├── referral.py             # Referral system
│   │   └── ping.py                 # Ping statistics
│   │
│   ├── routes/                     # API Route Handlers
│   │   ├── __init__.py
│   │   ├── root.py                 # Root/welcome endpoint
│   │   ├── health.py               # Health check endpoints
│   │   ├── ping.py                 # Ping service
│   │   ├── chat.py                 # Chat completions & responses
│   │   ├── catalog.py              # Model catalog
│   │   ├── auth.py                 # Authentication
│   │   ├── users.py                # User management
│   │   ├── api_keys.py             # API key endpoints
│   │   ├── admin.py                # Admin operations
│   │   ├── plans.py                # Subscription plans
│   │   ├── payments.py             # Payment processing
│   │   ├── ranking.py              # Model ranking
│   │   ├── notifications.py        # Notification management
│   │   ├── chat_history.py         # Chat history endpoints
│   │   ├── images.py               # Image generation
│   │   ├── coupons.py              # Coupon endpoints
│   │   ├── roles.py                # Role management
│   │   ├── activity.py             # Activity endpoints
│   │   ├── audit.py                # Audit log endpoints
│   │   ├── rate_limits.py          # Rate limit management
│   │   ├── referral.py             # Referral endpoints
│   │   └── transaction_analytics.py # Transaction analytics
│   │
│   ├── schemas/                    # Pydantic Models
│   │   ├── __init__.py
│   │   ├── common.py               # Common enums and types
│   │   ├── auth.py                 # Authentication models
│   │   ├── users.py                # User models
│   │   ├── api_keys.py             # API key models
│   │   ├── plans.py                # Plan models
│   │   ├── payments.py             # Payment models
│   │   ├── trials.py               # Trial models
│   │   ├── admin.py                # Admin models
│   │   ├── proxy.py                # Proxy request models
│   │   ├── chat.py                 # Chat models
│   │   ├── coupons.py              # Coupon models
│   │   └── notification.py         # Notification models
│   │
│   ├── security/                   # Security Layer
│   │   ├── __init__.py
│   │   ├── security.py             # Encryption, hashing, key generation
│   │   └── deps.py                 # Security dependencies (auth)
│   │
│   ├── services/                   # Business Logic Layer
│   │   ├── __init__.py
│   │   ├── openrouter_client.py    # OpenRouter API integration
│   │   ├── portkey_client.py       # Portkey API integration
│   │   ├── featherless_client.py   # Featherless API integration
│   │   ├── image_generation_client.py # Image generation
│   │   ├── payments.py             # Payment processing logic
│   │   ├── notification.py         # Notification service
│   │   ├── rate_limiting.py        # Rate limiting logic
│   │   ├── rate_limiting_fallback.py # Fallback rate limiting
│   │   ├── trial_service.py        # Trial management
│   │   ├── trial_validation.py     # Trial validation
│   │   ├── professional_email_templates.py # Email templates
│   │   ├── analytics.py            # Analytics service
│   │   ├── pricing.py              # Pricing calculations
│   │   ├── providers.py            # Provider management
│   │   ├── referral.py             # Referral logic
│   │   ├── roles.py                # Role management
│   │   ├── models.py               # Model management
│   │   └── ping.py                 # Ping service
│   │
│   ├── trials/                     # Trial-specific modules
│   │
│   └── utils/                      # Utility Functions
│       └── reset_welcome_emails.py
│
├── tests/                          # Test Suite
│   ├── conftest.py                 # Pytest configuration
│   ├── db/                         # Database tests
│   ├── routes/                     # Route tests
│   ├── security/                   # Security tests
│   ├── services/                   # Service tests
│   └── ...                         # Other test files
│
├── supabase/                       # Supabase Configuration
│   ├── config.toml                 # Supabase project config
│   └── migrations/                 # Database migrations
│       ├── 20251009030427_remote_schema.sql
│       ├── 20251009040000_add_coupon_system.sql
│       ├── 20251009050000_add_pingpong_stats_table.sql
│       ├── 20251009060000_add_user_roles.sql
│       ├── 20251011_fix_permissions.sql
│       ├── 20251011073440_remote_schema.sql
│       └── 20251012_consolidate_balance_to_credits.sql
│
├── scripts/                        # Utility Scripts
│   ├── add_logo_url_field.py
│   ├── check_auth_fix.py
│   ├── fix_primary_api_keys.py
│   └── ...
│
├── docs/                           # Documentation
├── migrations/                     # Legacy migrations
├── requirements.txt                # Python dependencies
├── runtime.txt                     # Python version for deployment
├── vercel.json                     # Vercel configuration
├── railway.json                    # Railway configuration
├── railway.toml                    # Railway TOML config
├── Procfile                        # Heroku process file
├── pytest.ini                      # Pytest configuration
└── start.sh                        # Start script
```

## Core Components

### 1. FastAPI Application (`src/main.py`)

The main application entry point that:
- Creates and configures the FastAPI app
- Registers all route handlers
- Configures middleware (CORS, authentication)
- Handles startup and shutdown events
- Manages application lifecycle

Key features:
- **TitleSection**: "Gatewayz Universal Inference API"
- **Version**: 2.0.1
- **CORS**: Enabled for all origins (configurable)
- **Authentication**: HTTP Bearer token
- **Route Organization**: Modular route loading system

### 2. Database Layer (`src/db/`)

Handles all database operations with Supabase (PostgreSQL):

- **users.py**: User account management
  - Create, read, update user profiles
  - Credit management
  - User authentication methods

- **api_keys.py**: API key lifecycle management
  - Create encrypted API keys
  - Validate and authenticate keys
  - Track key usage
  - Key rotation and expiration

- **plans.py**: Subscription plan management
  - Define subscription plans
  - Assign plans to users
  - Track plan history

- **payments.py**: Payment transaction management
  - Record payments
  - Track credit purchases
  - Payment history

- **chat_history.py**: Chat session management
  - Create and manage chat sessions
  - Store message history
  - Automatic history injection

- **coupons.py**: Coupon and discount management
  - Create and validate coupons
  - Apply discounts
  - Track coupon usage

- **referral.py**: Referral program management
  - Generate referral codes
  - Track referrals
  - Calculate rewards

- **activity.py**: Activity tracking
  - Log user activities
  - Track API usage
  - Generate analytics

### 3. Route Layer (`src/routes/`)

Defines all API endpoints:

#### Public Routes
- **root.py**: Welcome page
- **health.py**: Health checks
- **ping.py**: Ping with statistics
- **catalog.py**: Model catalog and provider info

#### Authentication Routes
- **auth.py**: Privy authentication, user login
- **users.py**: User profile management
- **api_keys.py**: API key management

#### Core Functionality Routes
- **chat.py**: Chat completions, unified responses
- **images.py**: Image generation
- **chat_history.py**: Chat session management

#### Admin Routes
- **admin.py**: Admin operations
- **audit.py**: Audit log access
- **transaction_analytics.py**: Transaction analytics

#### Feature Routes
- **plans.py**: Subscription plans
- **payments.py**: Payment processing
- **coupons.py**: Coupon management
- **referral.py**: Referral system
- **roles.py**: Role management
- **rate_limits.py**: Rate limit configuration
- **ranking.py**: Model ranking
- **activity.py**: Activity tracking
- **notifications.py**: Notification management

### 4. Schema Layer (`src/schemas/`)

Pydantic models for request/response validation:

- **Type Safety**: Strong typing for all data structures
- **Validation**: Automatic data validation
- **Serialization**: JSON serialization/deserialization
- **Documentation**: Automatic API documentation generation

Key schemas:
- Authentication models (login, registration)
- User models (profile, settings)
- API key models (creation, update)
- Chat models (messages, sessions)
- Payment models (transactions, subscriptions)
- Admin models (monitoring, analytics)

### 5. Security Layer (`src/security/`)

Comprehensive security implementation:

#### security.py
- **Encryption**: Fernet encryption for sensitive data
- **Hashing**: HMAC-SHA256 for API key validation
- **Key Generation**: Secure random key generation
- **Password Hashing**: Bcrypt for password storage (if used)

#### deps.py
- **Authentication**: Bearer token authentication
- **Authorization**: Role-based access control
- **API Key Validation**: Multi-layer validation with fallbacks
- **Rate Limiting**: Request rate limiting
- **IP Allowlists**: IP-based access control
- **Domain Restrictions**: Referer-based control

Security features:
- API key prefixes: `gw_live_`, `gw_test_`, `gw_staging_`, `gw_dev_`
- Encrypted storage of sensitive data
- Audit logging of security events
- Failed authentication tracking
- Automatic key expiration

### 6. Service Layer (`src/services/`)

Business logic implementation:

#### Provider Clients
- **openrouter_client.py**: OpenRouter API integration
  - Model list caching (5-minute TTL)
  - OpenAI SDK integration
  - Request/response handling
  
- **portkey_client.py**: Portkey API integration
  - Multi-provider access
  - Request routing
  
- **featherless_client.py**: Featherless API integration
  - Specialized model access
  
- **image_generation_client.py**: Image generation
  - Multiple provider support
  - Image storage handling

#### Business Services
- **payments.py**: Payment processing logic
  - Stripe integration
  - Credit purchases
  - Subscription management
  
- **pricing.py**: Pricing calculations
  - Token-based pricing
  - Credit calculations
  - Cost estimation
  
- **notification.py**: Notification service
  - Email templates
  - Delivery tracking
  - Notification preferences
  
- **rate_limiting.py**: Rate limiting logic
  - Redis-based rate limiting
  - Per-user and per-key limits
  - Sliding window algorithm
  
- **analytics.py**: Analytics service
  - Usage tracking
  - Performance metrics
  - Business intelligence
  
- **trial_service.py**: Trial management
  - Trial creation and tracking
  - Usage monitoring
  - Conversion tracking
  
- **referral.py**: Referral logic
  - Code generation
  - Reward calculation
  - Tracking and attribution

## Technology Stack

### Backend Framework
- **FastAPI 0.104.1**
  - Modern, fast web framework
  - Automatic API documentation (OpenAPI/Swagger)
  - Async support for high performance
  - Type hints for better IDE support
  - Pydantic integration for validation

### Web Server
- **Uvicorn 0.24.0**
  - ASGI server for async Python
  - High performance
  - WebSocket support
  - Production-ready

### Database
- **Supabase (PostgreSQL)**
  - Managed PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Automatic API generation
  - Built-in authentication

### Data Validation
- **Pydantic 2.5.0**
  - Data validation using Python type hints
  - Automatic JSON schema generation
  - Fast and efficient
  - Great error messages

### Caching & Rate Limiting
- **Redis 5.0.1** (Optional)
  - In-memory data store
  - Rate limiting
  - Session storage
  - Caching layer

### Payment Processing
- **Stripe 13.0.1**
  - Payment processing
  - Subscription management
  - Webhook handling
  - Invoice generation

### Email Delivery
- **Resend 0.8.0**
  - Transactional email service
  - Template support
  - Delivery tracking
  - Developer-friendly API

### Security
- **Cryptography 41.0.7**
  - Fernet encryption
  - HMAC hashing
  - Secure key generation
  - Industry-standard algorithms

### AI Provider Integration
- **OpenAI SDK 1.3.0**
  - OpenAI API client
  - Used for OpenRouter integration
  - Streaming support
  - Function calling

### HTTP Client
- **HTTPX 0.26.0**
  - Async HTTP client
  - HTTP/2 support
  - Connection pooling
  - Timeout handling

### Testing
- **Pytest 7.4.3**
  - Testing framework
  - Fixtures and mocking
  - Coverage reporting
  - Async test support

## Data Flow

### Request Processing Flow

```
1. Client Request
   ↓
2. CORS Middleware
   ↓
3. Authentication Middleware
   │  • Extract Bearer token
   │  • Validate API key
   │  • Load user context
   ↓
4. Rate Limiting
   │  • Check rate limits
   │  • Increment counters
   │  • Reject if exceeded
   ↓
5. Route Handler
   │  • Parse request
   │  • Validate data
   │  • Business logic
   ↓
6. Service Layer
   │  • Provider selection
   │  • API calls
   │  • Data processing
   ↓
7. Database Operations
   │  • Save usage record
   │  • Update credits
   │  • Log activity
   ↓
8. Response Formation
   │  • Format response
   │  • Add metadata
   │  • Return to client
   ↓
9. Audit Logging
   │  • Log request/response
   │  • Track security events
```

### Chat Completion Flow

```
1. Client sends chat completion request
   ↓
2. Authenticate API key
   ↓
3. Check user credits
   ↓
4. Check rate limits
   ↓
5. Load chat history (if session provided)
   ↓
6. Select provider based on model
   ↓
7. Call provider API
   │  • OpenRouter
   │  • Portkey
   │  • Featherless
   │  • Chutes
   ↓
8. Process response
   ↓
9. Calculate costs
   ↓
10. Deduct credits
   ↓
11. Save to chat history
   ↓
12. Create usage record
   ↓
13. Return response to client
```

### Authentication Flow

```
1. Client provides API key in Authorization header
   ↓
2. Extract Bearer token
   ↓
3. Validate key format (prefix check)
   ↓
4. Query database for key details
   ↓
5. Validate key:
   │  • Not expired
   │  • Not revoked
   │  • Has required permissions
   │  • IP allowed (if configured)
   │  • Domain allowed (if configured)
   ↓
6. Load user context
   ↓
7. Check user status:
   │  • Account active
   │  • Has credits
   │  • Not banned
   ↓
8. Inject user context into request
```

## Database Schema

### Core Tables

#### users
```sql
- id (uuid, primary key)
- email (text, unique)
- credits (decimal) -- Unified credit balance
- privy_id (text, unique) -- Privy authentication ID
- role (text) -- User role (admin, user, etc.)
- created_at (timestamp)
- updated_at (timestamp)
- is_active (boolean)
- referral_code (text, unique) -- User's referral code
```

#### api_keys_new (Enhanced API Key System)
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key -> users)
- key_hash (text) -- HMAC-SHA256 hash
- encrypted_key (text) -- Fernet encrypted
- prefix (text) -- Key prefix (gw_live_, etc.)
- name (text) -- User-friendly name
- scopes (jsonb) -- Permissions array
- rate_limit (integer) -- Requests per minute
- ip_allowlist (jsonb) -- Allowed IPs
- domain_restrictions (jsonb) -- Allowed domains
- expires_at (timestamp)
- last_used_at (timestamp)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

#### plans
```sql
- id (uuid, primary key)
- name (text)
- description (text)
- price (decimal)
- credits_included (decimal)
- rate_limit_per_minute (integer)
- features (jsonb)
- is_active (boolean)
- created_at (timestamp)
```

#### user_plans
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key -> users)
- plan_id (uuid, foreign key -> plans)
- status (text) -- active, cancelled, expired
- started_at (timestamp)
- ends_at (timestamp)
- auto_renew (boolean)
```

#### usage_records
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key -> users)
- api_key_id (uuid, foreign key -> api_keys_new)
- model (text)
- provider (text)
- input_tokens (integer)
- output_tokens (integer)
- total_tokens (integer)
- cost (decimal)
- request_type (text) -- chat, image, etc.
- created_at (timestamp)
```

#### chat_sessions
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key -> users)
- title (text)
- model (text)
- provider (text)
- created_at (timestamp)
- updated_at (timestamp)
```

#### chat_messages
```sql
- id (uuid, primary key)
- session_id (uuid, foreign key -> chat_sessions)
- role (text) -- user, assistant, system
- content (text)
- tokens (integer)
- created_at (timestamp)
```

#### coupons
```sql
- id (uuid, primary key)
- code (text, unique)
- discount_type (text) -- percentage, fixed
- discount_value (decimal)
- max_uses (integer)
- uses_count (integer)
- valid_from (timestamp)
- valid_to (timestamp)
- is_active (boolean)
- created_at (timestamp)
```

#### referrals
```sql
- id (uuid, primary key)
- referrer_id (uuid, foreign key -> users)
- referred_id (uuid, foreign key -> users)
- referral_code (text)
- reward_amount (decimal)
- status (text) -- pending, completed, paid
- created_at (timestamp)
- completed_at (timestamp)
```

#### audit_logs
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key -> users)
- action (text)
- resource_type (text)
- resource_id (text)
- details (jsonb)
- ip_address (text)
- user_agent (text)
- created_at (timestamp)
```

### Relationships

```
users (1) ─── (M) api_keys_new
users (1) ─── (M) usage_records
users (1) ─── (M) chat_sessions
users (1) ─── (1) user_plans
users (1) ─── (M) referrals (as referrer)
users (1) ─── (M) referrals (as referred)

chat_sessions (1) ─── (M) chat_messages
plans (1) ─── (M) user_plans

api_keys_new (1) ─── (M) usage_records
```

## External Integrations

### AI Model Providers

#### OpenRouter
- **Base URL**: `https://openrouter.ai/api/v1`
- **Authentication**: Bearer token
- **Features**: Access to 100+ AI models
- **Integration**: OpenAI SDK compatible
- **Caching**: Model list cached for 5 minutes

#### Portkey
- **Features**: Multi-provider routing
- **Integration**: Custom client implementation
- **Use Case**: Alternative provider access

#### Featherless
- **Features**: Specialized model access
- **Integration**: Custom client implementation
- **Use Case**: Specific model variants

#### Chutes
- **Features**: Custom model catalog
- **Integration**: Custom client implementation
- **Use Case**: Chutes-specific models

### Payment Processing

#### Stripe
- **Integration**: Stripe SDK 13.0.1
- **Features**:
  - Credit purchases
  - Subscription management
  - Webhook handling
  - Invoice generation
  - Payment history
- **Webhooks**:
  - `payment_intent.succeeded`
  - `charge.succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

### Email Service

#### Resend
- **Integration**: Resend SDK 0.8.0
- **Features**:
  - Transactional emails
  - Template support
  - Delivery tracking
  - Bounce handling
- **Email Types**:
  - Welcome emails
  - Password resets
  - Usage alerts
  - Payment confirmations
  - Trial expiration notices

### Authentication

#### Privy
- **Integration**: Custom implementation
- **Features**:
  - Email authentication
  - Social login
  - Wallet authentication
  - User management
- **Use Case**: Primary authentication method

## Security Architecture

### API Key Management

```
Key Generation:
1. Generate random 32-byte key
2. Create key prefix (gw_live_, gw_test_, etc.)
3. Combine prefix + base64(random_bytes)
4. Hash key with HMAC-SHA256 for validation
5. Encrypt key with Fernet for storage
6. Store hash and encrypted key in database

Key Validation:
1. Extract key from Authorization header
2. Hash provided key with HMAC-SHA256
3. Query database for matching hash
4. Decrypt stored key for verification
5. Check expiration, permissions, IP, domain
6. Return user context or error
```

### Encryption

- **Algorithm**: Fernet (symmetric encryption)
- **Key Derivation**: SECRET_KEY from environment
- **Use Cases**:
  - API key storage
  - Sensitive user data
  - Payment information

### Authentication

- **Method**: HTTP Bearer token
- **Format**: `Authorization: Bearer gw_live_...`
- **Validation**: Multi-layer with fallbacks
- **Session**: Stateless (no session storage)

### Authorization

- **Role-Based**: Admin, user, custom roles
- **Scope-Based**: API key permissions
- **Resource-Based**: User can only access own resources

### Audit Logging

- **Logged Events**:
  - Authentication attempts
  - API key operations
  - Credit changes
  - Admin actions
  - Security events
- **Retention**: Configurable
- **Access**: Admin only

## Deployment Architecture

### Vercel Deployment

```
Client Request
    ↓
Vercel Edge Network
    ↓
Serverless Function (api/index.py)
    ↓
FastAPI Application
    ↓
Supabase Database
    ↓
External Services
```

### Railway Deployment

```
Client Request
    ↓
Railway Load Balancer
    ↓
Docker Container (main.py)
    ↓
FastAPI Application
    ↓
Supabase Database
    ↓
External Services
```

### Docker Deployment

```
Docker Host
├── ai-gateway container
│   ├── Python 3.9
│   ├── FastAPI app
│   └── Uvicorn server
└── redis container (optional)
```

## Performance Considerations

### Caching Strategy

1. **Model Lists**: Cached for 5 minutes
2. **User Data**: Cached per request
3. **Provider Status**: Cached for 1 minute
4. **Rate Limit Counters**: Redis with TTL

### Database Optimization

1. **Indexes**:
   - User email (unique)
   - API key hash (unique)
   - Usage records (user_id, created_at)
   - Chat sessions (user_id, created_at)

2. **Connection Pooling**:
   - Supabase client manages connections
   - Automatic reconnection

3. **Query Optimization**:
   - Selective field loading
   - Pagination for large datasets
   - Efficient join strategies

### Rate Limiting

- **Algorithm**: Sliding window
- **Storage**: Redis (if available) or in-memory
- **Granularity**: Per-user and per-key
- **Limits**: Configurable per plan

## Monitoring & Observability

### Health Checks

- **`/health`**: Basic health check
- **`/ping`**: Ping with statistics
- **`/admin/monitor`**: Detailed system monitoring

### Logging

- **Level**: INFO (production), DEBUG (development)
- **Format**: Structured JSON logs
- **Includes**:
  - Request ID
  - User ID
  - API key ID
  - Execution time
  - Error details

### Metrics

- Request count
- Response time (p50, p95, p99)
- Error rate
- Credit usage
- Model usage distribution
- Provider distribution

## Scalability

### Horizontal Scaling

- Stateless design allows multiple instances
- Load balancing across instances
- Shared database and cache

### Vertical Scaling

- Increase instance resources
- Database connection pool sizing
- Cache memory allocation

### Database Scaling

- Supabase handles scaling
- Read replicas for heavy read loads
- Connection pooling

## Future Architecture Improvements

### Phase 2
- GraphQL API endpoint
- WebSocket support for streaming
- Advanced caching strategies
- Custom model fine-tuning

### Phase 3
- Multi-tenant architecture
- Advanced load balancing
- Model performance benchmarking
- Distributed tracing

---

This architecture is designed to be robust, scalable, and maintainable while providing excellent performance and security for production use.
