# Setup Guide

This comprehensive guide will help you set up the AI Gateway for local development and production deployment.

## 📋 Prerequisites

Before you begin, ensure you have the following:

- **Python 3.8 or higher** - [Download Python](https://www.python.org/downloads/)
- **pip** (Python package manager) - Usually comes with Python
- **Git** - [Download Git](https://git-scm.com/downloads/)
- **Supabase account** - [Sign up at supabase.com](https://supabase.com)
- **OpenRouter API key** - [Get one at openrouter.ai](https://openrouter.ai)
- **(Optional)** Redis for caching and rate limiting
- **(Optional)** Stripe account for payment processing
- **(Optional)** Resend account for email notifications

## 🚀 Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/api-gateway-vercel.git
cd api-gateway-vercel/gateway
```

### 2. Create Virtual Environment

It's highly recommended to use a virtual environment to isolate dependencies.

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate

# On macOS/Linux:
source .venv/bin/activate

# Your terminal prompt should now show (.venv) prefix
```

### 3. Install Dependencies

Install all required Python packages:

```bash
pip install -r requirements.txt
```

This will install:
- FastAPI 0.104.1 - Web framework
- Uvicorn 0.24.0 - ASGI server
- Supabase 2.12.0 - Database client
- Pydantic 2.5.0 - Data validation
- OpenAI 1.3.0 - OpenAI SDK
- Cryptography 41.0.7 - Encryption
- Stripe 13.0.1 - Payment processing
- Redis 5.0.1 - Caching
- Resend 0.8.0 - Email delivery
- And other dependencies

### 4. Environment Configuration

Create a `.env` file in the gateway directory:

```bash
# Copy the example file (if available)
cp .env.example .env

# Or create a new .env file
touch .env
```

#### Required Environment Variables

Add the following **required** variables to your `.env` file:

```env
# ===== Database Configuration =====
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# ===== AI Provider API Keys =====
OPENROUTER_API_KEY=your_openrouter_api_key_here

# ===== Security Configuration =====
SECRET_KEY=your_secret_key_for_encryption_min_32_chars
ADMIN_API_KEY=your_admin_api_key_here

# ===== Environment =====
ENVIRONMENT=development
```

#### Optional Environment Variables

Add these for additional features:

```env
# ===== Additional AI Providers (Optional) =====
PORTKEY_API_KEY=your_portkey_api_key_here
FEATHERLESS_API_KEY=your_featherless_api_key_here
CHUTES_API_KEY=your_chutes_api_key_here

# ===== Email Configuration (Optional) =====
RESEND_API_KEY=your_resend_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# ===== Payment Configuration (Optional) =====
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# ===== Redis Configuration (Optional) =====
REDIS_URL=redis://localhost:6379

# ===== Logging Configuration (Optional) =====
LOG_LEVEL=INFO
```

#### Generating Secret Keys

For `SECRET_KEY`, generate a secure random string:

```bash
# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Using OpenSSL
openssl rand -base64 32
```

For `ADMIN_API_KEY`, create a strong random key:

```bash
python -c "import secrets; print('admin_' + secrets.token_urlsafe(32))"
```

### 5. Database Setup

#### Supabase Setup

1. **Create a Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose organization and project name
   - Select region and database password
   - Wait for project to be created (~2 minutes)

2. **Get your API credentials**:
   - Go to Settings > API
   - Copy the following:
     - Project URL → `SUPABASE_URL`
     - `anon` `public` key → `SUPABASE_KEY`
     - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Run database migrations**:
   ```bash
   # The migrations will be applied automatically on first run
   # Or you can manually apply them:
   cd supabase/migrations
   # Apply each migration file in order
   ```

#### Database Tables

The application will create the following tables:

- **users** - User accounts and profiles
- **api_keys** - Legacy API key storage
- **api_keys_new** - Enhanced API key system with security features
- **plans** - Subscription plan definitions
- **user_plans** - User plan assignments
- **usage_records** - Usage tracking and analytics
- **rate_limit_configs** - Rate limiting configuration
- **trial_records** - Free trial management
- **payment_records** - Payment transaction history
- **coupons** - Discount codes and promotions
- **referrals** - Referral tracking and rewards
- **chat_sessions** - Chat conversation history
- **chat_messages** - Individual chat messages
- **latest_models** - Model ranking and metadata
- **openrouter_models** - OpenRouter model data cache
- **audit_logs** - Security and compliance audit logs
- **pingpong_stats** - Ping statistics

### 6. Run the Application

Start the development server:

```bash
# Using the main.py script
python src/main.py

# Or using uvicorn directly with auto-reload
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Or using the start script (if available)
./start.sh
```

The API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 7. Verify Installation

#### Check Health Endpoint

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "2.0.1",
  "database": "connected"
}
```

#### Check Available Models

```bash
curl http://localhost:8000/models
```

#### View API Documentation

Open your browser and navigate to:
- Interactive API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

#### Test Chat Completion

```bash
# First, create an API key (requires authentication)
# Then test chat completion:
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer gw_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## 🚀 Production Deployment

### Vercel Deployment (Recommended)

Vercel is the recommended platform for deploying the AI Gateway.

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Configure Project**:
   ```bash
   cd gateway
   vercel
   ```
   Follow the prompts to link your project.

4. **Set Environment Variables**:
   ```bash
   # Set all required environment variables
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add OPENROUTER_API_KEY
   vercel env add SECRET_KEY
   vercel env add ADMIN_API_KEY
   
   # Add optional variables as needed
   vercel env add STRIPE_SECRET_KEY
   vercel env add RESEND_API_KEY
   # ... etc
   ```

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

6. **Verify Deployment**:
   ```bash
   curl https://your-domain.vercel.app/health
   ```

See [Vercel Deployment Guide](VERCEL_DEPLOYMENT.md) for detailed instructions.

### Railway Deployment

Railway provides automatic deployments from GitHub.

1. **Connect Repository**:
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your repository
   - Select the `api-gateway-vercel` repository

2. **Configure Environment Variables**:
   - In Railway dashboard, go to your project
   - Click "Variables"
   - Add all required environment variables from the `.env` file

3. **Configure Build Settings**:
   - Root directory: `gateway`
   - Start command: `python src/main.py`

4. **Deploy**:
   - Railway will automatically deploy on push to main branch
   - Monitor deployment logs in the Railway dashboard

5. **Set up Custom Domain** (Optional):
   - Go to Settings > Domains
   - Add your custom domain
   - Configure DNS records

### Docker Deployment

Deploy using Docker containers.

1. **Create Dockerfile**:
   ```dockerfile
   FROM python:3.9-slim

   WORKDIR /app

   # Install dependencies
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   # Copy application
   COPY . .

   # Expose port
   EXPOSE 8000

   # Run application
   CMD ["python", "src/main.py"]
   ```

2. **Create .dockerignore**:
   ```
   .venv
   __pycache__
   *.pyc
   .env
   .git
   .gitignore
   docs/
   tests/
   *.md
   ```

3. **Build Docker Image**:
   ```bash
   docker build -t ai-gateway:latest .
   ```

4. **Run Container**:
   ```bash
   docker run -d \
     --name ai-gateway \
     -p 8000:8000 \
     --env-file .env \
     ai-gateway:latest
   ```

5. **Using Docker Compose**:
   
   Create `docker-compose.yml`:
   ```yaml
   version: '3.8'
   
   services:
     api:
       build: .
       ports:
         - "8000:8000"
       env_file:
         - .env
       restart: unless-stopped
     
     redis:
       image: redis:alpine
       ports:
         - "6379:6379"
       restart: unless-stopped
   ```

   Run with:
   ```bash
   docker-compose up -d
   ```

### Kubernetes Deployment

Deploy to Kubernetes for scalability.

1. **Create Deployment YAML** (`k8s/deployment.yaml`):
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: ai-gateway
     labels:
       app: ai-gateway
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
           - name: SUPABASE_KEY
             valueFrom:
               secretKeyRef:
                 name: ai-gateway-secrets
                 key: supabase-key
           # Add other environment variables
           resources:
             requests:
               memory: "256Mi"
               cpu: "250m"
             limits:
               memory: "512Mi"
               cpu: "500m"
   ```

2. **Create Service YAML** (`k8s/service.yaml`):
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: ai-gateway-service
   spec:
     selector:
       app: ai-gateway
     ports:
     - protocol: TCP
       port: 80
       targetPort: 8000
     type: LoadBalancer
   ```

3. **Create Secrets**:
   ```bash
   kubectl create secret generic ai-gateway-secrets \
     --from-literal=supabase-url=your_url \
     --from-literal=supabase-key=your_key \
     --from-literal=supabase-service-role-key=your_key \
     --from-literal=openrouter-api-key=your_key \
     --from-literal=secret-key=your_key \
     --from-literal=admin-api-key=your_key
   ```

4. **Apply Configuration**:
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

5. **Verify Deployment**:
   ```bash
   kubectl get pods
   kubectl get services
   kubectl logs -f deployment/ai-gateway
   ```

## ⚙️ Configuration Details

### Environment Variables Reference

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `SUPABASE_URL` | Supabase project URL | Yes | - | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase anon key | Yes | - | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes | - | `eyJ...` |
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes | - | `sk-or-...` |
| `PORTKEY_API_KEY` | Portkey API key | No | - | `pk_...` |
| `FEATHERLESS_API_KEY` | Featherless API key | No | - | `fl_...` |
| `CHUTES_API_KEY` | Chutes API key | No | - | `ch_...` |
| `RESEND_API_KEY` | Resend email API key | No | - | `re_...` |
| `FROM_EMAIL` | From email address | No | `noreply@example.com` | `noreply@yourdomain.com` |
| `STRIPE_SECRET_KEY` | Stripe secret key | No | - | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | No | - | `whsec_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | No | - | `pk_test_...` |
| `REDIS_URL` | Redis connection URL | No | - | `redis://localhost:6379` |
| `SECRET_KEY` | Secret key for encryption | Yes | - | Random 32+ char string |
| `ADMIN_API_KEY` | Admin API key | Yes | - | `admin_...` |
| `ENVIRONMENT` | Environment (dev/staging/prod) | No | `development` | `production` |
| `LOG_LEVEL` | Logging level | No | `INFO` | `DEBUG` |

### Database Configuration

The application uses Supabase (PostgreSQL) as the primary database. Ensure you have:

1. **Proper Permissions**:
   - Service role key should have full access
   - Anon key should have restricted access based on RLS policies

2. **Row Level Security (RLS)**:
   - Enable RLS on tables where appropriate
   - Configure policies for user data protection

3. **Indexes**:
   - Add indexes on frequently queried columns
   - Monitor query performance and add indexes as needed

4. **Backup Strategy**:
   - Supabase provides automatic backups
   - Consider additional backup solutions for production

### Security Configuration

1. **API Key Security**:
   - Use strong, randomly generated API keys
   - Implement proper key rotation schedule
   - Monitor key usage and revoke suspicious keys
   - Use environment-specific prefixes

2. **Rate Limiting**:
   - Configure appropriate rate limits per plan
   - Monitor for abuse and adjust limits
   - Implement IP-based blocking for severe abuse

3. **CORS Configuration**:
   - Set appropriate CORS origins for production
   - Avoid using wildcard (`*`) in production
   - Configure in `src/main.py`

4. **Encryption**:
   - Use strong SECRET_KEY (minimum 32 characters)
   - Rotate encryption keys periodically
   - Secure key storage in production

## 📊 Monitoring and Logging

### Health Checks

The application provides several health check endpoints:

```bash
# Basic health check
curl http://localhost:8000/health

# Ping with statistics
curl http://localhost:8000/ping

# Admin monitoring (requires admin key)
curl -H "Authorization: Bearer admin_key" \
     http://localhost:8000/admin/monitor
```

### Logging

Configure logging in your `.env`:

```env
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

Logs include:
- Request/response information
- Error details with stack traces
- Security events (failed auth, suspicious activity)
- Performance metrics
- Database queries (in DEBUG mode)

### Monitoring Tools

Recommended monitoring solutions:

- **Application Performance**: New Relic, DataDog, or Sentry
- **Error Tracking**: Sentry, Rollbar, or Bugsnag
- **Uptime Monitoring**: Pingdom, UptimeRobot, or StatusCake
- **Log Aggregation**: ELK Stack, Splunk, or Papertrail
- **Database Monitoring**: Supabase Dashboard

## 🛠️ Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   ```
   Error: Could not connect to database
   ```
   - Check Supabase credentials in `.env`
   - Verify network connectivity
   - Ensure Supabase project is active
   - Check database permissions

2. **API Key Validation Errors**:
   ```
   Error: Invalid API key
   ```
   - Verify API key format (starts with `gw_live_`, `gw_test_`, etc.)
   - Check key expiration
   - Ensure key is active in database
   - Verify correct authorization header format

3. **Rate Limiting Issues**:
   ```
   Error: Rate limit exceeded
   ```
   - Check rate limit configuration
   - Verify user plan limits
   - Monitor for abuse
   - Consider increasing limits for legitimate users

4. **External API Errors**:
   ```
   Error: Provider API error
   ```
   - Check provider API keys
   - Verify provider API status
   - Check rate limits on provider side
   - Review provider documentation

5. **Import Errors**:
   ```
   ModuleNotFoundError: No module named 'xxx'
   ```
   - Ensure virtual environment is activated
   - Reinstall dependencies: `pip install -r requirements.txt`
   - Check Python version compatibility

### Debug Mode

Enable detailed logging for debugging:

```env
ENVIRONMENT=development
LOG_LEVEL=DEBUG
```

### Performance Optimization

1. **Database Optimization**:
   - Add appropriate indexes
   - Optimize queries (use EXPLAIN ANALYZE)
   - Use connection pooling
   - Cache frequently accessed data

2. **Caching**:
   - Enable Redis for caching
   - Cache model lists (5-minute TTL)
   - Cache user data where appropriate
   - Implement cache invalidation strategy

3. **Rate Limiting**:
   - Use Redis for distributed rate limiting
   - Configure appropriate limits per plan
   - Monitor and adjust based on usage patterns

## 🎓 Next Steps

After successful setup:

1. **Create your first user**:
   - Use admin endpoints or Privy authentication
   - Generate API keys for testing

2. **Test API endpoints**:
   - Use the `/docs` interface
   - Make test requests to chat completions
   - Try image generation

3. **Configure additional features**:
   - Set up Stripe for payments
   - Configure email notifications
   - Enable referral system

4. **Deploy to production**:
   - Choose deployment platform
   - Configure production environment variables
   - Set up monitoring and alerts

5. **Read advanced documentation**:
   - [Architecture](architecture.md)
   - [API Reference](api.md)
   - [Operations Guide](operations.md)

## 📞 Support

For setup assistance:

- **Documentation**: Check [Troubleshooting Guide](troubleshooting.md)
- **Issues**: Create [GitHub Issue](https://github.com/your-org/api-gateway-vercel/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/your-org/api-gateway-vercel/discussions)
- **Email**: support@yourdomain.com

## 🤝 Contributing

Found an issue or want to improve the setup process?

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [Contributing Guide](contributing.md) for details.

---

**Setup complete!** 🎉 You're ready to start using the AI Gateway!
