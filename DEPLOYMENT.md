# Deployment Guide

This guide covers deploying the OpenRouter AI Gateway with Supabase to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. ✅ Supabase project set up with the `users` table
2. ✅ OpenRouter API key
3. ✅ Environment variables configured

## Platform-Specific Deployment

### 1. Vercel Deployment

#### Option A: Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Create `vercel.json` configuration:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.py"
    }
  ]
}
```

3. Deploy:
```bash
vercel
```

#### Option B: GitHub Integration

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_SITE_URL` (optional)
   - `OPENROUTER_SITE_NAME` (optional)

### 2. Railway Deployment

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login and deploy:
```bash
railway login
railway init
railway up
```

3. Set environment variables:
```bash
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_KEY=your_supabase_key
railway variables set OPENROUTER_API_KEY=your_openrouter_key
railway variables set OPENROUTER_SITE_URL=https://your-site.com
railway variables set OPENROUTER_SITE_NAME=Your Site Name
```

### 3. Heroku Deployment

1. Create `Procfile`:
```
web: uvicorn app:app --host 0.0.0.0 --port $PORT
```

2. Create `runtime.txt`:
```
python-3.11.0
```

3. Deploy:
```bash
heroku create your-app-name
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_KEY=your_supabase_key
heroku config:set OPENROUTER_API_KEY=your_openrouter_key
heroku config:set OPENROUTER_SITE_URL=https://your-site.com
heroku config:set OPENROUTER_SITE_NAME=Your Site Name
git push heroku main
```

### 4. DigitalOcean App Platform

1. Create `app.yaml`:
```yaml
name: openrouter-gateway
services:
- name: web
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: uvicorn app:app --host 0.0.0.0 --port $PORT
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: SUPABASE_URL
    value: your_supabase_url
  - key: SUPABASE_KEY
    value: your_supabase_key
  - key: OPENROUTER_API_KEY
    value: your_openrouter_key
  - key: OPENROUTER_SITE_URL
    value: https://your-site.com
  - key: OPENROUTER_SITE_NAME
    value: Your Site Name
```

2. Deploy via DigitalOcean dashboard or CLI

### 5. AWS Lambda (Serverless)

1. Create `serverless.yml`:
```yaml
service: openrouter-gateway

provider:
  name: aws
  runtime: python3.11
  region: us-east-1
  environment:
    SUPABASE_URL: ${env:SUPABASE_URL}
    SUPABASE_KEY: ${env:SUPABASE_KEY}
    OPENROUTER_API_KEY: ${env:OPENROUTER_API_KEY}
    OPENROUTER_SITE_URL: ${env:OPENROUTER_SITE_URL}
    OPENROUTER_SITE_NAME: ${env:OPENROUTER_SITE_NAME}

functions:
  api:
    handler: handler.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
```

2. Create `handler.py`:
```python
from mangum import Mangum
from app import app

handler = Mangum(app)
```

3. Install dependencies:
```bash
pip install mangum
```

4. Deploy:
```bash
serverless deploy
```

## Environment Variables

All deployments require these environment variables:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ | `https://abc123.supabase.co` |
| `SUPABASE_KEY` | Your Supabase anon key | ✅ | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `OPENROUTER_API_KEY` | Your OpenRouter API key | ✅ | `sk-or-v1-...` |
| `OPENROUTER_SITE_URL` | Your site URL for rankings | ❌ | `https://your-site.com` |
| `OPENROUTER_SITE_NAME` | Your site name for rankings | ❌ | `Your Site Name` |

## Available Endpoints

### Public Endpoints (No Authentication Required)
- `GET /health` - Health check
- `GET /models/simple` - Get available models list
- `GET /` - API information

### Admin Endpoints (No Authentication Required)
- `POST /admin/create_user` - Create new user
- `POST /admin/add_credits` - Add credits to user
- `GET /admin/balance` - Get all user balances

### Protected Endpoints (Authentication Required)
- `GET /user/balance` - Get user balance
- `POST /v1/chat/completions` - Chat completion

## Health Check Endpoint

The health check endpoint monitors your application status:

```bash
curl https://your-app.vercel.app/health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "openrouter": "connected",
  "user_count": 42,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Monitoring and Logs

### Vercel
- View logs in Vercel dashboard
- Set up alerts for function errors

### Railway
- View logs with `railway logs`
- Set up monitoring in dashboard

### Heroku
- View logs with `heroku logs --tail`
- Set up add-ons for monitoring

### DigitalOcean
- View logs in App Platform dashboard
- Set up monitoring alerts

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify Supabase URL and key
   - Check if the `users` table exists
   - Ensure RLS policies allow your operations

2. **Environment Variables Not Set**
   - Double-check variable names
   - Ensure no extra spaces or quotes
   - Restart the application after setting variables

3. **OpenRouter Connection Failed**
   - Verify OpenRouter API key
   - Check if the key has sufficient credits
   - Ensure the key is active

4. **Import Errors**
   - Ensure all dependencies are in `requirements.txt`
   - Check Python version compatibility

5. **CORS Issues**
   - CORS middleware is already configured in the app
   - If needed, modify the CORS settings in `app.py`

### Testing Deployment

After deployment, test your endpoints:

```bash
# Test health check
curl https://your-app.vercel.app/health

# Test user creation
curl -X POST https://your-app.vercel.app/admin/create_user \
  -H "Content-Type: application/json" \
  -d '{"credits": 1000}'

# Test models endpoint
curl https://your-app.vercel.app/models/simple

# Test chat completion (replace with your API key)
curl -X POST https://your-app.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer mdlz_sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-r1-0528",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 50
  }'
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **CORS**: CORS is configured for development; adjust for production
3. **Rate Limiting**: Consider adding rate limiting middleware
4. **HTTPS**: Ensure all deployments use HTTPS
5. **Environment**: Use production environment variables
6. **User Authentication**: All protected endpoints require valid API keys

## Scaling Considerations

1. **Database**: Supabase handles scaling automatically
2. **Application**: Most platforms auto-scale based on traffic
3. **OpenRouter**: Handles high-volume requests efficiently
4. **Monitoring**: Set up alerts for high usage
5. **Costs**: Monitor usage to avoid unexpected charges

## API Documentation

Once deployed, access the interactive API documentation at:
- Swagger UI: `https://your-app.vercel.app/docs`
- ReDoc: `https://your-app.vercel.app/redoc`

The documentation includes:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Interactive testing interface 