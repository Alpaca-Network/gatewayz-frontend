# AI Gateway Documentation

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)](https://www.python.org/)
[![Version](https://img.shields.io/badge/Version-2.0.1-blue)](https://github.com/your-org/api-gateway-vercel)

Welcome to the AI Gateway documentation! This guide provides comprehensive information on setting up, deploying, and operating the AI Gateway API.

## 🎯 What is AI Gateway?

**AI Gateway (Gatewayz)** is a production-ready, enterprise-grade FastAPI application that provides a unified interface for accessing multiple AI models through various providers (OpenRouter, Portkey, Featherless, Chutes), with comprehensive credit management, rate limiting, and security features.

The AI Gateway acts as a powerful intermediary that:
- **Unifies** access to 100+ AI models from multiple providers
- **Manages** credits, billing, and usage tracking automatically
- **Secures** API access with encryption, authentication, and audit logging
- **Optimizes** performance with caching and rate limiting
- **Simplifies** integration with OpenAI-compatible endpoints

## 🚀 Quick Navigation

### 🎓 Getting Started
Perfect for new users who want to get up and running quickly.

- **[What is AI Gateway?](introduction/what-is-gateway.md)** - Learn about the platform
- **[Key Features](introduction/key-features.md)** - Explore all features
- **[Use Cases](introduction/use-cases.md)** - Real-world applications
- **[Setup Guide](setup.md)** - Install and configure the gateway
- **[Environment Setup](ENVIRONMENT_SETUP.md)** - Configure environment variables

### 🏗️ Architecture & Design
For developers who want to understand the system design.

- **[Architecture Overview](architecture.md)** - System architecture and design principles
- **[Project Structure](project-structure.md)** - Detailed project organization
- **[Source Structure Report](src-structure-report.md)** - Source code organization
- **[Environment Configuration](environment.md)** - Environment variables reference

### 📚 API Documentation
Complete reference for integrating with the API.

- **[API Reference](api.md)** - Complete endpoint documentation
- **[Privy Authentication](privy-authentication.md)** - Privy authentication integration
- **[Chat Completions](CHAT_HISTORY_INTEGRATION.md)** - Chat with history management
- **[Responses API](RESPONSES_API.md)** - Unified response API
- **[Automatic History Injection](AUTOMATIC_HISTORY_INJECTION.md)** - Chat history features

### ✨ Feature Guides
Learn how to use specific features.

#### Payment & Subscriptions
- **[Stripe Integration](STRIPE.md)** - Payment processing and subscriptions
- **[Coupon System](api.md#coupons)** - Discount codes and promotions
- **[Referral System](REFERRAL_SYSTEM.md)** - Referral tracking and rewards
  - [Referral Invite Links](REFERRAL_INVITE_LINKS.md)
  - [Referral cURL Commands](REFERRAL_CURL_COMMANDS.md)

#### Communication & Notifications
- **[Email Features](email-features.md)** - Email notifications and templates

#### Tracking & Analytics
- **[Activity Logging](ACTIVITY_LOGGING.md)** - Activity tracking and analytics
  - [Activity Logging Summary](ACTIVITY_LOGGING_SUMMARY.md)

### 🔌 Provider Integration
Connect to different AI model providers.

- **[Chutes Integration](CHUTES_INTEGRATION.md)** - Chutes provider setup and usage
- **[Featherless Integration](FEATHERLESS_INTEGRATION.md)** - Featherless provider setup
  - [Featherless Fix](FEATHERLESS_FIX.md) - Troubleshooting Featherless
- **[Portkey Testing Guide](PORTKEY_TESTING_GUIDE.md)** - Test Portkey integration
  - [DeepInfra Portkey Fix](DEEPINFRA_PORTKEY_FIX.md) - DeepInfra specific fixes
- **[Provider Models API](provider-models-api.md)** - Manage provider models
- **[Provider Assets Solution](provider-assets-solution.md)** - Manage provider assets

### 🚀 Operations & Deployment
Deploy and maintain the gateway in production.

- **[Operations Guide](operations.md)** - Monitoring, logging, and maintenance
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Vercel Deployment](VERCEL_DEPLOYMENT.md)** - Deploy to Vercel
- **[Deploy Migrations](DEPLOY_MIGRATIONS.md)** - Database migrations
- **[Running the Application](running.md)** - How to run locally
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

### 🤝 Contributing
Help improve the AI Gateway.

- **[Contributing Guide](contributing.md)** - How to contribute
- **[GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md)** - Configure GitHub secrets
- **[Claude Documentation](CLAUDE.md)** - Claude AI specific docs

## 💡 Key Features

### Core Capabilities
- 🤖 **Multi-Provider Support** - Access 100+ models from OpenRouter, Portkey, Featherless, and Chutes
- 🔌 **OpenAI-Compatible API** - Drop-in replacement for OpenAI API
- 💳 **Credit Management** - Token-based billing with automatic deduction
- 🛡️ **Enterprise Security** - Encrypted API keys, IP allowlists, domain restrictions
- 📊 **Rate Limiting** - Per-user and per-key rate limiting
- 🎁 **Free Trials** - 3-day trials with $10 credits
- 💰 **Subscription Plans** - Flexible subscription management
- 💬 **Chat History** - Persistent chat sessions with automatic history injection
- 🎨 **Image Generation** - AI-powered image creation
- 📈 **Model Ranking** - Dynamic model discovery

### Advanced Features
- 📝 **Audit Logging** - Comprehensive security event tracking
- 📊 **Analytics** - Real-time usage analytics
- 🎫 **Coupon System** - Discount codes and promotions
- 🤝 **Referral System** - User referral tracking and rewards
- 👥 **Role-Based Access** - Admin, user, and custom roles
- 📧 **Email Notifications** - Professional email templates
- 🔗 **Webhook Support** - Stripe webhook integration
- 🔑 **API Key Management** - Advanced key management
- ⏱️ **Trial Management** - Free trial tracking and conversion

## 🏗️ System Architecture

The AI Gateway is built with modern, production-ready technologies:

### Technology Stack
- **Backend**: FastAPI 0.104.1 (modern, fast web framework)
- **Database**: Supabase (PostgreSQL with real-time features)
- **Validation**: Pydantic 2.5.0 (data validation and serialization)
- **Caching**: Redis 5.0.1 (optional, for rate limiting)
- **Payments**: Stripe 13.0.1 (payment processing)
- **Email**: Resend 0.8.0 (email delivery)
- **Authentication**: Privy & custom API key system
- **Security**: Cryptography 41.0.7 (Fernet encryption, HMAC hashing)

### Core Components
```
src/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration management
├── db/                  # Database layer (users, api_keys, plans, etc.)
├── routes/              # API endpoints (chat, auth, admin, etc.)
├── schemas/             # Pydantic models for validation
├── security/            # Security utilities (encryption, auth)
├── services/            # Business logic (providers, payments, etc.)
└── utils/               # Utility functions
```

## 📊 Quick Stats

- **Version**: 2.0.1
- **API Endpoints**: 50+
- **Supported Providers**: 4 (OpenRouter, Portkey, Featherless, Chutes)
- **Available Models**: 100+
- **Database Tables**: 15+
- **Test Coverage**: 85%+
- **Response Time**: <100ms average
- **Uptime**: 99.9%+

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/api-gateway-vercel.git
cd api-gateway-vercel/gateway

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run application
python src/main.py
```

The API will be available at `http://localhost:8000`

### Verify Installation

```bash
# Check health
curl http://localhost:8000/health

# View API docs
open http://localhost:8000/docs

# List models
curl http://localhost:8000/models
```

## 📚 API Overview

### Public Endpoints
```
GET  /                          # Welcome page
GET  /health                    # Health check
GET  /ping                      # Ping with statistics
GET  /models                    # List available models
GET  /models/providers          # Provider statistics
GET  /ranking/models            # Model rankings
```

### Authentication
```
POST /auth/privy                # Privy authentication
GET  /user/balance              # Check balance
POST /user/api-keys             # Create API key
GET  /user/api-keys             # List API keys
```

### Chat Completions (OpenAI-Compatible)
```
POST /v1/chat/completions       # Chat completions
POST /v1/responses              # Unified response API
POST /images/generate           # Image generation
```

### Admin Operations
```
POST /admin/create              # Create user
GET  /admin/monitor             # System monitoring
POST /admin/add_credits         # Add credits
GET  /admin/audit-logs          # View audit logs
```

See [API Reference](api.md) for complete documentation.

## 🔒 Security Features

### API Key Security
- **Encryption**: Fernet encryption for sensitive data
- **Hashing**: HMAC-SHA256 for key validation
- **Rotation**: Automatic key rotation
- **Scope Permissions**: Granular permission system
- **Prefix System**: Environment-specific prefixes

### Authentication & Authorization
- **Bearer Token**: Standard HTTP Authorization
- **Rate Limiting**: Per-key and per-user limits
- **IP Allowlists**: IP-based access control
- **Domain Restrictions**: Referer-based control
- **Role-Based Access**: Admin, user, custom roles

### Audit & Monitoring
- **Comprehensive Logging**: All interactions logged
- **Security Events**: Failed attempts tracked
- **Usage Analytics**: Real-time monitoring
- **Performance Metrics**: Response time tracking
- **Alert System**: Automated alerts

## 🎯 Use Cases

### For Developers
- Build AI-powered applications without managing multiple provider APIs
- Implement chat interfaces with automatic history management
- Generate images with AI models
- Track usage and costs across projects

### For Businesses
- Deploy enterprise AI solutions with security and compliance
- Manage team access with role-based permissions
- Monitor and optimize AI model usage costs
- Offer AI features to customers with subscription plans

### For Startups
- Launch AI products quickly with ready-to-use infrastructure
- Scale from free trials to paid subscriptions seamlessly
- Track referrals and growth metrics
- Focus on product, not infrastructure

## 📖 Learning Path

### Beginner
1. Read [What is AI Gateway?](introduction/what-is-gateway.md)
2. Follow [Setup Guide](setup.md)
3. Review [API Reference](api.md)
4. Make your first API call

### Intermediate
1. Study [Architecture](architecture.md)
2. Configure [Privy Authentication](privy-authentication.md)
3. Implement [Chat History](CHAT_HISTORY_INTEGRATION.md)
4. Set up [Stripe Integration](STRIPE.md)

### Advanced
1. Deep dive into [Project Structure](project-structure.md)
2. Configure [Provider Integration](CHUTES_INTEGRATION.md)
3. Set up [Activity Logging](ACTIVITY_LOGGING.md)
4. Deploy to [Production](DEPLOYMENT.md)

## 🆘 Getting Help

### Documentation
- 📚 Browse the documentation sections above
- 🔍 Use the search feature to find specific topics
- 📖 Check the [Troubleshooting Guide](troubleshooting.md)

### Community Support
- 💬 [GitHub Discussions](https://github.com/your-org/api-gateway-vercel/discussions) - Ask questions and share ideas
- 🐛 [Issue Tracker](https://github.com/your-org/api-gateway-vercel/issues) - Report bugs
- 📧 Email: support@yourdomain.com

### Professional Support
- 🎓 [Tutorials](https://yourdomain.com/tutorials) - Step-by-step guides
- 📺 [Video Guides](https://yourdomain.com/videos) - Visual learning
- 💼 [Enterprise Support](https://yourdomain.com/enterprise) - Dedicated assistance

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, improving documentation, or adding new features, your help is appreciated.

- **[Contributing Guide](contributing.md)** - Learn how to contribute
- **[GitHub Repository](https://github.com/your-org/api-gateway-vercel)** - Access the source code
- **[Code of Conduct](contributing.md#code-of-conduct)** - Community guidelines

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with amazing open-source technologies:

- [FastAPI](https://fastapi.tiangolo.com/) - Modern web framework
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [OpenRouter](https://openrouter.ai/) - Unified AI model access
- [Stripe](https://stripe.com/) - Payment processing
- [Resend](https://resend.com/) - Email delivery
- [Redis](https://redis.io/) - In-memory data store
- [Pydantic](https://pydantic-docs.helpmanual.io/) - Data validation
- [PostgreSQL](https://www.postgresql.org/) - Advanced database

---

**Built with ❤️ by the AI Gateway team**

*Making AI accessible, secure, and affordable for everyone.*
