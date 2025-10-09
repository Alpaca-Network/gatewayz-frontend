# Setup Guide

This guide will help you set up the AI Gateway for local development and production deployment.

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Git
- Supabase account
- (Optional) Redis for caching
- (Optional) Stripe account for payments

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/api-gateway-vercel.git
cd api-gateway-vercel/gateway
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

Create a `.env` file in the root directory:

```env
# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key
PORTKEY_API_KEY=your_portkey_api_key
FEATHERLESS_API_KEY=your_featherless_api_key
CHUTES_API_KEY=your_chutes_api_key

# Email Configuration
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com

# Payment Configuration (Optional)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Security Configuration
SECRET_KEY=your_secret_key_for_encryption
ADMIN_API_KEY=your_admin_api_key

# Environment
ENVIRONMENT=development
```

### 5. Database Setup

#### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your URL and keys
3. Run the database migrations (if any)

#### Database Tables

The following tables are required:

- `users` - User accounts and profiles
- `api_keys` - Legacy API key storage
- `api_keys_new` - Enhanced API key system
- `plans` - Subscription plans
- `user_plans` - User plan assignments
- `usage_records` - Usage tracking
- `rate_limit_configs` - Rate limiting
- `trial_records` - Free trial management
- `payment_records` - Payment history
- `coupons` - Discount codes
- `referrals` - Referral tracking
- `chat_sessions` - Chat history
- `latest_models` - Model ranking data
- `openrouter_models` - OpenRouter model data
- `audit_logs` - Security audit logs

### 6. Run the Application

```bash
# Start the development server
python main.py

# Or use uvicorn directly
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

### 7. Verify Installation

```bash
# Check health endpoint
curl http://localhost:8000/health

# Check available models
curl http://localhost:8000/models

# Check API documentation
open http://localhost:8000/docs
```

## Production Deployment

### Vercel Deployment

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Configure Vercel**:
   ```bash
   vercel
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_KEY
   vercel env add OPENROUTER_API_KEY
   # ... add all required environment variables
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### Railway Deployment

1. **Connect Repository**:
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository

2. **Set Environment Variables**:
   - Add all required environment variables in Railway dashboard

3. **Deploy**:
   - Railway will automatically deploy on push to main branch

### Docker Deployment

1. **Create Dockerfile**:
   ```dockerfile
   FROM python:3.9-slim

   WORKDIR /app

   COPY requirements.txt .
   RUN pip install -r requirements.txt

   COPY . .

   CMD ["python", "main.py"]
   ```

2. **Build and Run**:
   ```bash
   docker build -t ai-gateway .
   docker run -p 8000:8000 --env-file .env ai-gateway
   ```

### Kubernetes Deployment

1. **Create Deployment YAML**:
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: ai-gateway
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: ai-gateway
     template:
       metadata:
         labels:
           app: ai-gateway
       spec:
         containers:
         - name: ai-gateway
           image: your-registry/ai-gateway:latest
           ports:
           - containerPort: 8000
           env:
           - name: SUPABASE_URL
             valueFrom:
               secretKeyRef:
                 name: ai-gateway-secrets
                 key: supabase-url
   ```

2. **Apply Configuration**:
   ```bash
   kubectl apply -f deployment.yaml
   ```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_KEY` | Supabase anon key | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes | - |
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes | - |
| `PORTKEY_API_KEY` | Portkey API key | No | - |
| `FEATHERLESS_API_KEY` | Featherless API key | No | - |
| `CHUTES_API_KEY` | Chutes API key | No | - |
| `RESEND_API_KEY` | Resend email API key | No | - |
| `FROM_EMAIL` | From email address | No | noreply@example.com |
| `STRIPE_SECRET_KEY` | Stripe secret key | No | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | No | - |
| `REDIS_URL` | Redis connection URL | No | - |
| `SECRET_KEY` | Secret key for encryption | Yes | - |
| `ADMIN_API_KEY` | Admin API key | Yes | - |
| `ENVIRONMENT` | Environment (dev/staging/prod) | No | development |

### Database Configuration

The application uses Supabase as the primary database. Ensure you have:

1. **Proper permissions** for all tables
2. **Row Level Security (RLS)** enabled where appropriate
3. **Indexes** on frequently queried columns
4. **Backup strategy** in place

### Security Configuration

1. **API Key Security**:
   - Use strong, randomly generated API keys
   - Implement proper key rotation
   - Monitor key usage

2. **Rate Limiting**:
   - Configure appropriate rate limits
   - Monitor for abuse
   - Implement IP-based blocking if needed

3. **CORS Configuration**:
   - Set appropriate CORS origins for production
   - Avoid using wildcard (*) in production

## Monitoring and Logging

### Health Checks

The application provides several health check endpoints:

- `GET /health` - Basic health check
- `GET /ping` - Ping with statistics
- `GET /admin/monitor` - Detailed system monitoring (admin only)

### Logging

Logs are structured and include:

- Request/response information
- Error details
- Security events
- Performance metrics

### Monitoring

Recommended monitoring tools:

- **Application Performance**: New Relic, DataDog, or similar
- **Error Tracking**: Sentry or similar
- **Uptime Monitoring**: Pingdom, UptimeRobot, or similar
- **Log Aggregation**: ELK Stack, Splunk, or similar

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check Supabase credentials
   - Verify network connectivity
   - Check database permissions

2. **API Key Validation Errors**:
   - Verify API key format
   - Check key permissions
   - Ensure key is active

3. **Rate Limiting Issues**:
   - Check rate limit configuration
   - Verify user plan limits
   - Monitor for abuse

4. **External API Errors**:
   - Check provider API keys
   - Verify provider status
   - Check rate limits

### Debug Mode

Enable debug mode for detailed logging:

```env
ENVIRONMENT=development
LOG_LEVEL=DEBUG
```

### Performance Optimization

1. **Database Optimization**:
   - Add appropriate indexes
   - Optimize queries
   - Use connection pooling

2. **Caching**:
   - Enable Redis caching
   - Cache model lists
   - Cache user data

3. **Rate Limiting**:
   - Implement proper rate limiting
   - Use Redis for distributed rate limiting
   - Monitor and adjust limits

## Development Workflow

### Code Structure

The project follows a modular structure:

- `src/main.py` - FastAPI application
- `src/routes/` - API endpoints
- `src/db/` - Database operations
- `src/schemas/` - Pydantic models
- `src/security/` - Security utilities
- `src/services/` - Business logic

### Adding New Features

1. **Create Database Models**:
   - Add to appropriate schema file
   - Update database functions

2. **Create API Endpoints**:
   - Add to appropriate route file
   - Implement proper validation
   - Add error handling

3. **Add Tests**:
   - Unit tests for business logic
   - Integration tests for API endpoints
   - End-to-end tests for workflows

### Code Quality

- Use type hints
- Follow PEP 8 style guide
- Add docstrings to functions
- Write comprehensive tests
- Use linting tools (flake8, black)

## Support

For support and questions:

- **Documentation**: Check this documentation
- **Issues**: Create GitHub issues
- **Discussions**: Use GitHub discussions
- **Email**: support@yourdomain.com

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

See [Contributing Guide](contributing.md) for detailed instructions.