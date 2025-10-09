# AI Gateway Documentation

Welcome to the AI Gateway documentation! This guide walks through setting up, deploying, and operating the AI Gateway API.

The AI Gateway is a production-ready FastAPI application that provides a unified interface for accessing multiple AI models through various providers (OpenRouter, Portkey, Featherless, Chutes), with comprehensive credit management, rate limiting, and security features.

## 🚀 Quick Start

1. **[Setup Guide](setup.md)** - Get started with local development
2. **[API Reference](api.md)** - Complete API documentation  
3. **[Architecture](architecture.md)** - System architecture overview

## 📚 Documentation Overview

### Getting Started
- **[Setup Guide](setup.md)** - Complete setup instructions for local development
- **[Architecture](architecture.md)** - System architecture and design principles
- **[Project Structure](project-structure.md)** - Detailed project organization
- **[Environment Configuration](environment.md)** - Environment variables and configuration

### API Documentation
- **[API Reference](api.md)** - Complete API endpoint documentation
- **[Authentication](api.md#authentication)** - API key authentication and security
- **[Rate Limiting](api.md#rate-limiting)** - Rate limiting and usage controls
- **[Error Handling](api.md#error-codes)** - Error codes and troubleshooting
- **[Email Features](email-features.md)** - Professional email notifications and templates
- **[Privy Authentication](privy-authentication.md)** - Privy authentication integration

### Operations
- **[Operations Guide](operations.md)** - Monitoring, logging, and maintenance
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[Contributing](contributing.md)** - How to contribute to the project

### Deployment
- **[Deployment Guide](deployment.md)** - Production deployment instructions
- **[Platform Support](deployment.md)** - Vercel, Railway, Heroku, and more

## 🏗️ System Overview

### Core Features
- **Multi-Provider Support**: OpenRouter, Portkey, Featherless, Chutes
- **Unified API**: OpenAI-compatible endpoints
- **Credit Management**: Token-based billing with automatic deduction
- **Rate Limiting**: Per-user and per-key rate limiting
- **Security**: Encrypted API key storage, IP allowlists, domain restrictions
- **Free Trials**: 3-day free trials with $10 credits
- **Subscription Plans**: Flexible subscription management with Stripe
- **Chat History**: Persistent chat session management
- **Image Generation**: AI-powered image generation
- **Model Ranking**: Dynamic model ranking and discovery

### Technology Stack
- **Backend**: FastAPI 0.104.1
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis (optional)
- **Payments**: Stripe
- **Email**: Resend
- **Deployment**: Vercel, Railway, Docker, Kubernetes

## 📋 API Endpoints

### Public Endpoints
- `GET /health` - System health check
- `GET /ping` - Ping service with statistics
- `GET /models` - Available AI models
- `GET /models/providers` - Provider statistics
- `GET /ranking/models` - Model ranking data

### Authentication
- `POST /auth/privy` - Privy authentication
- `GET /user/balance` - User credit balance

### Chat Completions
- `POST /v1/chat/completions` - OpenAI-compatible chat completions
- `POST /v1/responses` - Unified response API
- `POST /images/generate` - Image generation

### API Key Management
- `POST /user/api-keys` - Create API key
- `GET /user/api-keys` - List API keys
- `PUT /user/api-keys/{key_id}` - Update API key
- `DELETE /user/api-keys/{key_id}` - Delete API key

### Subscription Management
- `GET /plans` - List subscription plans
- `GET /user/plan` - Get user's current plan
- `POST /trials/start` - Start free trial

## 🔧 Configuration

### Required Environment Variables
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENROUTER_API_KEY=your_openrouter_api_key
SECRET_KEY=your_secret_key_for_encryption
ADMIN_API_KEY=your_admin_api_key
```

### Optional Environment Variables
```env
PORTKEY_API_KEY=your_portkey_api_key
FEATHERLESS_API_KEY=your_featherless_api_key
CHUTES_API_KEY=your_chutes_api_key
RESEND_API_KEY=your_resend_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
REDIS_URL=redis://localhost:6379
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Railway
Connect your GitHub repository and deploy automatically.

### Docker
```bash
docker build -t ai-gateway .
docker run -p 8000:8000 ai-gateway
```

## 🔒 Security

### API Key Security
- **Encryption**: Fernet encryption for sensitive data
- **Hashing**: HMAC-SHA256 for key validation
- **Rotation**: Automatic key rotation capabilities
- **Scope Permissions**: Granular permission system

### Authentication & Authorization
- **Bearer Token**: HTTP Authorization header
- **Multi-Provider**: Support for multiple AI providers
- **Rate Limiting**: Per-key and per-user limits
- **IP Allowlists**: IP-based access control

## 📊 Monitoring

### Health Checks
- `GET /health` - Basic health check
- `GET /ping` - Ping with statistics
- `GET /admin/monitor` - System monitoring (admin only)

### Metrics
- Request/response times
- Error rates
- Usage statistics
- Security events

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

See [Contributing Guide](contributing.md) for detailed instructions.

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/api-gateway-vercel/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/api-gateway-vercel/discussions)
- **Email**: support@yourdomain.com
