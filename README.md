# Gatewayz Universal Inference API

A production-ready FastAPI application that provides a credit-metered API gateway for Gatewayz with enterprise-grade security features, advanced user management, and comprehensive audit logging.

## 🚀 Features

### Core Features
- **Multi-Model Support**: Access to hundreds of AI models via Gatewayz
- **Chat Completions API**: OpenAI-compatible chat completions endpoint at `/v1/chat/completions`
- **Advanced User Management**: Self-registration, profile management, and account deletion
- **Multi-Key System**: Create, manage, and rotate multiple API keys with custom names and permissions
- **Credit System**: Token-based credit deduction with real-time balance checking
- **Real-time Rate Limiting**: Configurable rate limits per user with minute/hour/day windows
- **Comprehensive Monitoring**: Usage analytics and metrics for both users and admins

### Advanced Security Features
- **Encrypted Key Storage**: All API keys encrypted with Fernet (AES 128)
- **Key Rotation**: Individual and bulk key rotation capabilities
- **Comprehensive Audit Logging**: Enterprise-grade security event tracking
- **Advanced Access Controls**: IP allowlist and domain restrictions with real-time enforcement
- **Security Dashboard**: Real-time security monitoring and statistics
- **Bulk Operations**: Efficient bulk key management
- **Hash-based Validation**: Secure key validation without exposure

### Production Ready
- **Clean, Optimized Codebase**: Minimal logging with comprehensive error handling
- **Interactive Documentation**: Swagger UI and ReDoc for easy API exploration
- **Scalable**: Built with FastAPI for high-performance async operations
- **Vercel Ready**: Optimized for serverless deployment

## 🔑 API Key System

### Key Types
- **Primary Key**: Automatically generated during user registration
- **Custom Keys**: User-created keys with custom names and permissions
- **Environment Tags**: `gw_live_`, `gw_test_`, `gw_staging_`, `gw_dev_`

### Key Features
- **Custom Names**: Human-readable names for easy identification
- **Permissions**: Granular access control (read, write, admin)
- **Expiration**: Optional TTL for temporary keys
- **Request Limits**: Per-key usage caps
- **IP Allowlists**: Restrict key usage to specific IP addresses
- **Domain Referrers**: Restrict key usage to specific domains

### Security Features
- **Encrypted Storage**: All keys encrypted with Fernet (AES 128)
- **Hash-based Validation**: Secure validation without exposing keys
- **Key Rotation**: Individual and bulk key rotation
- **Audit Logging**: Comprehensive security event tracking
- **Access Controls**: IP and domain restrictions with real-time enforcement

## 📊 Primary Endpoints

### Authentication
- POST `/auth/register` - Register new user with unified API key system

### API Key Management (Enhanced)
- POST `/user/api-keys` - Create new API key with advanced security
- GET `/user/api-keys` - List all user API keys with security status
- PUT `/user/api-keys/{key_id}` - Update/rotate specific API key
- DELETE `/user/api-keys/{key_id}` - Delete specific API key
- GET `/user/api-keys/usage` - Get API key usage statistics with audit info
- GET `/user/api-keys/audit-logs` - Get audit logs for security monitoring

### Plan Management
- GET `/plans` - Get all available plans
- GET `/user/plan` - Get current user's plan
- GET `/user/plan/usage` - Get user's plan usage and limits
- GET `/user/plan/entitlements` - Check user's plan entitlements

### AI Services
- POST `/v1/chat/completions` - Chat completion with Gatewayz models

### Admin
- POST `/admin/add_credits` - Add credits to existing user
- GET `/admin/balance` - Get all user balances and API keys
- GET `/admin/monitor` - System-wide monitoring dashboard
- POST `/admin/limit` - Set rate limits for users
- POST `/admin/assign-plan` - Assign plan to user

## 🚀 Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
uvicorn app:app --reload
```

## 🔒 Security

- **Advanced Security**: All security features fully implemented and working
- **Encrypted Storage**: API keys encrypted with Fernet (AES 128)
- **Access Controls**: IP allowlist and domain restrictions enforced
- **Audit Logging**: Comprehensive security event tracking
- **Key Rotation**: Individual and bulk rotation capabilities

## 📚 Documentation

- **Interactive API Docs**: Visit `/docs` for Swagger UI
- **Frontend Integration Guide**: See [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md)


