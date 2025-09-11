# Architecture

## System Overview

The AI Gateway is a production-ready FastAPI application that provides a unified interface for accessing multiple AI models through OpenRouter, with comprehensive credit management, rate limiting, and security features.

## Core Components

### FastAPI Application (`app.py`)
- **Framework**: FastAPI 0.104.1 with automatic OpenAPI documentation
- **CORS**: Enabled for all origins (configurable for production)
- **Authentication**: HTTP Bearer token authentication with API key validation
- **Route Organization**: 
  - Public endpoints (health, models)
  - User endpoints (authentication, profile, API keys, plans)
  - Admin endpoints (user management, monitoring, cache control)
  - Proxy endpoints (OpenAI-compatible chat completions)

### Database Layer
- **Primary Database**: Supabase (PostgreSQL)
- **Configuration**: `supabase_config.py` - Client initialization and connection management
- **Data Access**: `db.py` - Comprehensive CRUD operations and analytics
- **Security**: `db_security.py` - Advanced security features and audit logging

### External Integrations
- **OpenRouter API**: AI model access via OpenAI SDK
  - Base URL: `https://openrouter.ai/api/v1`
  - Headers: HTTP-Referer and X-Title for identification
  - Model caching with 5-minute TTL
- **Supabase**: Database and real-time features
  - User management and authentication
  - API key storage and validation
  - Usage tracking and analytics

### Security Module (`security.py`)
- **Advanced Security Manager**: Secure key hashing and encryption
- **Audit Logging**: Comprehensive security event tracking
- **Key Management**: HMAC-SHA256 hashing, Fernet encryption
- **Phase 4 Features**: IP allowlists, domain restrictions, key rotation

## Data Models (`models.py`)

### Core Models
- **User Management**: Registration, profiles, authentication methods
- **API Keys**: Creation, management, security features, usage tracking
- **Plans**: Subscription management, entitlements, usage limits
- **Usage Tracking**: Comprehensive metrics and analytics
- **Rate Limiting**: Multi-tier rate limiting configuration

### Request/Response Models
- **Pydantic Models**: Type-safe request/response validation
- **Enum Types**: Auth methods, payment methods, subscription status
- **Optional Fields**: Flexible update operations
- **Validation**: Email validation, date handling, credit management

## Data Flow

### Request Processing
1. **Authentication**: API key validation via `get_api_key` dependency
2. **Authorization**: Permission checks and rate limit validation
3. **Business Logic**: Database operations via `db.py` functions
4. **External Calls**: OpenRouter API for AI model requests
5. **Usage Tracking**: Credit deduction and usage recording
6. **Response**: Formatted response with gateway metadata

### Security Flow
1. **Key Validation**: Multi-layer API key validation
2. **IP/Domain Checks**: Allowlist enforcement
3. **Rate Limiting**: Per-key and per-user limits
4. **Plan Enforcement**: Subscription limit validation
5. **Audit Logging**: Security event recording
6. **Usage Monitoring**: Real-time analytics

## Database Schema

### Core Tables
- **users**: User accounts, profiles, credits, authentication
- **api_keys**: API key management with security features
- **api_keys_new**: Enhanced API key system (Phase 4)
- **rate_limit_configs**: Per-user rate limiting
- **usage_records**: Comprehensive usage tracking
- **plans**: Subscription plan definitions
- **user_plans**: User plan assignments and history
- **audit_logs**: Security event logging

### Relationships
- Users have multiple API keys
- API keys have usage records and rate limits
- Users can have active plans with entitlements
- All operations are logged for audit purposes

## Caching Strategy

### Model Cache
- **Storage**: In-memory cache with TTL
- **TTL**: 5 minutes for OpenRouter models
- **Refresh**: Automatic and manual refresh capabilities
- **Admin Controls**: Cache status monitoring and forced refresh

### Performance Optimizations
- **Connection Pooling**: Supabase client reuse
- **Batch Operations**: Efficient database queries
- **Lazy Loading**: On-demand model fetching
- **Error Handling**: Graceful degradation

## Security Architecture

### Authentication
- **API Key System**: Multi-format key support
- **Environment Tags**: Live, test, staging, development
- **Key Rotation**: Secure key regeneration
- **Expiration**: Time-based key invalidation

### Authorization
- **Permission System**: Read/write scope controls
- **IP Allowlists**: Network-based restrictions
- **Domain Restrictions**: Referrer-based controls
- **Plan Enforcement**: Subscription-based limits

### Audit & Monitoring
- **Comprehensive Logging**: All security events tracked
- **Usage Analytics**: Real-time monitoring
- **Error Tracking**: Detailed error logging
- **Performance Metrics**: System health monitoring

## Deployment Architecture

### Vercel Configuration
- **Runtime**: Python 3.11+ with Vercel Python runtime
- **Entry Point**: `app.py` as main application
- **Environment**: Environment variable configuration
- **Scaling**: Automatic scaling based on demand

### Environment Management
- **Configuration**: `config.py` with validation
- **Environment Variables**: Supabase, OpenRouter, site configuration
- **Validation**: Startup validation with graceful degradation
- **Secrets Management**: Secure environment variable handling

## Error Handling

### Error Types
- **Validation Errors**: Input validation failures
- **Authentication Errors**: Invalid or expired keys
- **Authorization Errors**: Permission or restriction violations
- **Rate Limit Errors**: Usage limit exceeded
- **External Service Errors**: OpenRouter API failures
- **Database Errors**: Connection or query failures

### Error Response Format
- **HTTP Status Codes**: Standard REST API codes
- **Error Messages**: Descriptive error details
- **Request IDs**: Unique request identification
- **Gateway Metadata**: Additional context information

## Performance Considerations

### Scalability
- **Stateless Design**: Horizontal scaling support
- **Database Optimization**: Efficient queries and indexing
- **Caching Strategy**: Reduced external API calls
- **Connection Management**: Pooled database connections

### Monitoring
- **Health Checks**: System status monitoring
- **Usage Metrics**: Real-time usage tracking
- **Performance Metrics**: Response time monitoring
- **Error Tracking**: Comprehensive error logging

## Security Best Practices

### Production Recommendations
- **CORS Configuration**: Restrict to specific domains
- **Rate Limiting**: Implement at infrastructure level
- **API Key Security**: Use secure key generation
- **Audit Logging**: Monitor all security events
- **Regular Updates**: Keep dependencies current
- **Environment Security**: Secure environment variable management
