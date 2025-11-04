# AI Gateway - Universal Inference API

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.1-blue)](https://github.com/your-org/api-gateway-vercel)

A production-ready, enterprise-grade FastAPI application that provides a unified interface for accessing multiple AI models through various providers (OpenRouter, Portkey, Featherless, Chutes), with comprehensive credit management, rate limiting, and security features.

## 🎯 Overview

**AI Gateway (Gatewayz)** is a powerful API gateway that simplifies AI model access across multiple providers. It provides:

- **Universal API**: OpenAI-compatible endpoints for seamless integration
- **Multi-Provider Support**: Access 100+ AI models from OpenRouter, Portkey, Featherless, and Chutes
- **Smart Credit Management**: Token-based billing with automatic credit deduction and tracking
- **Enterprise Security**: Encrypted API keys, IP allowlists, domain restrictions, and comprehensive audit logging
- **Advanced Features**: Rate limiting, free trials, subscription plans, chat history, image generation, and more

## ✨ Key Features

### Core Capabilities
- 🤖 **Multi-Provider Support** - Access models from OpenRouter, Portkey, Featherless, and Chutes
- 🔌 **OpenAI-Compatible API** - Drop-in replacement for OpenAI API with extended functionality
- 💳 **Credit Management** - Flexible token-based billing with automatic deduction
- 🛡️ **Enterprise Security** - Encrypted API key storage, IP allowlists, domain restrictions
- 📊 **Rate Limiting** - Per-user and per-key rate limiting with Redis support
- 🎁 **Free Trials** - 3-day free trials with $10 credits for new users
- 💰 **Subscription Plans** - Flexible subscription management with Stripe integration
- 💬 **Chat History** - Persistent chat session management with automatic history injection
- 🎨 **Image Generation** - AI-powered image generation capabilities
- 📈 **Model Ranking** - Dynamic model ranking and discovery system

### Advanced Features
- 📝 **Audit Logging** - Comprehensive security event tracking and compliance
- 📊 **Analytics Dashboard** - Real-time usage analytics and monitoring
- 🎫 **Coupon System** - Discount codes and promotion management
- 🤝 **Referral System** - User referral tracking and rewards
- 👥 **Role-Based Access** - Admin, user, and custom role management
- 📧 **Email Notifications** - Professional email templates and automated delivery
- 🔗 **Webhook Support** - Stripe webhook integration for payment processing
- 🔑 **API Key Management** - Create, update, rotate, and manage multiple API keys
- ⏱️ **Trial Management** - Free trial tracking, usage monitoring, and conversion

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- Supabase account ([sign up](https://supabase.com))
- OpenRouter API key ([get one](https://openrouter.ai))
- (Optional) Redis for caching and rate limiting

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/api-gateway-vercel.git
   cd api-gateway-vercel/gateway
   ```

2. **Create and activate virtual environment**:
   ```bash
   python -m venv .venv
   
   # On Windows:
   .venv\Scripts\activate
   
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Required environment variables:
   ```env
   # Database
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # API Providers
   OPENROUTER_API_KEY=your_openrouter_api_key
   
   # Security
   SECRET_KEY=your_secret_key_for_encryption
   ADMIN_API_KEY=your_admin_api_key
   ```

5. **Run the application**:
   ```bash
   python src/main.py
   ```

The API will be available at `http://localhost:8000`

### Verify Installation

```bash
# Check health status
curl http://localhost:8000/health

# View API documentation
open http://localhost:8000/docs

# List available models
curl http://localhost:8000/models
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

### Getting Started
- **[Setup Guide](setup.md)** - Complete setup instructions for local development
- **[Architecture](architecture.md)** - System architecture and design principles
- **[Project Structure](project-structure.md)** - Detailed project organization
- **[Environment Configuration](environment.md)** - Environment variables and configuration

### API Documentation
- **[API Reference](api.md)** - Complete API endpoint documentation
- **[Authentication](privy-authentication.md)** - API key authentication and Privy integration
- **[Chat Completions](CHAT_HISTORY_INTEGRATION.md)** - Chat completions with history management
- **[Responses API](RESPONSES_API.md)** - Unified response API documentation
- **[Image Generation](api.md#image-generation)** - AI image generation endpoints

### Feature Guides
- **[Referral System](REFERRAL_SYSTEM.md)** - Referral tracking and rewards
- **[Coupon System](api.md#coupons)** - Discount codes and promotions
- **[Email Features](email-features.md)** - Email notifications and templates
- **[Stripe Integration](STRIPE.md)** - Payment processing and subscriptions
- **[Activity Logging](ACTIVITY_LOGGING.md)** - Activity tracking and analytics

### Provider Integration
- **[Chutes Integration](CHUTES_INTEGRATION.md)** - Chutes provider setup
- **[Featherless Integration](FEATHERLESS_INTEGRATION.md)** - Featherless provider setup
- **[Portkey Testing](PORTKEY_TESTING_GUIDE.md)** - Portkey provider testing

### Operations
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Operations Guide](operations.md)** - Monitoring, logging, and maintenance
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[Contributing](contributing.md)** - How to contribute to the project

## 🏗️ Architecture

The application follows a modular, production-ready architecture:

```
gateway/
├── src/
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration management
│   ├── db/                     # Database layer
│   │   ├── users.py            # User management
│   │   ├── api_keys.py         # API key management
│   │   ├── plans.py            # Subscription plans
│   │   ├── payments.py         # Payment processing
│   │   ├── chat_history.py     # Chat sessions
│   │   ├── coupons.py          # Coupon system
│   │   ├── referral.py         # Referral system
│   │   └── ...                 # Other database modules
│   ├── routes/                 # API endpoints
│   │   ├── chat.py             # Chat completions
│   │   ├── auth.py             # Authentication
│   │   ├── users.py            # User management
│   │   ├── admin.py            # Admin operations
│   │   ├── payments.py         # Payment processing
│   │   └── ...                 # Other routes
│   ├── schemas/                # Pydantic models
│   │   ├── auth.py             # Authentication schemas
│   │   ├── chat.py             # Chat schemas
│   │   ├── payments.py         # Payment schemas
│   │   └── ...                 # Other schemas
│   ├── security/               # Security utilities
│   │   ├── security.py         # Encryption and hashing
│   │   └── deps.py             # Security dependencies
│   ├── services/               # Business logic
│   │   ├── openrouter_client.py  # OpenRouter integration
│   │   ├── portkey_client.py     # Portkey integration
│   │   ├── featherless_client.py # Featherless integration
│   │   ├── payments.py           # Payment service
│   │   ├── pricing.py            # Pricing calculations
│   │   └── ...                   # Other services
│   └── utils/                  # Utility functions
├── tests/                      # Test suite
├── docs/                       # Documentation
├── supabase/                   # Supabase migrations
├── requirements.txt            # Python dependencies
└── vercel.json                 # Vercel configuration
```

### Technology Stack
- **Backend**: FastAPI 0.104.1 (modern, fast web framework)
- **Database**: Supabase (PostgreSQL with real-time features)
- **Validation**: Pydantic 2.5.0 (data validation and serialization)
- **Caching**: Redis 5.0.1 (optional, for rate limiting)
- **Payments**: Stripe 13.0.1 (payment processing)
- **Email**: Resend 0.8.0 (email delivery service)
- **Authentication**: Privy & custom API key system
- **Security**: Cryptography 41.0.7 (Fernet encryption, HMAC hashing)

## 🔌 API Endpoints

### Public Endpoints
```
GET  /                          # Welcome page
GET  /health                    # Health check
GET  /ping                      # Ping with statistics
GET  /models                    # List available AI models
GET  /models/providers          # Provider statistics
GET  /ranking/models            # Model rankings
```

### Authentication
```
POST /auth/privy                # Privy authentication
GET  /user/balance              # User credit balance
POST /user/api-keys             # Create API key
GET  /user/api-keys             # List API keys
PUT  /user/api-keys/{key_id}    # Update API key
DELETE /user/api-keys/{key_id}  # Delete API key
```

### Chat Completions (OpenAI-Compatible)
```
POST /v1/chat/completions       # Chat completions
POST /v1/responses              # Unified response API
POST /images/generate           # Image generation
```

### Chat History
```
POST   /chat/sessions           # Create session
GET    /chat/sessions           # List sessions
GET    /chat/sessions/{id}      # Get session
DELETE /chat/sessions/{id}      # Delete session
POST   /chat/sessions/{id}/messages  # Add message
```

### Subscription Management
```
GET  /plans                     # List plans
GET  /plans/{plan_id}           # Get plan details
GET  /user/plan                 # User's current plan
POST /trials/start              # Start free trial
GET  /trials/status             # Trial status
```

### Admin Endpoints
```
POST /admin/create              # Create user
GET  /admin/monitor             # System monitoring
POST /admin/add_credits         # Add user credits
GET  /admin/usage               # Usage analytics
POST /admin/rate-limits         # Set rate limits
GET  /admin/audit-logs          # Audit logs
```

See the [API Reference](api.md) for complete documentation.

## 💡 Usage Examples

### Chat Completion

```python
import requests

response = requests.post(
    "https://your-gateway.vercel.app/v1/chat/completions",
    headers={
        "Authorization": "Bearer gw_live_your_api_key_here",
        "Content-Type": "application/json"
    },
    json={
        "model": "openai/gpt-4",
        "messages": [
            {"role": "user", "content": "Hello, how are you?"}
        ]
    }
)

print(response.json())
```

### Image Generation

```python
import requests

response = requests.post(
    "https://your-gateway.vercel.app/images/generate",
    headers={
        "Authorization": "Bearer gw_live_your_api_key_here",
        "Content-Type": "application/json"
    },
    json={
        "prompt": "A beautiful sunset over mountains",
        "model": "dall-e-3"
    }
)

print(response.json())
```

### Check Balance

```python
import requests

response = requests.get(
    "https://your-gateway.vercel.app/user/balance",
    headers={
        "Authorization": "Bearer gw_live_your_api_key_here"
    }
)

print(f"Balance: ${response.json()['credits']}")
```

## 🔒 Security

### API Key Security
- **Encryption**: Fernet encryption for sensitive data storage
- **Hashing**: HMAC-SHA256 for secure key validation
- **Key Rotation**: Automatic key rotation capabilities
- **Scope Permissions**: Granular permission system for API keys
- **Expiration**: Time-based key expiration support
- **Prefix System**: Environment-specific key prefixes (`gw_live_`, `gw_test_`, `gw_staging_`, `gw_dev_`)

### Authentication & Authorization
- **Bearer Token**: Standard HTTP Authorization header
- **Multi-Provider**: Support for multiple authentication methods
- **Rate Limiting**: Per-key and per-user request limits
- **IP Allowlists**: Restrict API key usage to specific IPs
- **Domain Restrictions**: Referer-based access control
- **Role-Based Access**: Admin, user, and custom roles

### Audit & Monitoring
- **Comprehensive Logging**: All API interactions logged
- **Security Events**: Failed authentication attempts tracked
- **Usage Analytics**: Real-time usage monitoring
- **Performance Metrics**: Response time and error tracking
- **Alert System**: Automated security alerts

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

### Railway

1. Connect your GitHub repository
2. Add environment variables in Railway dashboard
3. Deploy automatically on push to main

### Docker

```bash
# Build image
docker build -t ai-gateway .

# Run container
docker run -p 8000:8000 --env-file .env ai-gateway
```

### Environment Variables

See [Environment Setup Guide](ENVIRONMENT_SETUP.md) for complete configuration.

## 🧪 Testing

### Run Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_chat.py

# Run specific test
pytest tests/test_chat.py::test_chat_completion
```

### Test Coverage
- ✅ Unit tests for business logic
- ✅ Integration tests for API endpoints
- ✅ End-to-end tests for workflows
- ✅ Security tests for authentication
- ✅ Performance tests for rate limiting

Current coverage: **85%+**

## 📊 Monitoring

### Health Checks

```bash
# Basic health check
curl https://your-gateway.vercel.app/health

# Detailed ping with statistics
curl https://your-gateway.vercel.app/ping

# Admin monitoring (requires admin key)
curl -H "Authorization: Bearer admin_key" \
     https://your-gateway.vercel.app/admin/monitor
```

### Metrics
- ⏱️ Request/response times
- 📊 Error rates and types
- 💰 Usage statistics and costs
- 🔒 Security events
- 📈 Model usage patterns

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](contributing.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`pytest`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Quality Standards
- ✅ Type hints for all functions
- ✅ Docstrings for public APIs
- ✅ PEP 8 compliance
- ✅ Test coverage > 80%
- ✅ No linter errors

## 📈 Roadmap

### ✅ Phase 1 (Completed)
- ✅ Multi-provider support (OpenRouter, Portkey, Featherless, Chutes)
- ✅ Credit management system
- ✅ Rate limiting with Redis
- ✅ Security features (encryption, audit logging)
- ✅ Free trials and subscription plans
- ✅ Chat history management
- ✅ Image generation
- ✅ Referral system
- ✅ Coupon system
- ✅ Role-based access control

### 🔄 Phase 2 (In Progress)
- 🔄 Advanced analytics dashboard
- 🔄 Custom model fine-tuning support
- 🔄 Batch processing API
- 🔄 WebSocket support for streaming
- 🔄 GraphQL API endpoint
- 🔄 Enhanced caching strategies

### ⏳ Phase 3 (Planned)
- ⏳ Multi-tenant support
- ⏳ Advanced load balancing
- ⏳ Model performance benchmarking
- ⏳ Mobile SDKs (iOS, Android)
- ⏳ Desktop SDKs (Electron, Tauri)
- ⏳ Marketplace for custom models

## 📊 Statistics

- **API Endpoints**: 50+
- **Supported Providers**: 4 (OpenRouter, Portkey, Featherless, Chutes)
- **Available Models**: 100+
- **Database Tables**: 15+
- **Test Coverage**: 85%+
- **Response Time**: <100ms average
- **Uptime**: 99.9%+

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- 📚 [Full Documentation](docs/)
- 🚀 [API Reference](api.md)
- 🏗️ [Architecture Guide](architecture.md)
- 🛠️ [Troubleshooting](troubleshooting.md)

### Community
- 💬 [GitHub Discussions](https://github.com/your-org/api-gateway-vercel/discussions)
- 🐛 [Issue Tracker](https://github.com/your-org/api-gateway-vercel/issues)
- 📧 Email: support@yourdomain.com

### Resources
- 🌐 [Official Website](https://yourdomain.com)
- 📖 [Blog](https://blog.yourdomain.com)
- 🎓 [Tutorials](https://yourdomain.com/tutorials)

## 🙏 Acknowledgments

This project is built with amazing open-source technologies:

- [FastAPI](https://fastapi.tiangolo.com/) - Modern, fast web framework for building APIs
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [OpenRouter](https://openrouter.ai/) - Unified AI model access
- [Stripe](https://stripe.com/) - Payment processing platform
- [Resend](https://resend.com/) - Email delivery for developers
- [Redis](https://redis.io/) - In-memory data structure store
- [Pydantic](https://pydantic-docs.helpmanual.io/) - Data validation using Python type hints
- [PostgreSQL](https://www.postgresql.org/) - Advanced open source database

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ by the AI Gateway team**

*Making AI accessible, secure, and affordable for everyone.*

