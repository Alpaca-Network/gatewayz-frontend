# Gatewayz AI Gateway - Quick Reference Guide

**Last Updated**: October 24, 2025  
**Version**: 2.0.3  
**Status**: Production-Ready

---

## Quick Links

- **Full Exploration Report**: [CODEBASE_EXPLORATION_REPORT.md](./CODEBASE_EXPLORATION_REPORT.md) (1,072 lines)
- **Main Documentation**: [README.md](README.md)
- **Setup Guide**: [setup.md](./setup.md)
- **Environment Configuration**: [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Testing Guide**: [TESTING.md](./TESTING.md)

---

## Directory Map

```
src/
├── main.py                    # FastAPI entry point
├── cache.py                   # Caching layer
├── config/                    # Configuration
│   ├── config.py              # Environment & providers
│   ├── db_config.py
│   ├── redis_config.py
│   └── supabase_config.py
├── db/                        # Database layer (16 modules)
│   ├── users.py              # User management
│   ├── api_keys.py           # API key management
│   ├── payments.py           # Payment tracking
│   └── ... (13 more)
├── routes/                    # API endpoints (25 files)
│   ├── chat.py               # Chat completions (1,302 lines)
│   ├── catalog.py            # Model catalog (1,906 lines)
│   ├── auth.py               # Authentication
│   ├── admin.py              # Admin operations
│   └── ... (20 more)
├── schemas/                   # Pydantic models (13 files)
├── services/                  # Business logic (40+ files)
│   ├── models.py             # Model catalog (2,026 lines)
│   ├── xai_client.py         # xAI integration [NEW]
│   ├── near_client.py        # Near AI integration [NEW]
│   └── ... (37 more)
├── security/                  # Security utilities
└── utils/                     # Helper functions

tests/                          # 700+ tests
├── db/                        # Database tests
├── routes/                    # Route tests
├── services/                  # Service tests
├── integration/               # Integration tests (23 files)
└── smoke/                     # Smoke tests

docs/                          # 50+ documentation files
supabase/                      # Database migrations (11)
scripts/                       # Utility scripts
```

---

## Provider Quick Reference

### Supported Providers (16+)

| Provider | Status | Models | Streaming | Config |
|----------|--------|--------|-----------|--------|
| xAI | NEW Oct 23 | 2+ | Yes | `XAI_API_KEY` |
| Near AI | NEW Oct 17 | 15+ | Yes | `NEAR_API_KEY` |
| Google Vertex | Active | Images | Yes | Service Account |
| OpenRouter | Active | 100+ | Yes | `OPENROUTER_API_KEY` |
| Portkey | Active | 100+ | Yes | `PORTKEY_API_KEY` |
| Featherless | Active | 50+ | Yes | `FEATHERLESS_API_KEY` |
| HuggingFace | Active | 1204+ | Yes | `HUG_API_KEY` |
| Groq | Active | 10+ | Yes | `GROQ_API_KEY` |
| Fireworks | Active | 30+ | Yes | `FIREWORKS_API_KEY` |
| Together | Active | 50+ | Yes | `TOGETHER_API_KEY` |
| DeepInfra | Active | 50+ | Yes | `DEEPINFRA_API_KEY` |
| Cerebras | Active | 5+ | Yes | `CEREBRAS_API_KEY` |
| Nebius | Active | 5+ | Yes | `NEBIUS_API_KEY` |
| Novita | Active | 30+ | Yes | `NOVITA_API_KEY` |
| AIMO | Active | 5+ | Yes | `AIMO_API_KEY` |
| Chutes | Active | 20+ | Yes | `CHUTES_API_KEY` |

**Total**: 16+ providers, 1,500+ models

### Provider Integration Pattern

All providers follow same interface:
```python
from src.services.<provider>_client import (
    get_<provider>_client,
    make_<provider>_request_openai,
    make_<provider>_request_openai_stream,
    process_<provider>_response
)
```

### Adding New Provider

1. Create `src/services/<provider>_client.py` with 4 functions above
2. Add provider cache in `src/cache.py`
3. Add configuration in `src/config/config.py`
4. Add model fetching in `src/services/models.py`
5. Add provider routing in `src/routes/chat.py`
6. Add environment variables to `.env.example`

---

## Core Features

### 1. Chat Completions (`/v1/chat/completions`)

**Features**:
- OpenAI-compatible interface
- Multi-provider support with failover
- Streaming and non-streaming
- Credit deduction
- Rate limiting
- Chat history injection

**File**: `src/routes/chat.py` (1,302 lines)

### 2. Model Catalog

**Features**:
- 1,500+ models from 16+ providers
- Per-provider caching (30min-1hr TTL)
- Fallback models for reliability
- Model details and pricing
- Provider statistics

**Files**:
- `src/services/models.py` (2,026 lines)
- `src/routes/catalog.py` (1,906 lines)

### 3. User Management

**Features**:
- User registration and profiles
- Credit system
- Trial management
- Subscription plans
- API key management (encrypted)

**Files**:
- `src/db/users.py`
- `src/routes/users.py`
- `src/routes/auth.py`
- `src/routes/api_keys.py`

### 4. Financial System

**Features**:
- Credit deduction per token usage
- Stripe integration
- Subscription plans
- Coupons and discounts
- Referral rewards
- Transaction ledger

**Files**:
- `src/services/payments.py`
- `src/services/referral.py`
- `src/services/pricing.py`
- `src/db/credit_transactions.py`

### 5. Rate Limiting

**Features**:
- Redis-based with in-memory fallback
- Per-user and per-key limits
- Token-based quotas
- Multiple time windows

**Files**:
- `src/services/rate_limiting.py`
- `src/services/rate_limiting_fallback.py`

### 6. Security

**Features**:
- Fernet encryption for API keys
- HMAC-SHA256 hashing
- Row-level database security
- Audit logging
- IP allowlists
- Domain restrictions

**Files**:
- `src/security/security.py`
- `src/db_security.py`

---

## Database Schema (Key Tables)

| Table | Purpose | Rows |
|-------|---------|------|
| `users` | User accounts with credits | Main table |
| `api_keys` | Encrypted API keys | Per user |
| `credit_transactions` | Credit ledger | Activity log |
| `payments` | Stripe records | Payment history |
| `chat_sessions` | Session metadata | Chat history |
| `rate_limit_usage` | Rate limit tracking | Activity |
| `user_plans` | Subscription plans | Per user |
| `coupons` | Discount codes | Catalog |
| `referrals` | Referral relationships | Engagement |
| `activity_logs` | API call logs | Audit trail |

**Migrations**: 11 files in `supabase/migrations/`

---

## Configuration

### Environment Variables (Essential)

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (Primary Provider)
OPENROUTER_API_KEY=sk-or-v1-...

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin
ADMIN_API_KEY=your-admin-key
ADMIN_EMAIL=admin@example.com
```

### Environment Variables (Provider Keys)

```env
# New Providers (Oct 2025)
XAI_API_KEY=sk-...
NEAR_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Other Providers
PORTKEY_API_KEY=...
FEATHERLESS_API_KEY=...
FIREWORKS_API_KEY=...
TOGETHER_API_KEY=...
GROQ_API_KEY=...
HUG_API_KEY=...
AIMO_API_KEY=...
NEBIUS_API_KEY=...
CEREBRAS_API_KEY=...
NOVITA_API_KEY=...
DEEPINFRA_API_KEY=...
CHUTES_API_KEY=...
```

### Environment Variables (Analytics & Optional)

```env
STATSIG_SERVER_SECRET_KEY=...
POSTHOG_API_KEY=...
POSTHOG_HOST=https://us.i.posthog.com

FRONTEND_URL=http://localhost:3000
APP_ENV=development
```

---

## Testing

### Test Coverage

- **Total Tests**: 700+
- **Database Tests**: 12 files
- **Route Tests**: 14 files (2,600+ lines)
- **Service Tests**: 13 files
- **Integration Tests**: 23 files
- **Coverage Target**: 80%+

### Running Tests

```bash
# All tests
pytest tests/

# Specific category
pytest tests/db/
pytest tests/routes/
pytest tests/integration/

# With coverage
pytest --cov=src --cov-report=html

# Specific test
pytest tests/routes/test_auth.py::test_user_registration
```

### Key Test Files

- `tests/routes/test_auth.py`: 55+ tests
- `tests/routes/test_api_keys.py`: 40+ tests
- `tests/routes/test_users.py`: 40+ tests
- `tests/routes/test_payments.py`: 30+ tests
- `tests/db/test_coupons.py`: 60+ tests
- `tests/db/test_trials.py`: 40+ tests
- `tests/integration/test_model_inference.py`: Provider testing

---

## Recent Features (October 2025)

### 1. xAI Grok Integration (Oct 23)
**PR #30** - Full Grok model support
- File: `src/services/xai_client.py` (110 lines)
- Official SDK with OpenAI fallback
- Full streaming support
- Integration in chat routes

### 2. Fallback Model Lists (Oct 23)
**PR #28** - Reliability improvements
- xAI fallback: `grok-beta`, `grok-vision-beta`
- Near AI fallback: Multiple models
- Cache fallback when APIs unavailable

### 3. Vertex AI Testing Toolkit (Oct 18)
**PR #26** - Google Cloud integration
- Service account impersonation
- Stable Diffusion v1.5 endpoint
- Production testing support

### 4. Near AI Integration (Oct 17)
**PR #23** - Decentralized AI
- File: `src/services/near_client.py` (100 lines)
- OpenAI-compatible interface
- Full streaming support

### 5. Direct Provider APIs (Oct 16)
**PR #25** - Improved reliability
- Moved from Portkey filtering
- Official SDKs where available
- Better model coverage

---

## Documentation Files

### Setup & Configuration
- `setup.md` - Local development
- `ENVIRONMENT_SETUP.md` - Environment variables
- `DEPLOYMENT.md` - Production deployment
- `DEPLOYMENT_QUICK_REFERENCE.md` - Quick checklist

### API Documentation
- `RESPONSES_API.md` - Response API
- `MESSAGES_API.md` - Messages API
- `CHAT_HISTORY_INTEGRATION.md` - Chat history

### Provider Setup
- `CHUTES_INTEGRATION.md`
- `FEATHERLESS_INTEGRATION.md`
- `HUGGINGFACE_INTEGRATION.md`
- `PORTKEY_TESTING_GUIDE.md`
- `GOOGLE_VERTEX_SETUP.md`
- `TEST_VERTEX_ENDPOINT.md`

### Features
- `STRIPE.md` - Stripe integration
- `REFERRAL_SYSTEM.md` - Referral program
- `ACTIVITY_LOGGING.md` - Activity tracking

### Operations
- `TESTING.md` - Testing guide
- `operations.md` - Monitoring and maintenance
- `troubleshooting.md` - Common issues
- `QUICK_TEST.md` - Quick start testing

---

## Key Metrics

### Codebase
- **Python Files**: 100+
- **Services Code**: 11K+ lines
- **Routes Code**: 9,600+ lines
- **Test Code**: 700+ tests
- **Documentation**: 50+ files

### Application
- **API Endpoints**: 50+
- **Database Tables**: 15+
- **Supported Providers**: 16+
- **Available Models**: 1,500+
- **Response Time**: <100ms average

### Infrastructure
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis (with fallback)
- **Encryption**: Fernet (AES-128)
- **Deployment**: Vercel, Railway, Docker
- **Test Framework**: pytest

---

## Quick Start

### Local Development

```bash
# Clone and setup
git clone <repo>
cd repo
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run application
python src/main.py

# In another terminal, run tests
pytest tests/
```

### Deployment

**Vercel** (Recommended):
```bash
vercel --prod
```

**Railway**:
```bash
railway up
```

**Docker**:
```bash
docker build -t gatewayz .
docker run -p 8000:8000 --env-file .env gatewayz
```

---

## Performance Notes

### Caching
- Model catalog: 30min-1hr TTL per provider
- Warm cache on startup
- Fallback lists when APIs unavailable
- Per-provider independent caches

### Rate Limiting
- Redis if available
- In-memory fallback
- Per-user and per-key limits
- Multiple time windows

### Database
- Connection pooling
- Row-level security
- Indexed queries
- Async operations

---

## Common Tasks

### Add a New Provider

1. Create client: `src/services/<provider>_client.py`
2. Add cache: `src/cache.py`
3. Add config: `src/config/config.py`
4. Add models fetch: `src/services/models.py`
5. Add routing: `src/routes/chat.py`
6. Update `.env.example`

### Add a New Route

1. Create file: `src/routes/feature.py`
2. Define `router = APIRouter()`
3. Add endpoints with dependencies
4. Include in `src/main.py`
5. Add tests: `tests/routes/test_feature.py`

### Update Documentation

1. Check `docs/` directory
2. Update relevant files
3. Update table of contents
4. Cross-reference related docs

---

## Support & Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Full guides in `docs/` directory
- **API Reference**: Auto-generated at `/docs` endpoint
- **Troubleshooting**: See `troubleshooting.md`
- **Testing**: See `TESTING.md`

---

**Version**: 2.0.3  
**Last Updated**: October 24, 2025  
**Status**: Production-Ready  
**Maintainer**: Gatewayz Team
