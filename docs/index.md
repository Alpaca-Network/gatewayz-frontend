# AI Gateway Documentation

Welcome to the AI Gateway documentation! This comprehensive guide covers everything you need to know about setting up, deploying, and operating the AI Gateway API.

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

### Operations
- **[Operations Guide](operations.md)** - Monitoring, logging, and maintenance
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[Contributing](contributing.md)** - How to contribute to the project

### Deployment
- **[Deployment Guide](deployment.md)** - Production deployment instructions
- **[Platform Support](deployment.md)** - Vercel, Railway, Heroku, and more

## Key Features

### Core Functionality
- **Multi-Model AI Access**: Access to multiple AI models through OpenRouter
- **Credit Management**: Token-based credit system with usage tracking
- **Rate Limiting**: Comprehensive rate limiting and plan enforcement
- **API Key Management**: Secure API key creation, rotation, and management

### Security Features
- **Phase 4 Security**: IP allowlists, domain restrictions, key rotation
- **Audit Logging**: Comprehensive security event tracking
- **Authentication**: Multi-layer API key validation
- **Authorization**: Fine-grained permission controls

### Monitoring & Analytics
- **Real-time Monitoring**: System health and performance metrics
- **Usage Analytics**: Detailed usage tracking and reporting
- **Admin Dashboard**: System-wide monitoring and management
- **Health Checks**: Automated health monitoring and alerting

## API Endpoints

### Public Endpoints
- `GET /health` - System health check
- `GET /models` - Available AI models
- `GET /models/providers` - Provider statistics

### User Endpoints
- `POST /auth/register` - User registration
- `GET /user/balance` - Account balance
- `GET /user/monitor` - Usage metrics
- `POST /user/api-keys` - API key management
- `POST /v1/chat/completions` - AI chat completions

### Admin Endpoints
- `GET /admin/monitor` - System monitoring
- `POST /admin/add_credits` - Credit management
- `POST /admin/limit` - Rate limit configuration

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

**Need help getting started?** Check out the [Setup Guide](setup.md) for step-by-step instructions, or jump straight to the [API Reference](api.md) to explore the available endpoints.
