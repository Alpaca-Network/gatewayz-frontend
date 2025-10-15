# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready FastAPI application that provides a credit-metered API gateway for AI models via Gatewayz, with enterprise-grade security features, user management, and comprehensive audit logging.

## Commands

### Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run the application locally
uvicorn app:app --reload

# Run tests
pytest tests/
```

### Deployment
The application is optimized for Vercel deployment using `vercel.json` configuration. See `DEPLOYMENT.md` for platform-specific deployment instructions.

## Architecture

### Core Files Structure
- `app.py` - Main FastAPI application with all endpoints and middleware
- `db.py` - Database operations and Supabase client interactions
- `models.py` - Pydantic models for request/response schemas
- `config.py` - Configuration management and environment variable handling
- `security.py` - Security manager and audit logging functionality
- `supabase_config.py` - Supabase client configuration

### Key Components
- `rate_limiting.py` & `rate_limiting_fallback.py` - Rate limiting with Redis and fallback mechanisms
- `notification_service.py` & `notification_models.py` - Notification system with multiple channels
- `trial_service.py` & `trial_models.py` - Trial management and conversion system
- `db_security.py` - Database security operations

### Database
- Uses Supabase as the primary database
- Main table: `users` with comprehensive user management
- API keys are encrypted using Fernet (AES 128) encryption
- Supports multiple API keys per user with different environments (live, test, staging, dev)

### Authentication & Security
- Bearer token authentication using API keys
- Multi-key system with custom names and permissions
- Encrypted key storage with hash-based validation
- IP allowlist and domain restrictions
- Comprehensive audit logging
- Key rotation capabilities

### Rate Limiting
- Redis-based rate limiting with fallback mechanisms
- Configurable limits per user (minute/hour/day windows)
- System-wide rate limit monitoring and alerts

### Credit System
- Token-based credit deduction system
- Real-time balance checking
- Plan-based usage limits and entitlements
- Trial system with automatic conversion

## Environment Variables

Required environment variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `OPENROUTER_API_KEY` - OpenRouter API key for AI model access

Optional:
- `OPENROUTER_SITE_URL` - Site URL for rankings
- `OPENROUTER_SITE_NAME` - Site name for rankings
- `ADMIN_API_KEY` - Admin authentication key

## API Structure

### Public Endpoints
- Health check and model information endpoints

### User Endpoints
- Registration, profile management, balance checking
- API key CRUD operations with advanced security
- Usage statistics and audit logs

### AI Service Endpoints
- `/v1/chat/completions` - Chat completion with credit deduction

### Admin Endpoints
- User management, credit management, system monitoring
- Rate limit configuration, plan assignment

## Testing

- Test files located in `tests/` directory
- Uses pytest with FastAPI TestClient
- Mock responses for external API calls
- Database tests use temporary SQLite database

## Key Design Patterns

- Modular architecture with clear separation of concerns
- Comprehensive error handling with detailed logging
- Async/await pattern throughout for performance
- Security-first approach with encrypted storage
- Enterprise-ready with audit trails and monitoring

## Development Notes

- The application uses a monolithic structure in `app.py` with modular imports
- Database operations are centralized in `db.py`
- All user-facing models are defined in `models.py`
- Security features are fully integrated across all endpoints
- Rate limiting is implemented at multiple levels with fallback mechanisms