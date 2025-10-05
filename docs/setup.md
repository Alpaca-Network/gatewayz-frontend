# Setup

## Prerequisites

### System Requirements
- **Python**: 3.11+ (required for FastAPI and modern async features)
- **Operating System**: Windows, macOS, or Linux
- **Memory**: Minimum 512MB RAM (1GB+ recommended for production)
- **Storage**: 100MB for application files

### External Services
- **Supabase Project**: Database and authentication service
- **OpenRouter API Key**: AI model access credentials
- **Resend API Key**: Email delivery service for notifications
- **Domain** (optional): For production deployment

## Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd gateway
```

### 2. Create Virtual Environment
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Environment Configuration
Create a `.env` file in the project root:
```bash
cp ..env.example ..env  # If example exists
# Or create manually
touch ..env
```

## Environment Variables

### Required Variables
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key

# Email Configuration (for notifications)
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com
APP_NAME=AI Gateway
APP_URL=https://yourdomain.com
```

### Optional Variables
```env
# OpenRouter Site Information
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Your Site Name

# Vercel Deployment (automatically set)
VERCEL=1
```

### Environment Validation
The application validates required environment variables on startup:
- **Local Development**: All required variables must be present
- **Vercel Deployment**: Validation is skipped to prevent startup failures
- **Error Handling**: Clear error messages for missing variables

## Database Setup

### Supabase Tables
The application expects the following tables in your Supabase project:

#### Core Tables
- **users**: User accounts and profiles
  - `id`, `username`, `email`, `credits`, `api_key`
  - `auth_method`, `subscription_status`, `is_active`
  - `created_at`, `updated_at`, `registration_date`

- **api_keys**: API key management
  - `id`, `user_id`, `api_key`, `key_name`, `environment_tag`
  - `scope_permissions`, `is_active`, `is_primary`
  - `expiration_date`, `max_requests`, `requests_used`
  - `ip_allowlist`, `domain_referrers`
  - `created_at`, `updated_at`, `last_used_at`

- **api_keys_new**: Enhanced API key system (Phase 4)
  - Same structure as `api_keys` with additional security features

#### Supporting Tables
- **rate_limit_configs**: Per-user rate limiting
- **usage_records**: Comprehensive usage tracking
- **plans**: Subscription plan definitions
- **user_plans**: User plan assignments and history
- **audit_logs**: Security event logging

#### Notification Tables
- **notification_preferences**: User email notification settings
- **notifications**: Email notification records and status
- **notification_templates**: Professional HTML email templates
- **password_reset_tokens**: Secure password reset tokens

### Database Initialization
The application automatically initializes database connections on startup:
- **Connection Testing**: Validates Supabase connectivity
- **Error Handling**: Graceful failure with clear error messages
- **Health Checks**: Database status included in health endpoint

## Running the Application

### Local Development
```bash
# Start the development server
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Or with specific configuration
uvicorn app:app --reload --host 127.0.0.1 --port 8000 --log-level info
```

### Access Points
- **API Documentation**: http://localhost:8000/docs
- **ReDoc Documentation**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json
- **Health Check**: http://localhost:8000/health

### Production Mode
```bash
# Production server (no reload)
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

## Verification

### 1. Health Check
```bash
curl http://localhost:8000/health
```
Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "openrouter": "connected",
  "user_count": 0,
  "timestamp": "2024-01-01T00:00:00.000000"
}
```

### 2. API Documentation
Visit http://localhost:8000/docs to verify:
- All endpoints are listed
- Authentication is working
- Database connections are active

### 3. Test API Key Creation
```bash
# Register a test user
curl -X POST http://localhost:8000/create \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "auth_method": "email",
    "initial_credits": 1000
  }'
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check Supabase project is active
- Ensure database tables exist

#### OpenRouter Connection Failed
- Verify `OPENROUTER_API_KEY` is valid
- Check OpenRouter account has sufficient credits
- Test API key with OpenRouter directly

#### Missing Environment Variables
- Ensure `.env` file exists in project root
- Check all required variables are set
- Restart application after environment changes

#### Port Already in Use
```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process or use different port
uvicorn app:app --reload --port 8001
```

### Logs and Debugging
- **Application Logs**: Check console output for errors
- **Database Logs**: Check Supabase dashboard
- **OpenRouter Logs**: Check OpenRouter dashboard
- **Email Logs**: Check Resend dashboard for email delivery
- **Health Endpoint**: Monitor system status

## Email Setup

### Resend Configuration
1. **Create Resend Account**: Sign up at [resend.com](https://resend.com)
2. **Get API Key**: Generate API key from dashboard
3. **Verify Domain**: Add and verify your sending domain
4. **Configure Environment**: Add `RESEND_API_KEY` to environment variables

### Email Templates
The application includes professional email templates for:
- **Welcome Emails**: New user onboarding
- **Password Reset**: Secure password reset with tokens
- **Low Balance Alerts**: Credit depletion warnings
- **Trial Expiry**: Trial expiration reminders
- **Usage Reports**: Monthly usage analytics
- **API Key Notifications**: Security alerts for key creation

### Email Security
- **No API Key Exposure**: API keys are never included in emails
- **Dashboard Access**: Sensitive information accessed through secure dashboard
- **Token-Based Reset**: Password reset uses secure, time-limited tokens
- **Professional Design**: Mobile-responsive, branded email templates

## Development Tools

### Recommended Extensions
- **Python**: Language support and debugging
- **FastAPI**: API development tools
- **REST Client**: API testing (VS Code)
- **Postman**: API testing and documentation

### Testing
```bash
# Run tests (if available)
python -m pytest tests/

# Test specific endpoint
curl -X GET http://localhost:8000/models
```

## Next Steps

1. **Configure Production**: Set up production environment variables
2. **Deploy**: Follow deployment guide for your platform
3. **Monitor**: Set up monitoring and alerting
4. **Scale**: Configure for production load
5. **Security**: Review security settings and best practices

## Support

- **Documentation**: Check other docs in this directory
- **Issues**: Report issues in the project repository
- **Community**: Join discussions and get help
