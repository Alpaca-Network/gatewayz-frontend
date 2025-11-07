# Gatewayz Universal Inference API - Codebase Context

## Overview

**Project**: Gatewayz Universal Inference API (v2.0.3)

**Purpose**: A production-ready, enterprise-grade FastAPI application that provides a unified API gateway for accessing 100+ AI models from 15+ different providers (OpenRouter, Portkey, Featherless, Chutes, DeepInfra, Fireworks, Together, HuggingFace, Google Vertex AI, and more).

**Key Features**:
- OpenAI-compatible API endpoints (drop-in replacement)
- Multi-provider model aggregation and routing
- Credit-based billing system with real-time tracking
- Enterprise security (encrypted API keys, IP allowlists, audit logging)
- Advanced features: chat history, image generation, free trials, subscriptions, referrals
- Comprehensive analytics and monitoring
- Rate limiting and request prioritization
- Multiple deployment options (Vercel, Railway, Docker)

---

## Codebase Structure

### Directory Layout

```
/root/repo/
├── src/                           # Main application source (41,688 lines of Python)
│   ├── main.py                   # FastAPI app factory and route initialization
│   ├── config/                   # Configuration management (4 files)
│   │   ├── config.py            # Environment-based configuration
│   │   ├── db_config.py         # Database configuration
│   │   ├── redis_config.py      # Redis caching configuration
│   │   └── supabase_config.py   # Supabase client initialization
│   │
│   ├── db/                       # Database Access Layer (16 modules)
│   │   ├── users.py             # User CRUD operations
│   │   ├── api_keys.py          # API key management with encryption
│   │   ├── chat_history.py      # Chat session management
│   │   ├── payments.py          # Payment/transaction records
│   │   ├── plans.py             # Subscription plan management
│   │   ├── trials.py            # Free trial tracking
│   │   ├── coupons.py           # Coupon/discount codes
│   │   ├── referral.py          # Referral system tracking
│   │   ├── activity.py          # User activity tracking
│   │   ├── rate_limits.py       # Rate limit configurations
│   │   ├── roles.py             # Role-based access control
│   │   ├── ranking.py           # Model ranking data
│   │   ├── credit_transactions.py # Credit transaction history
│   │   ├── gateway_analytics.py # Gateway usage analytics
│   │   └── ping.py              # Ping statistics
│   │
│   ├── routes/                   # API Endpoint Handlers (28 modules)
│   │   ├── chat.py              # Chat completions (OpenAI-compatible)
│   │   ├── messages.py          # Anthropic Messages API (Claude-compatible)
│   │   ├── images.py            # Image generation endpoints
│   │   ├── catalog.py           # Model catalog & discovery
│   │   ├── health.py            # Health check endpoints
│   │   ├── ping.py              # Ping/statistics service
│   │   ├── auth.py              # Authentication & login
│   │   ├── users.py             # User management
│   │   ├── api_keys.py          # API key CRUD operations
│   │   ├── admin.py             # Admin operations & monitoring
│   │   ├── payments.py          # Payment processing (Stripe webhooks)
│   │   ├── plans.py             # Subscription plans
│   │   ├── chat_history.py      # Chat history management
│   │   ├── coupons.py           # Coupon management
│   │   ├── notifications.py     # Notification endpoints
│   │   ├── audit.py             # Audit log queries
│   │   ├── rate_limits.py       # Rate limit configuration
│   │   ├── referral.py          # Referral system endpoints
│   │   ├── roles.py             # Role management
│   │   ├── activity.py          # Activity tracking
│   │   ├── analytics.py         # Analytics events
│   │   ├── availability.py      # Model availability checks
│   │   ├── system.py            # System health & cache management
│   │   ├── optimization_monitor.py # Connection pool & performance stats
│   │   ├── root.py              # Root/welcome endpoint
│   │   └── transaction_analytics.py # Transaction analytics
│   │
│   ├── services/                 # Business Logic Layer (48 modules)
│   │   # Provider Clients (17 modules)
│   │   ├── openrouter_client.py  # OpenRouter API integration
│   │   ├── portkey_client.py     # Portkey gateway integration
│   │   ├── featherless_client.py # Featherless provider
│   │   ├── chutes_client.py      # Chutes provider
│   │   ├── deepinfra_client.py   # DeepInfra provider
│   │   ├── fireworks_client.py   # Fireworks AI provider
│   │   ├── together_client.py    # Together AI provider
│   │   ├── huggingface_client.py # HuggingFace inference
│   │   ├── xai_client.py         # XAI provider
│   │   ├── aimo_client.py        # AIMO provider
│   │   ├── near_client.py        # Near AI provider
│   │   ├── fal_image_client.py   # Fal.ai image generation
│   │   ├── anannas_client.py     # Anannas provider
│   │   ├── google_vertex_client.py # Google Vertex AI
│   │   ├── modelz_client.py      # Modelz provider
│   │   ├── aihubmix_client.py    # AiHubMix provider
│   │   ├── vercel_ai_gateway_client.py # Vercel AI Gateway
│   │   │
│   │   # Core Services (8 modules)
│   │   ├── models.py             # Model catalog management
│   │   ├── providers.py          # Provider registry & caching
│   │   ├── model_transformations.py # Model ID transformation/routing
│   │   ├── model_availability.py # Model availability checking
│   │   ├── model_health_monitor.py # Health monitoring
│   │   ├── huggingface_models.py # HuggingFace model catalog
│   │   ├── portkey_providers.py  # Portkey provider routing
│   │   ├── image_generation_client.py # Image generation router
│   │   │
│   │   # Feature Services (10 modules)
│   │   ├── pricing.py            # Pricing calculations
│   │   ├── pricing_lookup.py     # Pricing data lookup
│   │   ├── payments.py           # Payment processing service
│   │   ├── trial_service.py      # Trial management
│   │   ├── trial_validation.py   # Trial validation logic
│   │   ├── referral.py           # Referral tracking
│   │   ├── rate_limiting.py      # Redis-based rate limiting
│   │   ├── rate_limiting_fallback.py # Fallback rate limiting
│   │   ├── roles.py              # Role management service
│   │   ├── ping.py              # Ping statistics service
│   │   │
│   │   # Utility Services (7 modules)
│   │   ├── notification.py       # Email notifications
│   │   ├── professional_email_templates.py # Email templates
│   │   ├── analytics.py          # Analytics service
│   │   ├── statsig_service.py    # Statsig feature flags
│   │   ├── posthog_service.py    # PostHog analytics
│   │   ├── startup.py            # Application startup/lifespan
│   │   ├── response_cache.py     # Response caching
│   │   ├── connection_pool.py    # Connection pooling
│   │   ├── request_prioritization.py # Request prioritization
│   │   ├── provider_failover.py  # Provider failover logic
│   │   └── anthropic_transformer.py # Message format transformation
│   │
│   ├── schemas/                  # Pydantic Data Models (13 modules)
│   │   ├── chat.py              # Chat request/response schemas
│   │   ├── auth.py              # Authentication schemas
│   │   ├── api_keys.py          # API key schemas
│   │   ├── users.py             # User schemas
│   │   ├── payments.py          # Payment schemas
│   │   ├── admin.py             # Admin operation schemas
│   │   ├── coupons.py           # Coupon schemas
│   │   ├── plans.py             # Plan schemas
│   │   ├── trials.py            # Trial schemas
│   │   ├── notification.py      # Notification schemas
│   │   ├── common.py            # Common/shared schemas
│   │   ├── proxy.py             # Proxy request schemas
│   │   └── activity.py          # Activity schemas
│   │
│   ├── security/                # Security & Auth Layer
│   │   ├── security.py          # Encryption/hashing utilities (Fernet, HMAC)
│   │   └── deps.py              # Security dependencies (get_api_key, etc)
│   │
│   ├── models/                  # Model Definition Files
│   │   ├── health_models.py     # Health check models
│   │   └── image_models.py      # Image generation models
│   │
│   ├── utils/                   # Utility Modules
│   │   ├── validators.py        # Input validation
│   │   └── security_validators.py # Security-specific validators
│   │
│   ├── constants.py             # Application constants
│   ├── models.py                # Legacy/global models
│   ├── cache.py                 # Caching utilities
│   ├── db_security.py           # Database security utilities
│   └── enhanced_notification_service.py # Enhanced notification service
│
├── tests/                        # Test Suite (40+ test files)
│   ├── conftest.py             # Pytest configuration & fixtures
│   ├── factories.py            # Test data factories
│   ├── db/                     # Database tests (15 modules)
│   ├── integration/            # Integration tests (25+ modules)
│   ├── health/                 # Health check tests
│   └── ...
│
├── docs/                        # Documentation (100+ files)
│   ├── architecture.md         # System architecture
│   ├── api.md                  # API reference
│   ├── setup.md                # Setup instructions
│   ├── DEPLOYMENT.md           # Deployment guide
│   ├── STRIPE.md               # Stripe integration
│   ├── REFERRAL_SYSTEM.md      # Referral system
│   ├── ACTIVITY_LOGGING.md     # Activity logging
│   └── integration/            # Provider integration guides
│
├── supabase/                    # Database Migrations
│   ├── config.toml             # Supabase configuration
│   └── migrations/             # SQL migrations (14 files)
│
├── scripts/                     # Utility Scripts
│   ├── checks/                 # Pre-deployment checks
│   ├── database/               # Database utilities
│   ├── integration-tests/      # Test scripts
│   └── utilities/              # Helper scripts
│
├── api/                         # Vercel Serverless Entry Point
│   └── index.py                # Vercel deployment handler
│
├── .github/                     # CI/CD Configuration
│   └── workflows/              # GitHub Actions workflows (7 files)
│
├── pyproject.toml              # Project metadata & tool configuration
├── requirements.txt            # Python dependencies (pinned versions)
├── vercel.json                 # Vercel deployment config
├── railway.json                # Railway deployment config
├── pytest.ini                  # Pytest configuration
├── README.md                   # Main documentation
└── CLAUDE.md                   # This file - AI context
```

---

## Key Technologies & Dependencies

### Core Framework & Web Server
- **FastAPI 0.104.1** - Modern, fast web framework with async support
- **Uvicorn 0.24.0** - ASGI server for running FastAPI
- **Python 3.10+** - Required Python version

### Data Validation & Serialization
- **Pydantic 2.12.2** with email validator - Type-safe data validation

### Database & Data Storage
- **Supabase 2.12.0** - PostgreSQL with real-time capabilities via PostgREST API
- **Redis 5.0.1** - In-memory cache for rate limiting and response caching

### External Service Integrations
- **Stripe 13.0.1** - Payment processing and subscriptions
- **Resend 0.8.0** - Transactional email delivery
- **OpenAI 1.44.0** - OpenAI API client
- **Portkey AI 2.0.0+** - Multi-provider gateway
- **HTTPX 0.27.0** - Async HTTP client
- **Requests 2.31.0** - Synchronous HTTP client

### Provider SDKs
- **Cerebras Cloud SDK 1.0.0+** - Cerebras inference
- **XAI SDK 0.1.0+** - X.AI provider integration
- **Google Cloud AIplatform 1.38.0+** - Google Vertex AI
- **Google Auth 2.0.0+** - Google authentication

### Security & Cryptography
- **Cryptography 41.0.7** - Fernet (AES-128) encryption and HMAC hashing
- **Python-dotenv 1.0.0** - Environment variable management
- **Email-validator 2.1.0** - Email format validation

### Analytics & Monitoring
- **Statsig Python Core 0.10.2** - Feature flags and A/B testing
- **PostHog 6.7.8** - Product analytics
- **Braintrust** - ML/AI evaluation and monitoring
- **OpenTelemetry** - Observability (optional, 5 packages)

### Testing
- **Pytest 7.4.3** - Testing framework
- **Pytest-cov 4.1.0** - Code coverage measurement
- **Pytest-asyncio 0.21.1** - Async test support
- **Pytest-xdist 3.5.0+** - Parallel test execution
- **Pytest-timeout 2.2.0** - Test timeout handling
- **Pytest-mock 3.12.0** - Mocking utilities
- **Flask-SQLAlchemy** - Database testing utilities

### Code Quality Tools
- **Ruff** - Fast Python linter (configured for 100 char line length)
- **Black** - Code formatter (100 char line length)
- **isort** - Import organizer
- **MyPy** - Type checking (optional)

### Deployment
- **Vercel** - Serverless platform
- **Railway** - Container hosting platform
- **Docker** - Containerization

---

## Architecture Overview

### High-Level Design Pattern

The application follows a **layered, modular architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│              External Clients                               │
│       (Web Apps, Mobile Apps, CLI Tools)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/REST API
                         │
┌────────────────────────▼────────────────────────────────────┐
│          FastAPI Application (src/main.py)                   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │  Middleware Layer                                     │   │
│ │  • CORS, Authentication, Rate Limiting               │   │
│ │  • Request logging, GZip compression                 │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │  Routes Layer (src/routes/ - 28 modules)             │   │
│ │  Handles HTTP endpoints and request parsing          │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │  Services Layer (src/services/ - 48 modules)         │   │
│ │  Business logic, provider routing, pricing, etc      │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │  Data Access Layer (src/db/ - 16 modules)            │   │
│ │  Database operations via Supabase PostgREST API      │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────┬──────────────────────────┬──────────────────────┘
             │                          │
    ┌────────▼──────────┐      ┌────────▼────────────────┐
    │  Supabase         │      │ External Providers      │
    │  (PostgreSQL)     │      │ • OpenRouter            │
    │                   │      │ • Portkey               │
    │ Tables:           │      │ • Featherless           │
    │ • users           │      │ • Chutes                │
    │ • api_keys        │      │ • DeepInfra             │
    │ • payments        │      │ • Fireworks             │
    │ • plans           │      │ • Together              │
    │ • chat_history    │      │ • HuggingFace           │
    │ • coupons         │      │ • Google Vertex         │
    │ • (15+ tables)    │      │ • & 6+ more             │
    └───────────────────┘      └─────────────────────────┘

                Also connected:
    ┌──────────────────┐   ┌──────────────────┐
    │    Redis         │   │  Stripe (Pay)    │
    │ (Cache/Rate      │   │  Resend (Email)  │
    │  Limiting)       │   │  Statsig (Flags) │
    └──────────────────┘   └──────────────────┘
```

### Architectural Principles

1. **Modularity**: Strict separation into routes (HTTP), services (logic), and db (data)
2. **Request Flow**:
   - Request enters with API key/authentication
   - Middleware validates and logs request
   - Route handler calls appropriate service
   - Service handles business logic (provider routing, pricing, rate limiting)
   - DB layer executes Supabase queries
   - Response formatted and returned
3. **Provider Abstraction**: Each provider (OpenRouter, Portkey, etc.) has its own client module
4. **Security**: Encrypted API keys (Fernet), HMAC validation, role-based access control
5. **Scalability**: Redis caching, connection pooling, async/await throughout

---

## Main Entry Points

### Local Development
- **File**: `src/main.py`
- **Function**: `create_app()` - Creates and configures FastAPI instance
- **Command**: `python src/main.py` or `uvicorn src.main:app --reload`
- **Port**: 8000 (default)

### Production Vercel
- **File**: `api/index.py`
- **Function**: Serverless function handler

### Docker/Railway
- **Script**: `start.sh`
- **Method**: Launches uvicorn server in container

---

## Critical Modules by Function

### Authentication & Security
- `src/security/security.py` - Encryption/HMAC utilities
- `src/security/deps.py` - FastAPI dependency injection for auth
- `src/db/api_keys.py` - Encrypted API key storage
- `src/routes/auth.py` - Authentication endpoints

### Model Routing & Catalog
- `src/services/models.py` - Model catalog aggregation
- `src/services/model_transformations.py` - Model ID normalization
- `src/services/model_availability.py` - Real-time availability
- `src/routes/catalog.py` - Model discovery endpoints

### Chat & Inference
- `src/routes/chat.py` - OpenAI-compatible chat endpoint
- `src/routes/messages.py` - Anthropic Messages API (Claude)
- `src/services/openrouter_client.py` - Primary provider integration
- `src/services/provider_failover.py` - Failover logic

### Credit Management
- `src/db/credit_transactions.py` - Transaction history
- `src/services/pricing.py` - Credit cost calculations
- `src/services/pricing_lookup.py` - Model-specific pricing
- `src/routes/users.py` - User balance endpoints

### Rate Limiting
- `src/services/rate_limiting.py` - Redis-based rate limiting
- `src/services/rate_limiting_fallback.py` - Fallback when Redis unavailable
- `src/db/rate_limits.py` - Rate limit configuration

### Database & Configuration
- `src/config/supabase_config.py` - Database client initialization
- `src/config/config.py` - Environment configuration (30+ vars)
- `src/config/redis_config.py` - Redis client setup
- `supabase/migrations/` - Database schema (14 migration files)

### Health & Monitoring
- `src/routes/health.py` - Health check endpoints
- `src/routes/system.py` - Cache management and system stats
- `src/routes/optimization_monitor.py` - Performance metrics
- `src/routes/audit.py` - Audit log queries

---

## Database Schema

### Core Tables (15+)
- **users** - User accounts and profiles
- **api_keys** - Encrypted API keys with metadata
- **payments** - Transaction records
- **plans** - Subscription plans
- **chat_history** - Conversation history
- **coupons** - Discount codes
- **referrals** - Referral tracking
- **trials** - Free trial information
- **credit_transactions** - Credit deduction history
- **rate_limits** - Rate limit configurations
- **roles** - Role-based access control
- **activity** - User activity logging
- **ranking** - Model rankings
- **gateway_analytics** - Usage analytics
- **ping** - Ping statistics

### Database Migrations
Located in `supabase/migrations/` with 14 migration files covering:
- Schema initialization
- Table creation and modifications
- Index optimization
- Permission configurations

---

## Configuration Management

### Environment Variables (30+)
Configured in `src/config/config.py`:
- Database: SUPABASE_URL, SUPABASE_KEY
- Redis: REDIS_URL
- Providers: OPENROUTER_KEY, PORTKEY_KEY, etc.
- Payments: STRIPE_KEY, STRIPE_WEBHOOK_SECRET
- Email: RESEND_API_KEY
- Analytics: STATSIG_SDK_KEY, POSTHOG_KEY
- Security: JWT_SECRET, ENCRYPTION_KEY
- And more...

### Loading
- **Development**: `.env` file (via python-dotenv)
- **Production**: Environment variables (Railway, Vercel)

---

## Testing Strategy

### Test Organization
- **Unit Tests**: Fast, isolated tests without external dependencies
- **Integration Tests**: Test database and service interactions
- **Health Tests**: Verify health check endpoints

### Running Tests
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src

# Run specific test file
pytest tests/integration/test_chat.py

# Run in parallel
pytest -n auto
```

### Pytest Configuration
Located in `pyproject.toml` with:
- Markers for categorization (unit, integration, slow, critical)
- Coverage configuration (source = ["src"])
- Output formatting (verbose, colored)

---

## Code Quality Standards

### Linting & Formatting
- **Ruff**: Fast Python linter for code quality
- **Black**: Code formatter with 100 char line limit
- **isort**: Import organization
- **MyPy**: Type checking (optional)

### Configuration Files
- `pyproject.toml` - Ruff, Black, isort, MyPy config
- `pytest.ini` - Pytest configuration

---

## Deployment Options

### 1. Vercel (Serverless)
- **Entry Point**: `api/index.py`
- **Configuration**: `vercel.json`
- **Advantages**: Auto-scaling, serverless, no infrastructure

### 2. Railway (Container)
- **Entry Point**: `start.sh`
- **Configuration**: `railway.json`
- **Advantages**: Simple deployment, automatic scaling

### 3. Docker (Self-hosted)
- **Configuration**: Dockerfile(s) in repo
- **Command**: Build and run container
- **Advantages**: Full control, can run anywhere

---

## Common Development Tasks

### Starting Development Server
```bash
cd /root/repo
python src/main.py
# or
uvicorn src.main:app --reload
```

### Adding a New Route
1. Create new module in `src/routes/`
2. Define request/response schemas in `src/schemas/`
3. Implement route handlers
4. Import router in `src/main.py`

### Adding a New Provider
1. Create client module in `src/services/` (e.g., `new_provider_client.py`)
2. Implement provider API integration
3. Register provider in `src/services/providers.py`
4. Add pricing data to pricing configuration
5. Add model mappings to `src/services/model_transformations.py`

### Database Changes
1. Create SQL migration in `supabase/migrations/`
2. Apply with Supabase CLI
3. Update corresponding module in `src/db/`

### Running Tests
```bash
# All tests
pytest

# With coverage
pytest --cov=src

# Specific test
pytest tests/integration/test_chat.py -v
```

---

## Important Files to Know

### Configuration & Setup
- `src/main.py` - Application factory
- `src/config/config.py` - Configuration management
- `pyproject.toml` - Project metadata and dependencies
- `requirements.txt` - Pinned dependency versions

### API Endpoints
- `src/routes/chat.py` - Main chat completion endpoint
- `src/routes/catalog.py` - Model catalog endpoints
- `src/routes/auth.py` - Authentication endpoints
- `src/routes/users.py` - User management endpoints

### Business Logic
- `src/services/models.py` - Model catalog management
- `src/services/openrouter_client.py` - Primary inference provider
- `src/services/pricing.py` - Pricing calculations
- `src/services/rate_limiting.py` - Rate limiting

### Database
- `src/db/users.py` - User database operations
- `src/db/api_keys.py` - API key management
- `src/config/supabase_config.py` - Database initialization

---

## Key Design Patterns

1. **Dependency Injection**: FastAPI dependency system for authentication, logging
2. **Async/Await**: All I/O operations are asynchronous for performance
3. **Service Layer**: Business logic isolated from HTTP handlers
4. **Factory Pattern**: `create_app()` function for app initialization
5. **Encryption at Rest**: Fernet encryption for sensitive data
6. **Rate Limiting**: Redis-backed with fallback mechanism
7. **Multi-Provider Strategy**: Abstract interface with specific implementations

---

## Performance & Scalability Features

1. **Caching**: Redis for response caching and rate limiting
2. **Connection Pooling**: Reuse database connections
3. **Request Prioritization**: Priority queue for important requests
4. **GZip Compression**: Automatic response compression
5. **Async I/O**: Non-blocking for high concurrency
6. **Load Balancing**: Multi-provider routing for failover
7. **Health Checks**: Continuous provider health monitoring

---

## Security Measures

1. **Encryption**: Fernet (AES-128) for API key storage
2. **Hashing**: HMAC-SHA256 for validation
3. **Authentication**: API key-based with token support
4. **Authorization**: Role-based access control (RBAC)
5. **Audit Logging**: All actions logged to audit table
6. **IP Allowlists**: Restrict API key usage by IP
7. **Domain Restrictions**: Limit API usage by domain
8. **Rate Limiting**: Per-user, per-key, system-wide limits

---

## Recent Updates & Current State

### Latest Changes
- Multiple provider integrations (17 providers total)
- Advanced credit management system
- Comprehensive audit logging
- Feature flag integration (Statsig)
- Analytics pipelines (PostHog)
- Stripe payment integration
- Free trial system
- Referral program
- Chat history persistence

### Active Maintenance
- Regular dependency updates
- Provider API updates and integrations
- Performance optimization
- Bug fixes and security patches

---

## Quick Reference

| Component | Location | Count |
|-----------|----------|-------|
| Routes | `src/routes/` | 28 |
| Services | `src/services/` | 48 |
| Database Modules | `src/db/` | 16 |
| Schemas | `src/schemas/` | 13 |
| Test Files | `tests/` | 40+ |
| Migrations | `supabase/migrations/` | 14 |
| Documentation | `docs/` | 100+ |
| **Total Python Code** | `src/` | **41,688 LOC** |

---

## Useful Documentation Files

- `docs/architecture.md` - Detailed system architecture
- `docs/api.md` - API endpoint documentation
- `docs/setup.md` - Local development setup
- `docs/DEPLOYMENT.md` - Deployment guides
- `docs/STRIPE.md` - Payment integration details
- `docs/REFERRAL_SYSTEM.md` - Referral program documentation
- `README.md` - Main project documentation

---

## Notes for Claude

This codebase is a sophisticated, production-grade AI gateway system. When working on tasks:

1. **Understand the Flow**: Requests go through routes → services → database
2. **Check Existing Patterns**: Many features follow established patterns (provider clients, service layers)
3. **Security First**: Always encrypt sensitive data; add audit logs for sensitive operations
4. **Database Migrations**: Any schema changes need SQL migrations in `supabase/migrations/`
5. **Testing**: Add tests for new features (follow existing test structure)
6. **Configuration**: Use environment variables via `src/config/config.py`
7. **Multiple Providers**: When adding features, consider how they work across all 17 providers
8. **Rate Limiting**: Account for Redis availability with fallback mechanisms
9. **Performance**: Use async/await; leverage caching; monitor connection pools
10. **Documentation**: Update docs when adding major features

---

**Last Updated**: 2025-11-05
**Version**: 2.0.3
