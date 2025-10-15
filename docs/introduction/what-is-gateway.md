# What is AI Gateway?

[![Version](https://img.shields.io/badge/Version-2.0.1-blue)](https://github.com/your-org/api-gateway-vercel)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

**AI Gateway (Gatewayz)** is a production-ready, enterprise-grade API gateway that provides a unified interface for accessing multiple AI models through various providers (OpenRouter, Portkey, Featherless, Chutes). It features comprehensive credit management, rate limiting, security features, and advanced functionality for production use.

## Overview

The AI Gateway is an open-source service that sits between your applications and upstream model providers, handling authentication, usage tracking, and security so you can focus on building great products. It transforms complex multi-provider AI access into a simple, OpenAI-compatible API that works seamlessly with your existing code.

## Why Use AI Gateway?

### 🎯 Simplify AI Integration

- **Single Entry Point**: Access 100+ AI models from multiple providers through one unified API
- **OpenAI-Compatible**: Drop-in replacement for OpenAI API with extended functionality
- **Consistent Interface**: Same request format works across all providers
- **Easy Migration**: Switch between models without changing your code

### 💰 Smart Cost Management

- **Credit-Based Billing**: Token-based credits that deduct automatically on each request
- **Transparent Pricing**: Clear cost calculation for all models
- **Usage Tracking**: Real-time monitoring of credit usage
- **Budget Control**: Set spending limits and receive alerts

### 🛡️ Enterprise Security

- **Encrypted Storage**: Fernet encryption for sensitive data
- **Secure Authentication**: HMAC-SHA256 key validation
- **IP Allowlists**: Restrict access to specific IPs
- **Domain Restrictions**: Referer-based access control
- **Audit Logging**: Comprehensive security event tracking
- **Key Rotation**: Automatic key rotation capabilities

### 📊 Operational Excellence

- **Real-Time Monitoring**: Track system health and performance
- **Usage Analytics**: Detailed insights into API usage
- **Audit Logs**: Complete audit trail for compliance
- **Health Checks**: Multiple health check endpoints
- **Professional Emails**: Automated notifications and alerts

### 🚀 Production-Ready Features

- **Rate Limiting**: Per-user and per-key rate limiting with Redis
- **Free Trials**: 3-day trials with $10 credits for new users
- **Subscription Plans**: Flexible plan management with Stripe
- **Chat History**: Persistent chat sessions with automatic history injection
- **Image Generation**: AI-powered image creation
- **Referral System**: Built-in referral tracking and rewards
- **Coupon System**: Discount codes and promotions

## How It Works

```
┌─────────────┐
│ Your App    │
└──────┬──────┘
       │ 1. Send request with API key
       ↓
┌─────────────────────────────────────────┐
│          AI Gateway (Gatewayz)           │
│                                          │
│  • Authenticate API key                  │
│  • Check credits & rate limits           │
│  • Route to appropriate provider         │
│  • Track usage & deduct credits          │
│  • Log activity & return response        │
└──────┬──────────────────┬───────────────┘
       │                  │
       ↓                  ↓
┌──────────────┐  ┌──────────────┐
│  OpenRouter  │  │   Portkey    │
└──────────────┘  └──────────────┘
       ↓                  ↓
┌──────────────┐  ┌──────────────┐
│ Featherless  │  │   Chutes     │
└──────────────┘  └──────────────┘
```

## Key Benefits

### For Developers

1. **Faster Development**
   - Single API for all models
   - OpenAI-compatible endpoints
   - Comprehensive documentation
   - SDK examples for all languages

2. **Better Control**
   - Detailed usage analytics
   - Real-time monitoring
   - Error tracking and logging
   - Performance metrics

3. **Enhanced Security**
   - Encrypted API key storage
   - IP and domain restrictions
   - Comprehensive audit logs
   - Secure key rotation

### For Businesses

1. **Cost Optimization**
   - Pay only for what you use
   - Clear pricing across providers
   - Usage tracking and reporting
   - Budget controls and alerts

2. **Compliance & Security**
   - Audit logging for compliance
   - Role-based access control
   - Security event tracking
   - Data encryption at rest

3. **Scalability**
   - Horizontal scaling support
   - Load balancing
   - High availability
   - Performance optimization

### For Teams

1. **Collaboration**
   - Multiple API keys per user
   - Team-based access control
   - Usage reporting per key
   - Shared credit pools

2. **Flexibility**
   - Support for multiple providers
   - Easy model switching
   - Custom rate limits
   - Flexible subscription plans

## Core Capabilities

### 🤖 Multi-Provider Support

Access models from:
- **OpenRouter**: 100+ models from various providers
- **Portkey**: Multi-provider routing and fallbacks
- **Featherless**: Specialized model variants
- **Chutes**: Custom model catalog

### 💳 Credit Management

- Automatic credit deduction
- Real-time balance tracking
- Credit purchase integration
- Usage history and analytics
- Low balance alerts

### 🔑 API Key Management

- Create multiple keys per user
- Granular permissions (scopes)
- Key expiration dates
- IP allowlists
- Domain restrictions
- Usage tracking per key

### 📈 Rate Limiting

- Per-user rate limits
- Per-key rate limits
- Sliding window algorithm
- Redis-based distributed limiting
- Plan-based limits

### 💬 Chat History

- Persistent chat sessions
- Automatic history injection
- Message threading
- Context management
- Session search

### 🎨 Image Generation

- Support for multiple image models
- DALL-E 3, Stable Diffusion, and more
- Credit-based pricing
- Usage tracking

### 🤝 Referral System

- Unique referral codes per user
- Automatic reward tracking
- Conversion analytics
- Customizable rewards

### 🎫 Coupon System

- Percentage and fixed discounts
- Usage limits
- Expiration dates
- Admin management

## Use Cases

### SaaS Applications

Build AI-powered SaaS products with built-in billing, authentication, and usage tracking.

```python
# Your users get API keys
# They integrate with your service
# You manage everything through AI Gateway
```

### Internal Tools

Provide your team with controlled access to AI models while tracking usage and costs.

### API Marketplaces

Create an AI model marketplace with subscription plans, credits, and referrals.

### Research Platforms

Give researchers access to multiple models with usage quotas and tracking.

### Development Platforms

Offer AI capabilities to developers with pay-as-you-go pricing.

## Technology Stack

- **Backend**: FastAPI 0.104.1
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis 5.0.1
- **Payments**: Stripe 13.0.1
- **Email**: Resend 0.8.0
- **Security**: Cryptography 41.0.7

## Getting Started

1. **[Setup Guide](../setup.md)** - Install and configure
2. **[API Reference](../api.md)** - Complete API documentation
3. **[Architecture](../architecture.md)** - System design overview

## Next Steps

- Explore [Key Features](key-features.md) for detailed capabilities
- Review [Use Cases](use-cases.md) for real-world applications
- Check out the [Setup Guide](../setup.md) to get started

---

**Making AI accessible, secure, and affordable for everyone.**
