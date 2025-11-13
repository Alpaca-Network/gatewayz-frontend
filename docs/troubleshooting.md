# Troubleshooting

## Common Issues and Solutions

### Database Connection Issues

#### Database Connection Failed
**Symptoms:**
- Application fails to start with database connection errors
- Health check returns "disconnected" for database status
- API calls fail with database-related errors

**Solutions:**
1. **Verify Environment Variables**
   ```bash
   # Check if environment variables are set
   echo $SUPABASE_URL
   echo $SUPABASE_KEY
   ```

2. **Test Supabase Connection**
   ```bash
   # Test connection directly
   curl -H "apikey: $SUPABASE_KEY" "$SUPABASE_URL/rest/v1/"
   ```

3. **Check Supabase Project Status**
   - Verify project is active in Supabase dashboard
   - Check if project is paused or suspended
   - Ensure billing is up to date

4. **Verify Database Tables**
   - Ensure required tables exist: `users`, `api_keys`, `usage_records`, etc.
   - Check notification tables: `notification_templates`, `password_reset_tokens`
   - Check Row Level Security (RLS) policies
   - Verify table permissions for the API key

**Error Messages:**
```
Failed to initialize Supabase client: Invalid API key
Database connection test failed: Connection refused
```

### Environment Variable Issues

#### Missing Environment Variables
**Symptoms:**
- Application fails to start with validation errors
- Clear error messages about missing variables
- Configuration validation failures

**Solutions:**
1. **Check .env File**
   ```bash
   # Ensure ..env file exists and is readable
   ls -la ..env
   cat ..env
   ```

2. **Verify Required Variables**
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your_supabase_anon_key
   OPENROUTER_API_KEY=sk-or-v1-your_key
   ```

3. **Check File Location**
   - Ensure `.env` file is in project root directory
   - Verify file permissions are correct
   - Check for typos in variable names

4. **Restart Application**
   ```bash
   # Restart after environment changes
   uvicorn app:app --reload
   ```

**Error Messages:**
```
Missing required environment variables: SUPABASE_URL, OPENROUTER_API_KEY
Please create a .env file with the following variables...
```

### OpenRouter Connection Issues

#### OpenRouter Connection Failed
**Symptoms:**
- Health check returns "unavailable" for OpenRouter status
- Chat completion requests fail with authentication errors
- Model listing fails

**Solutions:**
1. **Verify API Key**
   ```bash
   # Test OpenRouter API key directly
   curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
        "https://openrouter.ai/api/v1/models"
   ```

2. **Check Account Status**
   - Verify OpenRouter account is active
   - Check if account has sufficient credits
   - Ensure API key is not expired or revoked

3. **Test Network Connectivity**
   ```bash
   # Test basic connectivity
   ping openrouter.ai
   curl -I https://openrouter.ai/api/v1/models
   ```

4. **Check Rate Limits**
   - Verify not hitting OpenRouter rate limits
   - Check account usage and limits
   - Monitor for rate limit headers in responses

**Error Messages:**
```
OpenRouter authentication error
OpenRouter service unavailable
Failed to fetch models from OpenRouter
```

### Authentication Issues

#### Invalid API Key Errors
**Symptoms:**
- 401 Unauthorized errors
- "Invalid API key" messages
- Authentication failures

**Solutions:**
1. **Verify API Key Format**
   - Check key starts with correct prefix: `gw_live_`, `gw_test_`, etc.
   - Ensure key is complete and not truncated
   - Verify no extra spaces or characters

2. **Check Key Status**
   ```bash
   # Test API key
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        "http://localhost:8000/user/balance"
   ```

3. **Verify Key in Database**
   - Check if key exists in `api_keys` table
   - Verify key is active (`is_active = true`)
   - Check expiration date if set

4. **Check IP/Domain Restrictions**
   - Verify client IP is in allowlist
   - Check domain restrictions if configured
   - Review audit logs for blocked attempts

**Error Messages:**
```
401 Unauthorized - Invalid API key
403 Forbidden - IP address not allowed
403 Forbidden - Domain not allowed for this API key
```

### Rate Limiting Issues

#### Rate Limit Exceeded
**Symptoms:**
- 429 Too Many Requests errors
- Rate limit exceeded messages
- Requests blocked due to limits

**Solutions:**
1. **Check Current Usage**
   ```bash
   # Get current rate limit status
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        "http://localhost:8000/user/limit"
   ```

2. **Review Rate Limit Configuration**
   - Check configured limits for the user
   - Verify plan-based limits
   - Review admin monitor for system-wide limits

3. **Wait for Reset**
   - Rate limits reset at minute, hour, and day boundaries
   - Check reset times in rate limit response
   - Consider implementing exponential backoff

4. **Adjust Limits if Needed**
   ```bash
   # Update rate limits (admin only)
   curl -X POST "http://localhost:8000/admin/limit" \
        -H "Content-Type: application/json" \
        -d '{"api_key": "YOUR_API_KEY", "rate_limits": {...}}'
   ```

**Error Messages:**
```
429 Too Many Requests - Rate limit exceeded
429 Too Many Requests - Plan limit exceeded
```

### CORS Issues

#### CORS Configuration Problems
**Symptoms:**
- Browser CORS errors
- Preflight request failures
- Cross-origin requests blocked

**Solutions:**
1. **Check CORS Configuration**
   ```python
   # In app.py, CORS is configured as:
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # Allows all origins
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

2. **Tighten CORS for Production**
   ```python
   # For production, restrict origins
   allow_origins=["https://yourdomain.com", "https://app.yourdomain.com"]
   ```

3. **Check Request Headers**
   - Ensure proper Content-Type headers
   - Verify Authorization header format
   - Check for custom headers

4. **Test with curl**
   ```bash
   # Test without CORS issues
   curl -X POST "http://localhost:8000/v1/chat/completions" \
        -H "Authorization: Bearer YOUR_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model": "test", "messages": [{"role": "user", "content": "test"}]}'
   ```

### Performance Issues

#### Slow Response Times
**Symptoms:**
- High response times
- Timeout errors
- Slow model loading

**Solutions:**
1. **Check Model Cache**
   ```bash
   # Check cache status
   curl "http://localhost:8000/admin/cache-status"
   
   # Refresh cache if needed
   curl -X POST "http://localhost:8000/admin/refresh-models"
   ```

2. **Monitor Database Performance**
   - Check Supabase dashboard for slow queries
   - Review database connection pool
   - Monitor query execution times

3. **Check External API Performance**
   - Monitor OpenRouter API response times
   - Check for rate limiting or throttling
   - Verify network connectivity

4. **Review Application Logs**
   - Check for error patterns
   - Monitor resource usage
   - Look for bottlenecks

### Deployment Issues

#### Testing Deployment
**Symptoms:**
- Application works locally but fails in production
- Environment-specific errors
- Deployment failures

**Solutions:**
1. **Verify Environment Variables**
   ```bash
   # Check environment variables in production
   vercel .env ls  # For Vercel
   heroku config  # For Heroku
   ```

2. **Test Health Endpoint**
   ```bash
   # Test production health
   curl "https://your-app.vercel.app/health"
   ```

3. **Check Logs**
   ```bash
   # View production logs
   vercel logs  # For Vercel
   heroku logs --tail  # For Heroku
   ```

4. **Test API Endpoints**
   ```bash
   # Test key endpoints
   curl "https://your-app.vercel.app/models"
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        "https://your-app.vercel.app/user/balance"
   ```

## Diagnostic Tools

### Health Check
```bash
# Basic health check
curl "http://localhost:8000/health"
```

### API Key Validation
```bash
# Test API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "http://localhost:8000/user/balance"
```

### Model Cache Status
```bash
# Check cache status
curl "http://localhost:8000/admin/cache-status"
```

### Rate Limit Status
```bash
# Check rate limits
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "http://localhost:8000/user/limit"
```

### Email Service Status
```bash
# Check notification stats
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "http://localhost:8000/admin/notifications/stats"

# Test email template
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
     "http://localhost:8000/user/notifications/test?notification_type=welcome"
```

## Getting Help

### Log Analysis
1. **Check Application Logs**: Look for error patterns and stack traces
2. **Review Database Logs**: Check Supabase dashboard for query issues
3. **Monitor External APIs**: Check OpenRouter and other service status
4. **Email Logs**: Check Resend dashboard for email delivery issues
5. **Health Endpoint**: Use health check for system status

## Email Troubleshooting

### Email Delivery Issues

#### Emails Not Being Sent
**Symptoms:**
- Users not receiving welcome emails after registration
- Password reset emails not arriving
- Notification emails not being delivered

**Solutions:**
1. **Verify Resend Configuration**
   ```bash
   # Check environment variables
   echo $RESEND_API_KEY
   echo $FROM_EMAIL
   echo $APP_NAME
   echo $APP_URL
   ```

2. **Test Email Service**
   ```bash
   # Test notification endpoint
   curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
        "http://localhost:8000/user/notifications/test?notification_type=welcome"
   ```

3. **Check Resend Dashboard**
   - Verify API key is valid and active
   - Check domain verification status
   - Review delivery logs and bounce rates
   - Ensure sending limits are not exceeded

4. **Verify Email Templates**
   - Check if templates exist in database
   - Validate template variables and formatting
   - Test template rendering with sample data

**Error Messages:**
```
Failed to send email: Invalid API key
Email delivery failed: Domain not verified
Template not found: welcome_email
```

### Email Template Issues

#### Template Rendering Errors
**Symptoms:**
- Emails with broken HTML or missing content
- Template variable substitution failures
- CSS styling issues in emails

**Solutions:**
1. **Check Template Variables**
   - Ensure all required variables are provided
   - Verify variable names match template placeholders
   - Check for missing or null values

2. **Validate HTML Templates**
   - Check for unescaped characters in HTML
   - Verify CSS syntax and escaping
   - Test template rendering with sample data

3. **Test Template Endpoints**
   ```bash
   # Test specific template
   curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
        "http://localhost:8000/user/notifications/test?notification_type=low_balance"
   ```

### Password Reset Issues

#### Reset Tokens Not Working
**Symptoms:**
- Password reset links not working
- Tokens expiring too quickly
- Reset requests not being processed

**Solutions:**
1. **Check Token Generation**
   - Verify tokens are being created in database
   - Check token expiration times
   - Ensure tokens are properly formatted

2. **Verify Email Links**
   - Check if reset links are properly formatted
   - Verify APP_URL environment variable
   - Test link generation and validation

3. **Check Token Cleanup**
   - Ensure used tokens are marked as used
   - Verify expired tokens are cleaned up
   - Check token validation logic

### Common Error Codes
- **400**: Bad Request - Check request format and parameters
- **401**: Unauthorized - Verify API key and authentication
- **403**: Forbidden - Check permissions and restrictions
- **429**: Too Many Requests - Review rate limits and usage
- **500**: Internal Server Error - Check logs for server issues
- **503**: Service Unavailable - Check external service status

## Testing and Development Issues

### Cryptography Module Failures

#### ModuleNotFoundError: No module named '_cffi_backend'
**Symptoms:**
- Tests fail with `pyo3_runtime.PanicException: Python API call failed`
- Error message: `ModuleNotFoundError: No module named '_cffi_backend'`
- Cryptography-related imports fail during test execution
- Hundreds of test errors related to encryption/security modules

**Root Cause:**
The `cryptography` package (v41.0.7) depends on `cffi` (C Foreign Function Interface) for its low-level cryptographic operations. While `cffi` is a transitive dependency, it may not be installed in certain environments or Docker containers.

**Solutions:**
1. **Install cffi Explicitly**
   ```bash
   # Install cffi package
   pip install cffi

   # Or with system packages
   pip install cffi --break-system-packages --user
   ```

2. **Reinstall Cryptography with Dependencies**
   ```bash
   # Reinstall cryptography to ensure all dependencies
   pip install --force-reinstall cryptography==41.0.7
   ```

3. **System-Level Dependencies**
   ```bash
   # On Debian/Ubuntu systems, install build dependencies
   apt-get update
   apt-get install -y python3-dev libffi-dev build-essential

   # Then reinstall Python packages
   pip install cffi cryptography
   ```

4. **Verify Installation**
   ```bash
   # Test cffi import
   python -c "import _cffi_backend; print('cffi OK')"

   # Test cryptography import
   python -c "from cryptography.fernet import Fernet; print('cryptography OK')"
   ```

**Prevention:**
- Ensure all dependencies from `requirements.txt` are installed
- Use virtual environments to isolate dependencies
- In Docker, install system dependencies before Python packages:
  ```dockerfile
  RUN apt-get update && apt-get install -y \
      python3-dev \
      libffi-dev \
      build-essential \
      && rm -rf /var/lib/apt/lists/*
  ```

**Error Messages:**
```
pyo3_runtime.PanicException: Python API call failed
ModuleNotFoundError: No module named '_cffi_backend'
thread '<unnamed>' panicked at /usr/share/cargo/registry/pyo3-0.20.2/src/err/mod.rs:788:5:
Python API call failed
```

### Test Suite Issues

#### Database Not Available During Testing
**Symptoms:**
- Many tests skip with "Database not available: Supabase client initialization failed"
- Integration tests don't run
- Database-dependent tests are automatically skipped

**Expected Behavior:**
This is normal for CI/CD environments and local testing without database credentials. The test suite is designed to:
- Pass all unit tests (core logic, schemas, services)
- Skip integration tests that require live database connections
- Skip tests requiring external API credentials

**Solutions:**
1. **For Full Integration Testing**
   ```bash
   # Set up environment variables
   export SUPABASE_URL=your_supabase_url
   export SUPABASE_KEY=your_supabase_key

   # Run tests
   pytest -v
   ```

2. **Run Only Unit Tests**
   ```bash
   # Skip integration tests
   pytest -m "not integration" -v
   ```

3. **Run with Live API Tests**
   ```bash
   # Enable external API tests
   pytest --run-live-tests -v
   ```

### Support Resources
- **Documentation**: Check other docs in this directory
- **API Documentation**: Visit `/docs` endpoint for interactive API docs
- **Logs**: Review application and platform logs
- **Community**: Join discussions and get help from community
- **Test Reports**: See `docs/TEST_REPORT_*.md` for detailed test results
