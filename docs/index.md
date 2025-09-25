# AI Gateway Documentation

Welcome to the AI Gateway documentation! This guide walks through setting up, deploying, and operating the AI Gateway API.

For a high-level overview of the project, see:

- [What is the AI Gateway?](introduction/what-is-gateway.md)
- [Key Features](introduction/key-features.md)
- [When to Use the AI Gateway](introduction/use-cases.md)

## Quick Start

1. **[Setup Guide](setup.md)** - Get started with local development
2. **[API Reference](api.md)** - Complete API documentation
3. **[Deployment](deployment.md)** - Deploy to production

## Documentation Overview

### Getting Started
- **[Setup Guide](setup.md)** - Complete setup instructions for local development
- **[Environment Configuration](environment.md)** - Environment variables and configuration
- **[Architecture](architecture.md)** - System architecture and design principles

### API Documentation
- **[API Reference](api.md)** - Complete API endpoint documentation
- **[Authentication](api.md#authentication)** - API key authentication and security
- **[Rate Limiting](api.md#rate-limiting)** - Rate limiting and usage controls
- **[Error Handling](api.md#error-codes)** - Error codes and troubleshooting
- **[Email Features](email-features.md)** - Professional email notifications and templates
- **[Frontend Key Generation](frontend-key-generation.md)** - Frontend implementation guide for API key generation

### Operations
- **[Operations Guide](operations.md)** - Monitoring, logging, and maintenance
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[Contributing](contributing.md)** - How to contribute to the project

### Deployment
- **[Deployment Guide](deployment.md)** - Production deployment instructions
- **[Platform Support](deployment.md)** - Vercel, Railway, Heroku, and more

## API Endpoints

### Public Endpoints
- `GET /health` - System health check
- `GET /models` - Available AI models
- `GET /models/providers` - Provider statistics with official URLs
- `GET /providers` - Available providers from OpenRouter

### User Endpoints
- `POST /create` - Create API key for dashboard users (sends welcome email)
- `POST /auth/password-reset` - Request password reset email
- `POST /auth/reset-password` - Reset password with token
- `GET /user/balance` - Account balance
- `GET /user/monitor` - Usage metrics
- `POST /user/api-keys` - API key management
- `POST /user/notifications/send-usage-report` - Send monthly usage report
- `POST /user/notifications/test` - Test notification templates
- `POST /v1/chat/completions` - AI chat completions

### Admin Endpoints
- `GET /admin/monitor` - System monitoring
- `POST /admin/add_credits` - Credit management
- `POST /admin/limit` - Rate limit configuration
- `GET /admin/notifications/stats` - Notification statistics

## Getting Help

### Documentation
- **API Documentation**: Interactive docs at `/docs` endpoint
- **Code Examples**: Working examples in all documentation
- **Troubleshooting**: Common issues and solutions

### Support
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Community**: Join the community for help and updates

## Version Information

- **Current Version**: 2.0.0
- **Python Version**: 3.11+
- **Framework**: FastAPI 0.104.1
- **Database**: Supabase (PostgreSQL)
- **AI Provider**: OpenRouter

## License

This project is licensed under the same license as the main repository.

---

**Need help getting started?** See the [Setup Guide](setup.md) for step-by-step instructions or head to the [API Reference](api.md) to explore the available endpoints.
