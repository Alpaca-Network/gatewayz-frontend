# Environment Configuration

The AI Gateway application uses environment variables for configuration, managed through the `config.py` module with comprehensive validation and error handling.

## Environment Variables

### Required Variables

#### Supabase Configuration
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```
- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_KEY**: Your Supabase anonymous/public key
- **Purpose**: Database connection and authentication

#### OpenRouter Configuration
```env
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key
```
- **OPENROUTER_API_KEY**: Your OpenRouter API key for AI model access
- **Purpose**: Authentication with OpenRouter API for AI model requests

#### Email Configuration
```env
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com
APP_NAME=AI Gateway
APP_URL=https://yourdomain.com
```
- **RESEND_API_KEY**: Your Resend API key for email delivery
- **FROM_EMAIL**: Email address for sending notifications
- **APP_NAME**: Application name used in email templates
- **APP_URL**: Base URL for email links and dashboard access
- **Purpose**: Professional email notifications and user communication

### Optional Variables

#### OpenRouter Site Information
```env
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Your Site Name
```
- **OPENROUTER_SITE_URL**: Your website URL (default: `https://your-site.com`)
- **OPENROUTER_SITE_NAME**: Your site name (default: `Openrouter AI Gateway`)
- **Purpose**: Identification headers sent to OpenRouter API

#### Deployment Environment
```env
VERCEL=1
```
- **VERCEL**: Automatically set by Vercel deployment platform
- **Purpose**: Skips environment validation to prevent startup failures

## Configuration Management

### Config Class (`config.py`)
The application uses a centralized configuration class with the following features:

#### Validation
- **Required Variables**: Validates all required environment variables are present
- **Error Messages**: Clear, actionable error messages for missing variables
- **Startup Validation**: Runs on application startup to catch configuration issues early

#### Environment-Specific Behavior
- **Local Development**: Strict validation of all required variables
- **Vercel Deployment**: Validation skipped when `VERCEL` environment variable is set
- **Graceful Degradation**: Application continues with warnings for missing optional variables

#### Helper Methods
- **`validate()`**: Validates required environment variables
- **`get_supabase_config()`**: Returns Supabase configuration as tuple
- **Error Handling**: Comprehensive error messages with setup instructions

## Environment File Setup

### Local Development
Create a `.env` file in the project root:

```env
# Supabase Configuration
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-1234567890abcdef...

# Optional: Site Information
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Your AI Gateway
```

### Production Deployment
Environment variables are typically set through your deployment platform:

#### Vercel
```bash
# Set environment variables via Vercel CLI
vercel env add SUPABASE_URL
vercel env add SUPABASE_KEY
vercel env add OPENROUTER_API_KEY
vercel env add OPENROUTER_SITE_URL
vercel env add OPENROUTER_SITE_NAME
```

#### Other Platforms
- **Railway**: Set via dashboard or CLI
- **Heroku**: Set via dashboard or CLI
- **DigitalOcean**: Set via App Platform dashboard
- **AWS Lambda**: Set via AWS Console or CLI

## Security Considerations

### Environment Variable Security
- **Never Commit**: Never commit `.env` files to version control
- **Secure Storage**: Use secure methods to store production environment variables
- **Access Control**: Limit access to environment variables in production
- **Rotation**: Regularly rotate API keys and secrets

### API Key Management
- **OpenRouter API Key**: Keep secure and rotate regularly
- **Supabase Keys**: Use appropriate key types (anon vs service role)
- **Environment Separation**: Use different keys for development and production

## Validation and Error Handling

### Startup Validation
The application validates environment variables on startup:

```python
# Example validation output
Config.validate()
# Success: Application starts normally
# Failure: Clear error message with missing variables
```

### Error Messages
When validation fails, the application provides clear error messages:

```
Missing required environment variables: SUPABASE_URL, OPENROUTER_API_KEY
Please create a .env file with the following variables:
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_SITE_URL=your_site_url (optional)
OPENROUTER_SITE_NAME=your_site_name (optional)
```

### Graceful Degradation
- **Missing Optional Variables**: Application continues with defaults
- **Missing Required Variables**: Application fails with clear error message
- **Invalid Values**: Application fails with validation error

## Environment-Specific Configuration

### Development
- **Strict Validation**: All required variables must be present
- **Debug Logging**: Verbose logging for troubleshooting
- **Hot Reload**: Automatic reload on code changes

### Production
- **Optimized Validation**: Skip validation when `VERCEL` is set
- **Error Logging**: Comprehensive error logging
- **Performance**: Optimized for production load

### Testing
- **Test Environment**: Use separate environment variables for testing
- **Mock Services**: Use mock services for external dependencies
- **Isolated Data**: Use separate database for testing

## Troubleshooting

### Common Issues

#### Missing Environment Variables
- **Symptom**: Application fails to start with validation error
- **Solution**: Ensure all required variables are set in `.env` file
- **Check**: Verify `.env` file is in project root directory

#### Invalid API Keys
- **Symptom**: External API calls fail with authentication errors
- **Solution**: Verify API keys are correct and active
- **Check**: Test API keys directly with external services

#### Environment File Not Loaded
- **Symptom**: Environment variables not recognized
- **Solution**: Ensure `.env` file exists and is properly formatted
- **Check**: Verify `python-dotenv` package is installed

#### Production Environment Issues
- **Symptom**: Application works locally but fails in production
- **Solution**: Verify environment variables are set in deployment platform
- **Check**: Check deployment platform environment variable configuration

## Best Practices

### Environment Management
- **Separate Environments**: Use different configurations for dev/staging/production
- **Version Control**: Never commit environment files
- **Documentation**: Document all required environment variables
- **Validation**: Always validate environment variables on startup

### Security
- **Least Privilege**: Use minimum required permissions for API keys
- **Rotation**: Regularly rotate API keys and secrets
- **Monitoring**: Monitor for unauthorized access to environment variables
- **Auditing**: Log environment variable access and changes

### Development
- **Local Development**: Use `.env` files for local development
- **Testing**: Use separate environment for testing
- **Documentation**: Keep environment variable documentation up to date
- **Validation**: Test environment variable validation regularly
