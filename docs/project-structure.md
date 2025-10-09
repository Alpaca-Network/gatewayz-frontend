# Project Structure

This document provides a detailed overview of the AI Gateway project structure and organization.

## Root Directory

```
gateway/
├── README.md                           # Project overview and quick start
├── main.py                            # Entry point for local development
├── requirements.txt                   # Python dependencies
├── vercel.json                       # Vercel deployment configuration
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── src/                              # Source code directory
├── docs/                             # Documentation
├── tests/                            # Test files
└── migrations/                       # Database migrations
```

## Source Code Structure (`src/`)

### Core Application Files

```
src/
├── main.py                           # FastAPI application entry point
├── config.py                         # Configuration management
├── models.py                         # Legacy models (being phased out)
├── supabase_config.py               # Database configuration
├── db_security.py                   # Security utilities
├── enhanced_notification_service.py # Email service
├── redis_config.py                  # Redis configuration
└── cache.py                         # Caching utilities
```

### Database Layer (`src/db/`)

The database layer contains all database operations and data access functions:

```
src/db/
├── __init__.py                       # Package initialization
├── api_keys.py                      # API key management
├── users.py                         # User management
├── plans.py                         # Subscription plans
├── payments.py                      # Payment processing
├── ranking.py                       # Model ranking system
├── rate_limits.py                   # Rate limiting
├── trials.py                        # Free trial management
├── chat_history.py                  # Chat session management
├── coupons.py                       # Coupon system
├── roles.py                         # Role-based access control
├── activity.py                      # Activity tracking
├── credit_transactions.py           # Credit management
├── referral.py                      # Referral system
└── ping.py                          # Ping service
```

### API Routes (`src/routes/`)

The routes directory contains all API endpoints organized by functionality:

```
src/routes/
├── __init__.py                       # Package initialization
├── health.py                        # Health check endpoints
├── ping.py                          # Ping service endpoints
├── chat.py                          # Chat completions
├── catalog.py                       # Model catalog
├── auth.py                          # Authentication
├── users.py                         # User management
├── api_keys.py                      # API key management
├── admin.py                         # Admin operations
├── plans.py                         # Subscription plans
├── payments.py                      # Payment processing
├── ranking.py                       # Model ranking
├── notifications.py                 # Notifications
├── chat_history.py                  # Chat history
├── images.py                        # Image generation
├── coupons.py                       # Coupon management
├── roles.py                         # Role management
├── activity.py                      # Activity tracking
├── audit.py                         # Audit logs
└── referral.py                      # Referral system
```

### Data Models (`src/schemas/`)

Pydantic models for request/response validation:

```
src/schemas/
├── __init__.py                       # Centralized exports
├── common.py                        # Common enums and types
├── auth.py                          # Authentication models
├── users.py                         # User models
├── api_keys.py                      # API key models
├── plans.py                         # Plan models
├── payments.py                      # Payment models
├── trials.py                        # Trial models
├── admin.py                         # Admin models
├── proxy.py                         # Proxy request models
├── chat.py                          # Chat models
├── coupons.py                       # Coupon models
└── notification.py                  # Notification models
```

### Security Layer (`src/security/`)

Security utilities and dependencies:

```
src/security/
├── __init__.py                       # Package initialization
├── security.py                      # Security utilities
└── deps.py                          # Security dependencies
```

### Business Logic Services (`src/services/`)

Business logic and external service integrations:

```
src/services/
├── __init__.py                       # Package initialization
├── openrouter_client.py             # OpenRouter integration
├── portkey_client.py                # Portkey integration
├── featherless_client.py            # Featherless integration
├── image_generation_client.py       # Image generation
├── payments.py                      # Payment processing
├── notification.py                  # Notification service
├── rate_limiting.py                 # Rate limiting
├── trial_service.py                 # Trial management
├── trial_validation.py              # Trial validation
├── professional_email_templates.py  # Email templates
├── analytics.py                     # Analytics
├── pricing.py                       # Pricing calculations
├── providers.py                     # Provider management
├── referral.py                      # Referral system
├── rate_limiting_fallback.py        # Fallback rate limiting
└── models.py                        # Model management
```

### Trial Management (`src/trials/`)

Trial-specific modules:

```
src/trials/
└── __pycache__/                     # Python cache files
```

### Utility Functions (`src/utils/`)

Utility functions and helpers:

```
src/utils/
├── __pycache__/                     # Python cache files
└── reset_welcome_emails.py          # Email reset utility
```

### Data Files (`src/data/`)

Static data and configuration files:

```
src/data/
└── chutes_catalog.json              # Chutes model catalog
```

## Documentation Structure (`docs/`)

```
docs/
├── index.md                         # Documentation index
├── architecture.md                  # System architecture
├── api.md                          # API reference
├── setup.md                        # Setup guide
├── deployment.md                   # Deployment guide
├── project-structure.md            # This file
├── contributing.md                 # Contributing guide
├── troubleshooting.md              # Troubleshooting guide
├── operations.md                   # Operations guide
├── email-features.md               # Email features
├── privy-authentication.md         # Privy auth guide
├── provider-assets-solution.md     # Provider assets
├── provider-models-api.md          # Provider models API
├── requirements.txt                # Documentation dependencies
├── mkdocs.yml                      # MkDocs configuration
├── readthedocs.yaml                # ReadTheDocs configuration
└── introduction/                   # Introduction docs
    ├── what-is-gateway.md          # What is the gateway
    ├── key-features.md             # Key features
    └── use-cases.md                # Use cases
```

## Test Structure (`tests/`)

```
tests/
├── test_app.py                      # Main application tests
├── test_api.py                      # API endpoint tests
├── test_auth.py                     # Authentication tests
├── test_models.py                   # Model tests
├── test_payments.py                 # Payment tests
├── test_trials.py                   # Trial tests
├── conftest.py                      # Test configuration
├── fixtures/                        # Test fixtures
├── mocks/                           # Mock objects
└── integration/                     # Integration tests
```

## Configuration Files

### Environment Configuration
- `.env.example` - Environment variables template
- `.env` - Local environment variables (not in git)

### Deployment Configuration
- `vercel.json` - Vercel deployment configuration
- `Dockerfile` - Docker container configuration
- `docker-compose.yml` - Docker Compose configuration
- `k8s/` - Kubernetes deployment files

### Development Configuration
- `requirements.txt` - Python dependencies
- `pyproject.toml` - Python project configuration
- `.pre-commit-config.yaml` - Pre-commit hooks
- `tox.ini` - Tox configuration

## Database Schema

### Core Tables
- `users` - User accounts and profiles
- `api_keys` - Legacy API key storage
- `api_keys_new` - Enhanced API key system
- `plans` - Subscription plans
- `user_plans` - User plan assignments
- `usage_records` - Usage tracking
- `rate_limit_configs` - Rate limiting
- `trial_records` - Free trial management
- `payment_records` - Payment history
- `coupons` - Discount codes
- `referrals` - Referral tracking
- `chat_sessions` - Chat history
- `latest_models` - Model ranking data
- `openrouter_models` - OpenRouter model data
- `audit_logs` - Security audit logs

## File Naming Conventions

### Python Files
- **Snake case**: `user_management.py`
- **Descriptive names**: `api_key_validation.py`
- **Module prefixes**: `db_`, `route_`, `schema_`

### Configuration Files
- **Dot notation**: `.env`, `.gitignore`
- **Service names**: `vercel.json`, `docker-compose.yml`
- **Descriptive names**: `requirements.txt`

### Documentation Files
- **Kebab case**: `project-structure.md`
- **Descriptive names**: `api-reference.md`
- **Consistent naming**: All docs in `docs/`

## Import Organization

### Standard Library Imports
```python
import os
import sys
from datetime import datetime
from typing import Optional, Dict, Any
```

### Third-Party Imports
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
```

### Local Imports
```python
from src.db.users import get_user
from src.schemas.auth import AuthRequest
from src.security.deps import get_api_key
```

## Code Organization Principles

### Single Responsibility
Each module has a single, well-defined responsibility:
- `users.py` - User management only
- `api_keys.py` - API key management only
- `payments.py` - Payment processing only

### Separation of Concerns
- **Routes**: Handle HTTP requests/responses
- **Database**: Handle data persistence
- **Schemas**: Handle data validation
- **Services**: Handle business logic
- **Security**: Handle authentication/authorization

### Dependency Injection
- Use FastAPI's dependency injection system
- Avoid circular imports
- Keep dependencies minimal

### Error Handling
- Consistent error response format
- Proper HTTP status codes
- Detailed error logging
- User-friendly error messages

## Development Workflow

### Adding New Features
1. **Create database models** in `src/schemas/`
2. **Add database functions** in `src/db/`
3. **Create API endpoints** in `src/routes/`
4. **Add business logic** in `src/services/`
5. **Write tests** in `tests/`
6. **Update documentation** in `docs/`

### Code Quality
- **Type hints**: Use type hints throughout
- **Docstrings**: Document all functions and classes
- **Linting**: Use flake8, black, isort
- **Testing**: Write comprehensive tests
- **Coverage**: Maintain high test coverage

### Version Control
- **Feature branches**: Use feature branches for development
- **Commit messages**: Use conventional commit format
- **Pull requests**: Review all changes before merging
- **Tags**: Tag releases with semantic versioning

## Deployment Structure

### Development
- Local development with hot reload
- SQLite for local database
- Mock external services

### Staging
- Production-like environment
- Real external services
- Test data and users

### Production
- Optimized for performance
- Real external services
- Production data and users
- Monitoring and alerting

## Monitoring and Logging

### Logging Structure
- **Application logs**: Application events and errors
- **Access logs**: HTTP request/response logs
- **Security logs**: Authentication and authorization events
- **Audit logs**: User actions and system changes

### Monitoring
- **Health checks**: System health monitoring
- **Performance metrics**: Response times and throughput
- **Error tracking**: Error rates and types
- **Usage analytics**: User behavior and patterns

This structure provides a solid foundation for a scalable, maintainable AI Gateway application.
