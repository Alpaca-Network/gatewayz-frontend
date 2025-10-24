# Gatewayz AI Gateway - Complete Codebase Exploration Report

**Date**: October 24, 2025  
**Repository**: AI Gateway (Gatewayz) - Universal Inference API  
**Branch**: terragon/update-claude-md-r3k3gm  
**Version**: 2.0.3

---

## Executive Summary

This is a **production-ready, enterprise-grade FastAPI application** providing unified AI model access through multiple providers. The system is actively maintained with recent major feature additions including xAI Grok integration, Near AI support, and Vertex AI testing capabilities.

**Key Stats:**
- **Language**: Python 3.12+
- **Framework**: FastAPI 0.104.1
- **Database**: Supabase (PostgreSQL)
- **Providers Supported**: 15+ AI providers (OpenRouter, Portkey, Featherless, xAI, Near AI, Cerebras, Nebius, Novita, DeepInfra, Groq, Fireworks, Together, HuggingFace, AIMO, Google Vertex AI)
- **Total Python Files**: 100+
- **Test Coverage**: 700+ test cases across 50+ test files
- **Code Size**: ~11K lines in services, ~10K lines in routes

---

## 1. Directory Structure Overview

```
/root/repo/
├── src/                          # Main application source code
│   ├── main.py                   # FastAPI application entry point & route loader
│   ├── models.py                 # Data models
│   ├── cache.py                  # Caching layer for models and providers (120 lines)
│   ├── config/                   # Configuration management
│   │   ├── config.py             # Environment & provider configuration
│   │   ├── db_config.py          # Database configuration
│   │   ├── redis_config.py       # Redis configuration
│   │   └── supabase_config.py    # Supabase client initialization
│   ├── app/
│   │   └── api/                  # API routing structure
│   ├── db/                       # Database layer (16 modules)
│   │   ├── users.py              # User management
│   │   ├── api_keys.py           # API key CRUD & management
│   │   ├── chat_history.py       # Chat session persistence
│   │   ├── credit_transactions.py # Credit ledger
│   │   ├── coupons.py            # Coupon system
│   │   ├── payments.py           # Payment records
│   │   ├── plans.py              # Subscription plans
│   │   ├── rate_limits.py        # Rate limiting
│   │   ├── referral.py           # Referral tracking
│   │   ├── roles.py              # RBAC (Role-Based Access Control)
│   │   ├── trials.py             # Free trial management
│   │   ├── ranking.py            # Model ranking
│   │   ├── activity.py           # Activity logging
│   │   ├── gateway_analytics.py  # Gateway statistics
│   │   └── ping.py               # Health check data
│   ├── routes/                   # API endpoints (25 files, 9,600+ lines)
│   │   ├── chat.py               # Chat completions (1,302 lines)
│   │   ├── catalog.py            # Model catalog (1,906 lines)
│   │   ├── messages.py           # Anthropic Messages API (458 lines)
│   │   ├── admin.py              # Admin operations (694 lines)
│   │   ├── auth.py               # Authentication (477 lines)
│   │   ├── users.py              # User endpoints (341 lines)
│   │   ├── payments.py           # Stripe integration (488 lines)
│   │   ├── api_keys.py           # API key management (388 lines)
│   │   ├── images.py             # Image generation
│   │   ├── coupons.py            # Coupon management (366 lines)
│   │   ├── chat_history.py       # Chat history endpoints (299 lines)
│   │   ├── system.py             # System health & cache (628 lines)
│   │   ├── plans.py              # Subscription plans (269 lines)
│   │   ├── rate_limits.py        # Rate limit management
│   │   ├── notifications.py      # Notification endpoints (271 lines)
│   │   ├── transaction_analytics.py # TX analytics (255 lines)
│   │   ├── referral.py           # Referral endpoints
│   │   ├── roles.py              # Role management
│   │   ├── ranking.py            # Model ranking
│   │   ├── activity.py           # Activity tracking
│   │   ├── audit.py              # Audit logs
│   │   ├── analytics.py          # Analytics events
│   │   ├── health.py             # Health checks
│   │   ├── ping.py               # Ping endpoint
│   │   └── root.py               # Root/home endpoint
│   ├── schemas/                  # Pydantic models (13 files)
│   │   ├── chat.py               # Chat request/response schemas
│   │   ├── auth.py               # Authentication schemas
│   │   ├── api_keys.py           # API key schemas
│   │   ├── payments.py           # Payment schemas
│   │   ├── coupons.py            # Coupon schemas
│   │   ├── users.py              # User schemas
│   │   ├── plans.py              # Plan schemas
│   │   ├── admin.py              # Admin schemas
│   │   ├── trials.py             # Trial schemas
│   │   ├── common.py             # Shared schemas
│   │   ├── proxy.py              # Proxy request schemas
│   │   ├── notification.py       # Notification schemas
│   │   └── __init__.py           # Schema exports
│   ├── services/                 # Business logic (40+ files, 11K+ lines)
│   │   ├── models.py             # Model catalog (2,026 lines)
│   │   ├── portkey_providers.py  # Provider integrations (510 lines)
│   │   ├── xai_client.py         # xAI Grok integration (110 lines) [NEW]
│   │   ├── near_client.py        # Near AI integration (100 lines) [NEW]
│   │   ├── openrouter_client.py  # OpenRouter integration
│   │   ├── portkey_client.py     # Portkey integration
│   │   ├── featherless_client.py # Featherless integration
│   │   ├── fireworks_client.py   # Fireworks integration (150+ lines)
│   │   ├── together_client.py    # Together integration
│   │   ├── huggingface_client.py # HuggingFace integration (200+ lines)
│   │   ├── aimo_client.py        # AIMO integration
│   │   ├── chutes_client.py      # Chutes integration
│   │   ├── deepinfra_client.py   # DeepInfra integration
│   │   ├── modelz_client.py      # Modelz integration (276 lines)
│   │   ├── huggingface_models.py # HF model catalog (472 lines)
│   │   ├── model_transformations.py # Model ID normalization (404 lines)
│   │   ├── image_generation_client.py # Image generation (337 lines)
│   │   ├── providers.py          # Provider utilities (246 lines)
│   │   ├── provider_failover.py  # Failover logic
│   │   ├── pricing.py            # Pricing calculations (121 lines)
│   │   ├── pricing_lookup.py     # Pricing lookup service
│   │   ├── payment.py            # Payment service (477 lines)
│   │   ├── referral.py           # Referral service (620 lines)
│   │   ├── trial_service.py      # Trial management (449 lines)
│   │   ├── trial_validation.py   # Trial validation (280 lines)
│   │   ├── rate_limiting.py      # Rate limiting (605 lines)
│   │   ├── rate_limiting_fallback.py # Fallback rate limiting (245 lines)
│   │   ├── notification.py       # Notifications (600 lines)
│   │   ├── professional_email_templates.py # Email templates (949 lines)
│   │   ├── analytics.py          # Analytics utilities
│   │   ├── posthog_service.py    # PostHog integration
│   │   ├── statsig_service.py    # Statsig integration
│   │   ├── ping.py               # Ping utility
│   │   └── portkey_sdk.py        # Portkey SDK wrapper (180 lines)
│   ├── security/                 # Security utilities
│   │   ├── deps.py               # Security dependencies
│   │   └── security.py           # Encryption/hashing utilities
│   ├── utils/                    # Utility functions
│   ├── db_security.py            # Database security (500+ lines)
│   ├── enhanced_notification_service.py # Advanced notifications
│   └── redis_config.py           # Redis configuration
├── tests/                        # Test suite (700+ tests)
│   ├── conftest.py               # Pytest configuration & fixtures
│   ├── db/                       # Database layer tests (12 files)
│   │   ├── test_users.py
│   │   ├── test_api_keys.py
│   │   ├── test_chat_history.py
│   │   ├── test_coupons.py       # 60+ tests
│   │   ├── test_credit_transactions.py
│   │   ├── test_payments.py
│   │   ├── test_plans.py
│   │   ├── test_rate_limits.py
│   │   ├── test_roles.py
│   │   ├── test_trials.py        # 40+ tests
│   │   ├── test_activity.py
│   │   └── test_ranking.py
│   ├── routes/                   # API route tests (14 files)
│   │   ├── test_auth.py          # 55+ tests, 1,078 lines
│   │   ├── test_api_keys.py      # 40+ tests, 941 lines
│   │   ├── test_users.py         # 40+ tests, 1,026 lines
│   │   ├── test_payments.py      # 30+ tests, 630 lines
│   │   ├── test_chat.py
│   │   ├── test_images.py
│   │   ├── test_messages.py
│   │   ├── test_chat_history.py
│   │   ├── test_coupons.py
│   │   ├── test_plans.py
│   │   ├── test_notifications.py
│   │   ├── test_analytics.py
│   │   ├── test_roles.py
│   │   └── test_audit.py
│   ├── services/                 # Service layer tests (13 files)
│   ├── security/                 # Security tests (2 files)
│   ├── integration/              # Integration tests (23 files)
│   │   ├── test_model_inference.py # Model inference testing
│   │   ├── test_portkey.py
│   │   ├── test_huggingface_integration.py
│   │   ├── test_chutes_integration.py
│   │   ├── test_fireworks.py
│   │   ├── test_endpoints.py
│   │   ├── test_endpoint_regression.py
│   │   ├── test_model_transform.py
│   │   ├── test_provider_case_sensitivity.py
│   │   ├── test_streaming_comprehensive.py
│   │   ├── test_thinking_tags.py
│   │   └── (11 more integration tests)
│   └── smoke/                    # Smoke tests (2 files)
├── supabase/                     # Database migrations
│   ├── config.toml
│   └── migrations/               # 11 migration files
│       ├── 20250116000000_add_performance_indexes_fixed.sql
│       ├── 20251009030427_remote_schema.sql
│       ├── 20251009040000_add_coupon_system.sql
│       ├── 20251009050000_add_pingpong_stats_table.sql
│       ├── 20251009060000_add_user_roles.sql
│       └── (6 more migrations)
├── docs/                         # Documentation (50+ files)
│   ├── README.md                 # Documentation index
│   ├── CLAUDE.md                 # Claude AI documentation
│   ├── setup.md                  # Setup guide
│   ├── ENVIRONMENT_SETUP.md      # Environment configuration
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── STRIPE.md                 # Stripe integration guide
│   ├── TESTING.md                # Testing guide
│   ├── CHAT_HISTORY_INTEGRATION.md
│   ├── RESPONSES_API.md          # Response API docs
│   ├── REFERRAL_SYSTEM.md        # Referral system docs
│   ├── ACTIVITY_LOGGING.md       # Activity logging
│   ├── CHUTES_INTEGRATION.md     # Chutes provider docs
│   ├── FEATHERLESS_INTEGRATION.md # Featherless docs
│   ├── PORTKEY_TESTING_GUIDE.md  # Portkey docs
│   ├── HUGGINGFACE_INTEGRATION.md # HuggingFace docs
│   ├── GOOGLE_VERTEX_SETUP.md    # Vertex AI setup
│   ├── TEST_VERTEX_ENDPOINT.md   # Vertex AI testing
│   ├── PORTER_INVESTIGATION.md   # Debugging guides
│   └── (30+ more docs)
├── scripts/                      # Utility scripts
│   ├── check_*.py                # Verification scripts
│   ├── fix_*.py                  # Repair scripts
│   ├── validate_*.py             # Validation scripts
│   ├── create_stripe_test_user.py
│   ├── stream_demo.py
│   ├── test_model_stats.py
│   └── (subdirectories)
├── README.md                     # Main project documentation
├── QUICK_TEST.md                 # Quick start test guide
├── SERVICE_ACCOUNT_GUIDE.md      # Google Cloud SA guide
├── ALTERNATIVE_AUTH_METHODS.md   # Auth methods
├── requirements.txt              # Python dependencies
├── requirements-dev.txt          # Dev dependencies
├── pyproject.toml                # Project config & tool settings
├── pytest.ini                    # Pytest configuration
├── railway.toml / railway.json   # Railway deployment config
├── .github/                      # GitHub workflows
├── .env.example                  # Environment template
└── .gitignore                    # Git ignore rules
```

---

## 2. Main Application Architecture

### 2.1 Entry Point: `main.py` (302 lines)

The FastAPI application initializes with:
- **Dynamic Route Loading**: Loads 27 route modules at startup
- **CORS Configuration**: Environment-aware (production, staging, development)
- **Middleware Stack**: CORS, security headers
- **Startup Events**:
  - Configuration validation
  - Database initialization
  - Admin user setup
  - Analytics initialization (Statsig, PostHog)
  - Model cache warming
- **Shutdown Events**: Graceful analytics shutdown

**Route Loading Order** (important for URL precedence):
1. Health checks & ping
2. Chat completions & messages (before catalog to prevent `/v1/*` catch-all)
3. Image generation
4. Model catalog
5. System operations
6. Root/home
7. Auth, users, API keys
8. Admin, payments, notifications
9. All feature routes (plans, rate limits, referrals, coupons, etc.)

### 2.2 Configuration: `config/config.py` (100+ lines)

**Environment Variables Managed**:

| Category | Variables |
|----------|-----------|
| **Environment** | APP_ENV (dev/staging/prod), TESTING |
| **Database** | SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY |
| **AI Providers** | OPENROUTER_API_KEY, PORTKEY_API_KEY, FEATHERLESS_API_KEY, CHUTES_API_KEY, FIREWORKS_API_KEY, TOGETHER_API_KEY, GROQ_API_KEY, HUG_API_KEY, AIMO_API_KEY, XAI_API_KEY, NEAR_API_KEY, NEBIUS_API_KEY, CEREBRAS_API_KEY, NOVITA_API_KEY, DEEPINFRA_API_KEY |
| **Google Cloud** | GOOGLE_PROJECT_ID, GOOGLE_VERTEX_LOCATION, GOOGLE_VERTEX_ENDPOINT_ID, GOOGLE_APPLICATION_CREDENTIALS |
| **Payments** | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY |
| **Analytics** | STATSIG_SERVER_SECRET_KEY, POSTHOG_API_KEY, POSTHOG_HOST |
| **Other** | ADMIN_EMAIL, FRONTEND_URL, OPENROUTER_SITE_URL |

**Key Methods**:
- `get_portkey_virtual_key(provider)`: Resolves provider-specific Portkey virtual keys
- `validate()`: Validates required environment variables (skips in Vercel)

---

## 3. Database Layer (`src/db/`) - 16 Modules

### Core Modules:

**User Management**:
- `users.py`: User CRUD, credits, balance tracking, email updates
- `api_keys.py`: API key creation/rotation/deletion, usage tracking
- `roles.py`: Role-based access control (admin/user/custom roles)

**Financial**:
- `credit_transactions.py`: Credit ledger, deductions, refunds
- `payments.py`: Stripe payment records, subscription tracking
- `plans.py`: Subscription plans, pricing tiers
- `coupons.py`: Coupon creation, validation, usage tracking
- `referral.py`: Referral links, rewards, tracking

**Usage Tracking**:
- `chat_history.py`: Chat sessions and message persistence
- `rate_limits.py`: Per-user and per-key rate limit enforcement
- `activity.py`: API call logging, analytics
- `trials.py`: Free trial management, usage limits

**Infrastructure**:
- `ranking.py`: Model ranking data
- `gateway_analytics.py`: Gateway statistics
- `ping.py`: Health check metrics

---

## 4. Routes Layer (`src/routes/`) - 25 Files

### Major Routes:

**Chat & Messages (Core)**:
- `chat.py` (1,302 lines): Chat completions with streaming, failover, rate limiting, credit deduction
- `messages.py` (458 lines): Anthropic-compatible Messages API

**Model Discovery**:
- `catalog.py` (1,906 lines): Model listing, provider statistics, model details

**User Management**:
- `auth.py` (477 lines): Privy authentication, token management
- `users.py` (341 lines): User profile, balance, account management
- `api_keys.py` (388 lines): API key CRUD, permissions

**Payments & Billing**:
- `payments.py` (488 lines): Stripe webhooks, invoice management
- `plans.py` (269 lines): Plan listing, user plan management
- `coupons.py` (366 lines): Coupon validation, application

**Features**:
- `chat_history.py` (299 lines): Session management, message retrieval
- `images.py`: Image generation (DALL-E, Stable Diffusion)
- `rate_limits.py`: Rate limit configuration
- `notifications.py` (271 lines): Email/notification management
- `referral.py`: Referral tracking and rewards
- `transaction_analytics.py` (255 lines): Usage analytics

**Admin & Operations**:
- `admin.py` (694 lines): User creation, credit adjustments, monitoring
- `system.py` (628 lines): Cache management, health checks
- `audit.py`: Audit log querying
- `activity.py`: Activity log endpoints
- `analytics.py`: Server-side analytics events
- `roles.py`: Role management

**Health & Utility**:
- `health.py`: Health check endpoint
- `ping.py`: Ping with statistics
- `root.py`: Root/home endpoint
- `ranking.py`: Model ranking endpoints

---

## 5. Services Layer (`src/services/`) - 40+ Files, 11K+ Lines

### AI Provider Clients (27 files):

**Core Providers**:
- `openrouter_client.py`: OpenRouter integration
- `portkey_client.py`: Portkey unified API client
- `featherless_client.py`: Featherless.ai integration
- `chutes_client.py`: Chutes provider

**Inference Providers**:
- `fireworks_client.py` (150+ lines): Fireworks.ai integration
- `together_client.py`: Together.ai integration
- `huggingface_client.py` (200+ lines): HuggingFace inference API

**Specialized Providers**:
- **xai_client.py** (110 lines) [NEW - Oct 23, 2025]:
  - Integrates xAI's Grok models
  - Tries official xAI SDK first, falls back to OpenAI SDK with base_url
  - Functions: `get_xai_client()`, `make_xai_request_openai()`, `make_xai_request_openai_stream()`, `process_xai_response()`
  - Base URL for fallback: `https://api.x.ai/v1`
  
- **near_client.py** (100 lines) [NEW - Oct 17, 2025]:
  - Near AI decentralized AI infrastructure integration
  - OpenAI-compatible client with custom base URL
  - Functions: `get_near_client()`, `make_near_request_openai()`, `make_near_request_openai_stream()`, `process_near_response()`
  - Base URL: `https://cloud-api.near.ai/v1`

- `aimo_client.py`: AIMO Network integration
- `deepinfra_client.py`: DeepInfra integration
- `cerebras_client.py`: Cerebras via Portkey
- `nebius_client.py`: Nebius via OpenAI SDK
- `novita_client.py`: Novita via OpenAI SDK
- `modelz_client.py` (276 lines): Modelz token data

**Image Generation**:
- `image_generation_client.py` (337 lines): Multi-provider image generation (DALL-E, Stable Diffusion via Google Vertex AI)

### Model Management (4 files, 2,500+ lines):

- `models.py` (2,026 lines): **Master model catalog service**
  - **Cache management** for all 16+ providers
  - **Unified model aggregation**: Combines models from all providers
  - **TTL-based caching**: 30 minutes (Portkey), 1 hour (others)
  - **Fallback mechanisms**: Uses fallback lists if APIs fail
  - **Model discovery**: Lists providers, counts models per gateway
  - **Provider-specific fetch functions**:
    - `fetch_models_from_openrouter()`
    - `fetch_models_from_portkey()`
    - `fetch_models_from_featherless()`
    - `fetch_models_from_chutes()`
    - `fetch_models_from_groq()`
    - `fetch_models_from_fireworks()`
    - `fetch_models_from_together()`
    - `fetch_models_from_deepinfra()`
    - `fetch_models_from_google()` (via Portkey patterns)
    - `fetch_models_from_cerebras()` (via Portkey patterns)
    - `fetch_models_from_nebius()` (via Portkey patterns)
    - `fetch_models_from_xai()`
    - `fetch_models_from_novita()`
    - `fetch_models_from_hug()` (HuggingFace)
    - `fetch_models_from_aimo()`
    - `fetch_models_from_near()` [NEW]
    - `fetch_specific_model_*()` functions for individual model lookup

- `portkey_providers.py` (510 lines): **Provider-specific integrations**
  - Uses official SDKs where available:
    - xAI SDK with fallback to OpenAI SDK
    - Cerebras SDK with fallback to HTTP
  - OpenAI-compatible APIs:
    - Nebius via `https://api.studio.nebius.ai/v1/`
    - Novita via `https://api.novita.ai/v3/openai`
  - Portkey filtering patterns:
    - Google: patterns "@google/", "google/", "gemini", "gemma"
    - HuggingFace: patterns "llava-hf", "hugging", "hf/"
  - **Fallback model lists**: Pre-defined models if APIs fail
    - xAI fallback: `grok-beta`, `grok-vision-beta`
    - Near AI fallback: `deepseek-v3.1`, `llama-3.2-vision-90b`, etc.

- `huggingface_models.py` (472 lines): HuggingFace model catalog with special handling
- `model_transformations.py` (404 lines): Model ID normalization and detection

### Business Logic Services (13 files, 4,500+ lines):

**Financial**:
- `pricing.py` (121 lines): Token-based cost calculation
- `pricing_lookup.py`: Pricing data enrichment
- `payments.py` (477 lines): Payment processing, invoicing

**Rate Limiting & Usage**:
- `rate_limiting.py` (605 lines): Redis-based rate limiting with fallback
- `rate_limiting_fallback.py` (245 lines): In-memory fallback when Redis unavailable

**Trials & Subscriptions**:
- `trial_service.py` (449 lines): Free trial management
- `trial_validation.py` (280 lines): Trial eligibility and restrictions

**Engagement**:
- `referral.py` (620 lines): Referral tracking and rewards
- `notification.py` (600 lines): Notification queue and delivery
- `professional_email_templates.py` (949 lines): Email template library

**Infrastructure**:
- `providers.py` (246 lines): Provider utilities
- `provider_failover.py`: Failover chain building and error handling
- `ping.py`: Gateway statistics
- `analytics.py`: Analytics utilities
- `posthog_service.py`: PostHog integration
- `statsig_service.py`: Statsig analytics integration
- `portkey_sdk.py` (180 lines): Portkey SDK wrapper

---

## 6. Schemas Layer (`src/schemas/`) - 13 Files

Pydantic V2 models for request/response validation:

- `chat.py`: Chat completion requests, completions API
- `auth.py`: Authentication requests/responses
- `api_keys.py`: API key operations
- `payments.py`: Payment webhook schemas
- `coupons.py`: Coupon operations
- `users.py`: User operations
- `plans.py`: Plan information
- `admin.py`: Admin operations
- `trials.py`: Trial requests
- `notification.py`: Notification schemas
- `proxy.py`: Proxy request schemas
- `common.py`: Shared schemas (pagination, errors)
- `__init__.py`: Exports (ProxyRequest, ResponseRequest, etc.)

---

## 7. Recent Major Features (Git History - October 2025)

### Feature 1: xAI Grok Integration (Oct 23, 2025) - Commit `08eb7e9`
**PR #30**: "feat(xai): add support for xAI Grok models integration"

**Changes**:
- **New File**: `src/services/xai_client.py` (110 lines)
  - `get_xai_client()`: Initializes xAI client
  - `make_xai_request_openai()`: Non-streaming requests
  - `make_xai_request_openai_stream()`: Streaming requests
  - `process_xai_response()`: Response parsing
  
- **Modified**: `src/routes/chat.py` (+21 lines)
  - Added xAI provider routing in chat completions endpoint
  - Integrated streaming support for xAI models
  
- **Modified**: `tests/integration/test_model_inference.py` (-5 lines)
  - Updated integration tests for xAI inference compatibility

**Key Details**:
- Tries official xAI SDK first
- Falls back to OpenAI SDK with `https://api.x.ai/v1` base URL
- Supports both streaming and non-streaming modes
- Compatible with Grok models (grok-beta, grok-vision-beta)

---

### Feature 2: Fallback Model Lists for Near AI & xAI (Oct 23, 2025) - Commit `82eeff4`
**PR #28**: "feat(models): add fallback model lists for Near AI and xAI providers"

**Changes**:
- **Modified**: `src/services/models.py`
  - Added fallback model lists if API calls fail
  - Improved reliability for xAI and Near AI
  
- **Modified**: `src/services/near_client.py`
  - Updated API base URL to `https://cloud-api.near.ai/v1` (from `/v1/models` endpoint)
  
- **Modified**: `src/services/portkey_providers.py` (+51 lines)
  - Added fallback models for xAI
  - Added fallback models for Near AI
  
- **Modified**: `.env.example` (+4 lines)
  - Added XAI_API_KEY, NEBIUS_API_KEY, CEREBRAS_API_KEY, NOVITA_API_KEY

**Key Details**:
- xAI fallback models: `grok-beta`, `grok-vision-beta`
- Near AI fallback models: `deepseek-v3.1`, `llama-3.2-vision-90b`, etc.
- Ensures model availability even when external APIs unreachable

---

### Feature 3: Vertex AI Testing Toolkit (Oct 18, 2025) - Commit `84d257c`
**PR #26**: "Deploy Vertex AI endpoint testing toolkit with impersonation"

**Changes**:
- Added service account impersonation support
- Created `TEST_VERTEX_ENDPOINT.md` and related test scripts
- Stable Diffusion v1.5 endpoint testing
- Google Cloud integration enhancements

**Key Details**:
- Tests image generation via Google Vertex AI
- Supports service account authentication
- Production endpoint testing capabilities

---

### Feature 4: Near AI Integration (Oct 17, 2025) - Commit `26e2b67`
**PR #23**: "feat(near): add Near AI integration with client and model catalog"

**Changes**:
- **New File**: `src/services/near_client.py` (100 lines)
  - OpenAI-compatible client wrapper
  - Streaming and non-streaming support
  
- **Modified**: `src/services/models.py`
  - Added `fetch_models_from_near()` function
  - Added `normalize_near_model()` function
  - Near AI models integrated into unified catalog
  
- **Modified**: `src/routes/chat.py`
  - Added Near AI routing in chat completions

**Key Details**:
- Decentralized AI infrastructure (Near Protocol)
- Base URL: `https://cloud-api.near.ai/v1`
- Supports Deepseek, Llama, and other models
- Full streaming support

---

### Feature 5: Direct Provider APIs (Oct 16, 2025) - Commit `5a96fc3`
**PR #25**: "Refactor: Use direct provider APIs for Cerebras, Nebius, xAI, Novita"

**Changes**:
- Moved from Portkey filtering to direct API integration
- Better reliability and completeness
- Cerebras official SDK support
- xAI official SDK support with OpenAI fallback

---

## 8. Provider Support Matrix

### Supported Providers (16+):

| Provider | Status | Integration | Models | Streaming | Cache TTL |
|----------|--------|-------------|--------|-----------|-----------|
| **OpenRouter** | Active | Native SDK | 100+ | Yes | 1h |
| **Portkey** | Active | Native SDK | 100+ | Yes | 30m |
| **Featherless** | Active | OpenAI SDK | 50+ | Yes | 1h |
| **xAI** | NEW | Official SDK + OpenAI | 2+ | Yes | 1h |
| **Near AI** | NEW | OpenAI SDK | 15+ | Yes | 1h |
| **HuggingFace** | Active | Inference API | 1204+ | Yes | 1h |
| **Groq** | Active | Native API | 10+ | Yes | 30m |
| **Fireworks** | Active | OpenAI SDK | 30+ | Yes | 30m |
| **Together** | Active | OpenAI SDK | 50+ | Yes | 30m |
| **DeepInfra** | Active | HTTP API | 50+ | Yes | 1h |
| **Cerebras** | Active | Official SDK + HTTP | 5+ | Yes | 1h |
| **Nebius** | Active | OpenAI SDK | 5+ | Yes | 1h |
| **Novita** | Active | OpenAI SDK | 30+ | Yes | 1h |
| **AIMO** | Active | HTTP API | 5+ | Yes | 1h |
| **Chutes** | Active | Native API | 20+ | Yes | 1h |
| **Google Vertex** | Active | Official SDK | Images | Yes | 1h |

**Total Models Available**: 1,500+

---

## 9. Key Architectural Patterns

### 9.1 Model Caching Strategy

```python
# cache.py - 120 lines
_models_cache = {"data": None, "timestamp": None, "ttl": 3600}
_xai_models_cache = {"data": None, "timestamp": None, "ttl": 3600}
_near_models_cache = {"data": None, "timestamp": None, "ttl": 3600}
# ... 16 provider-specific caches
```

**Features**:
- Per-provider caching with independent TTLs
- 30-minute TTL for high-frequency providers (Portkey, Fireworks, Together)
- 1-hour TTL for stable catalogs
- Fallback lists when API unavailable
- Cache warming on startup

### 9.2 Provider Routing Pattern

All providers follow same client interface:
```python
def get_<provider>_client(): -> Client
def make_<provider>_request_openai(messages, model, **kwargs): -> Response
def make_<provider>_request_openai_stream(...): -> Iterator
def process_<provider>_response(response): -> Dict
```

This allows:
- Easy provider addition
- Unified request handling in routes
- Consistent error handling
- Seamless failover

### 9.3 Failover Chain Pattern

`chat.py` implements provider failover:
1. Parse model ID to detect source provider
2. Build failover chain (primary + alternatives)
3. Try primary provider
4. On failure, move to next provider
5. Use rate limiting and timeout handling

### 9.4 Model Normalization Pattern

Each provider transforms raw models to unified schema:
```python
normalize_<provider>_model(raw_model) -> {
    "id": "...",
    "slug": "...",
    "name": "...",
    "created": ...,
    "description": "...",
    "context_length": ...,
    "pricing": {...},
    "provider_slug": "...",
    "source_gateway": "...",
    ...
}
```

### 9.5 Rate Limiting Strategy

```python
# rate_limiting.py - 605 lines
- Redis-based if available
- In-memory fallback if Redis unavailable (rate_limiting_fallback.py)
- Per-user and per-API-key limits
- Token-based rate limiting
- Quota enforcement at request time
```

---

## 10. Test Structure (700+ Tests)

### Test Organization:

**Database Tests** (`tests/db/`):
- User management (CRUD, credits)
- API keys (creation, rotation, validation)
- Chat history persistence
- Coupons (60+ tests)
- Payments and transactions
- Plans and subscriptions
- Rate limits
- Roles and RBAC
- Trials (40+ tests)
- Activity logging

**Route Tests** (`tests/routes/`, ~2,600 lines):
- Auth (55+ tests, 1,078 lines)
- API Keys (40+ tests, 941 lines)
- Users (40+ tests, 1,026 lines)
- Payments (30+ tests, 630 lines)
- Chat completions
- Image generation
- Chat history
- Coupons
- Plans
- System operations
- Analytics
- Audit logs

**Integration Tests** (`tests/integration/`, 23 files):
- Model inference testing (all providers)
- Streaming and non-streaming
- Provider case sensitivity
- HuggingFace routing architecture
- Thinking tags handling
- End-to-end workflows
- Portkey SDK integration
- Referral system comprehensive tests
- Endpoint regression testing

**Service Tests** (`tests/services/`, 13 files):
- Pricing calculations
- Referral logic
- Trial validation
- Rate limiting
- Email templating

### Test Fixtures (`conftest.py`):
```python
@pytest.fixture
def test_prefix()              # Unique test session identifier
@pytest.fixture
def supabase_client()          # Real or mocked Supabase
@pytest.fixture
def clean_test_user()          # Auto-cleanup test users
@pytest.fixture
def isolated_test_data()       # Comprehensive data tracking
@pytest.fixture
def mock_env_vars()            # Environment mocking
```

### Test Configuration:
- **Python Version**: 3.12+
- **Framework**: pytest 7.0+
- **Async Support**: pytest-asyncio
- **Coverage Target**: 80%+
- **Markers**: unit, integration, slow, critical, regression, auth, payment, chat, admin, smoke, contract, e2e

---

## 11. Database Schema (Supabase)

### Key Tables:

**User Management**:
- `users`: User accounts with credits
- `user_profiles`: User details
- `user_roles`: Role assignments
- `user_plans`: Subscription plans
- `user_trials`: Free trial tracking

**API & Keys**:
- `api_keys`: API key storage (encrypted)
- `api_keys_new`: New API key format
- `api_key_usage`: Usage statistics

**Financial**:
- `credit_transactions`: Credit ledger
- `payments`: Payment records
- `invoices`: Invoice tracking
- `coupons`: Discount codes
- `coupon_usage`: Coupon application tracking

**Chat & Sessions**:
- `chat_sessions`: Session metadata
- `chat_messages`: Message storage
- `chat_history`: Legacy chat data

**Monitoring & Analytics**:
- `activity_logs`: API call logs
- `gateway_analytics`: Gateway statistics
- `rate_limit_usage`: Rate limit tracking
- `ping_pong_stats`: Health check data
- `user_credits_history`: Credit balance history

**Referrals**:
- `referrals`: Referral relationships
- `referral_rewards`: Reward tracking

**11 Migration Files** ensure schema evolution and consistency

---

## 12. Security Features

### API Key Security:
- **Encryption**: Fernet encryption for storage
- **Hashing**: HMAC-SHA256 for validation
- **Rotation**: Built-in key rotation
- **Scoping**: Granular permissions per key
- **Prefixing**: Environment-specific (gw_live_, gw_test_, gw_staging_, gw_dev_)
- **Expiration**: Time-based key expiration

### Authentication:
- Bearer token (HTTP Authorization header)
- Privy integration for frontend auth
- Multi-provider support
- Role-based access control (admin/user)

### Rate Limiting:
- Per-user limits
- Per-API-key limits
- Token-based quota enforcement
- Redis fallback

### Audit & Monitoring:
- Comprehensive activity logging
- Security event tracking
- Failed auth attempt tracking
- Usage analytics
- Encrypted sensitive data storage

### Database Security:
- Row-level security (RLS) via Supabase
- Service role key for admin operations
- Anon key for user operations
- Environment-based credential separation

---

## 13. Deployment Configuration

### Environment Support:
- **Development**: `http://localhost:3000`, `http://localhost:3001`, `127.0.0.1:3000`
- **Staging**: Railway deployment, staging.gatewayz.ai
- **Production**: Production endpoints, Vercel/Railway

### Deployment Platforms:
- **Vercel**: Default (serverless)
- **Railway**: Docker container
- **Docker**: Custom deployment
- **GitHub Actions**: CI/CD workflows

### Configuration Files:
- `railway.toml`: Railway configuration
- `railway.json`: Railway JSON config
- `.github/workflows/`: GitHub Actions
- `nixpacks.toml`: Nix build configuration
- `Dockerfile`: (if using Docker)

---

## 14. Configuration & Environment

### Required Variables:
```env
# Database
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenRouter (primary)
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=
OPENROUTER_SITE_NAME=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# Admin
ADMIN_API_KEY=
ADMIN_EMAIL=
```

### Optional Variables (17+ Provider Keys):
```env
PORTKEY_API_KEY=
FEATHERLESS_API_KEY=
CHUTES_API_KEY=
FIREWORKS_API_KEY=
TOGETHER_API_KEY=
GROQ_API_KEY=
AIMO_API_KEY=
XAI_API_KEY=
NEAR_API_KEY=
NEBIUS_API_KEY=
CEREBRAS_API_KEY=
NOVITA_API_KEY=
DEEPINFRA_API_KEY=
HUG_API_KEY=
GOOGLE_PROJECT_ID=
GOOGLE_VERTEX_LOCATION=
GOOGLE_VERTEX_ENDPOINT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
```

### Analytics:
```env
STATSIG_SERVER_SECRET_KEY=
POSTHOG_API_KEY=
POSTHOG_HOST=
POSTHOG_DEBUG=
```

---

## 15. Documentation Structure (50+ Files)

### Setup & Configuration:
- `setup.md`: Local development setup
- `ENVIRONMENT_SETUP.md`: Environment variable guide
- `DEPLOYMENT.md`: Production deployment
- `DEPLOYMENT_QUICK_REFERENCE.md`: Quick deployment checklist

### API Documentation:
- `RESPONSES_API.md`: Unified response API
- `CHAT_HISTORY_INTEGRATION.md`: Chat history feature
- `MESSAGES_API.md`: Anthropic Messages API
- `PROVIDER_AVAILABILITY_REPORT.md`: Provider status

### Feature Guides:
- `STRIPE.md`: Stripe payment integration
- `REFERRAL_SYSTEM.md`: Referral program
- `ACTIVITY_LOGGING.md`: Activity tracking
- `AUTOMATIC_HISTORY_INJECTION.md`: History auto-injection

### Provider Setup:
- `GOOGLE_VERTEX_SETUP.md`: Vertex AI setup
- `TEST_VERTEX_ENDPOINT.md`: Vertex AI testing
- `CHUTES_INTEGRATION.md`: Chutes provider
- `FEATHERLESS_INTEGRATION.md`: Featherless provider
- `HUGGINGFACE_INTEGRATION.md`: HuggingFace setup
- `PORTKEY_TESTING_GUIDE.md`: Portkey provider

### Operations & Troubleshooting:
- `DEPLOYMENT.md`: Production guide
- `operations.md`: Monitoring and maintenance
- `troubleshooting.md`: Common issues
- `TESTING.md`: Test execution guide

### Debugging & Analysis:
- Multiple `*_FIX.md` and `*_INVESTIGATION.md` files
- CI/CD documentation
- Performance tuning guides

---

## 16. Key Statistics

### Codebase Metrics:
| Metric | Value |
|--------|-------|
| **Total Python Files** | 100+ |
| **Source Code (src/)** | 11K+ lines |
| **Routes Code** | 9,600+ lines |
| **Services Code** | 11K+ lines |
| **Test Files** | 50+ |
| **Test Cases** | 700+ |
| **Documentation Files** | 50+ |
| **Database Migrations** | 11 |
| **Supported Providers** | 16+ |
| **Available Models** | 1,500+ |
| **API Endpoints** | 50+ |

### Technology Stack:
- **Python**: 3.12+
- **FastAPI**: 0.104.1
- **Pydantic**: 2.5+
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis (with fallback)
- **Payments**: Stripe 13.0.1
- **Email**: Resend 0.8.0
- **Testing**: pytest 7.0+
- **Code Quality**: Ruff, Black, isort, MyPy

---

## 17. New Features Summary (Oct 2025)

### xAI Grok Integration (Commit 08eb7e9)
- Full streaming support
- Official SDK with OpenAI fallback
- Integration in chat and messages routes
- Grok model variants supported

### Near AI Integration (Commit 26e2b67)
- Decentralized AI infrastructure
- Full OpenAI compatibility
- Fallback model list
- Complete streaming support

### Vertex AI Enhancements (Commit 84d257c)
- Service account impersonation
- Stable Diffusion v1.5 endpoint
- Comprehensive testing toolkit

### Model Catalog Improvements
- Fallback lists for reliability
- Better error handling
- Cache warming on startup
- Improved provider detection

---

## 18. File Organization Summary

**Critical Path for Documentation Updates**:

1. **Main Docs to Update**:
   - `/root/repo/README.md` (540 lines) - Main project overview
   - `/root/repo/docs/README.md` - Documentation index
   - `/root/repo/docs/setup.md` - Setup guide
   - `/root/repo/docs/ENVIRONMENT_SETUP.md` - Configuration guide
   - `/root/repo/docs/CLAUDE.md` - Claude AI documentation

2. **Provider-Specific Docs**:
   - `/root/repo/docs/CHUTES_INTEGRATION.md`
   - `/root/repo/docs/FEATHERLESS_INTEGRATION.md`
   - `/root/repo/docs/HUGGINGFACE_INTEGRATION.md`
   - `/root/repo/docs/PORTKEY_TESTING_GUIDE.md`
   - (NEW) Add xAI integration guide
   - (NEW) Add Near AI integration guide

3. **API Documentation**:
   - `/root/repo/docs/RESPONSES_API.md`
   - `/root/repo/docs/MESSAGES_API.md`
   - `/root/repo/docs/CHAT_HISTORY_INTEGRATION.md`

4. **Testing Documentation**:
   - `/root/repo/tests/README.md` (180 lines)
   - `/root/repo/docs/TESTING.md`

5. **Operational Docs**:
   - `/root/repo/docs/DEPLOYMENT.md`
   - `/root/repo/docs/operations.md`
   - `/root/repo/docs/troubleshooting.md`

---

## Conclusion

The Gatewayz AI Gateway is a **mature, well-structured FastAPI application** with:

✅ Comprehensive multi-provider support (16+ providers)  
✅ Enterprise-grade security (encryption, RBAC, audit logging)  
✅ Advanced financial features (credits, subscriptions, coupons)  
✅ Full test coverage (700+ tests)  
✅ Extensive documentation  
✅ Active development (recent major features: xAI, Near AI, Vertex AI)  
✅ Production-ready deployment support (Vercel, Railway, Docker)  
✅ Scalable architecture (Redis caching, rate limiting, failover)  

The codebase is well-organized with clear separation of concerns, making it suitable for both documentation updates and future feature development.

