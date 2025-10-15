# Railway Environment Variables/Secrets

This document lists all environment variables that need to be added to Railway for the Gatewayz backend deployment.

## Required Secrets

### Database (Supabase)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
```

### Primary Gateway
```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=https://modelz.io
OPENROUTER_SITE_NAME=Alpaca
```

### Admin Configuration
```
ADMIN_API_KEY=your-admin-api-key
ADMIN_EMAIL=your-admin-email@example.com
```

### Stripe (Payments)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Email (Resend)
```
RESEND_API_KEY=re_...
FROM_EMAIL=support@api.gatewayz.ai
APP_NAME=Gatewayz
```

### Frontend
```
FRONTEND_URL=https://gatewayz.ai
```

## Optional Provider Secrets

### Portkey
```
PORTKEY_API_KEY=your-portkey-api-key
```

### Provider-Specific Keys (for Portkey)
```
PROVIDER_OPENAI_API_KEY=sk-...
PROVIDER_ANTHROPIC_API_KEY=sk-ant-...
```

### Additional Providers

#### ✨ NEW: Fireworks.ai
```
FIREWORKS_API_KEY=your-fireworks-api-key
```

#### ✨ NEW: Together.ai
```
TOGETHER_API_KEY=your-together-api-key
```

#### Featherless
```
FEATHERLESS_API_KEY=your-featherless-api-key
```

#### Chutes
```
CHUTES_API_KEY=your-chutes-api-key
```

#### Groq
```
GROQ_API_KEY=your-groq-api-key
```

#### DeepInfra
```
DEEPINFRA_API_KEY=your-deepinfra-api-key
```

#### Other Providers
```
XAI_API_KEY=your-xai-api-key
NOVITA_API_KEY=your-novita-api-key
NEBIUS_API_KEY=your-nebius-api-key
CEREBRAS_API_KEY=your-cerebras-api-key
HUG_API_KEY=your-hug-api-key
```

## How to Add Secrets to Railway

1. Go to your Railway project dashboard
2. Select your backend service
3. Click on the "Variables" tab
4. Add each environment variable:
   - Click "+ New Variable"
   - Enter the variable name (e.g., `FIREWORKS_API_KEY`)
   - Enter the value
   - Click "Add"

5. After adding all variables, Railway will automatically redeploy

## New Secrets for Recent Integrations

If you already have Railway deployed, you only need to add these NEW secrets:

```bash
# Fireworks.ai Integration (38 models)
FIREWORKS_API_KEY=your-fireworks-api-key

# Together.ai Integration (100+ models)
TOGETHER_API_KEY=your-together-api-key

# Featherless Integration (100+ models)
FEATHERLESS_API_KEY=your-featherless-api-key

# Groq Integration
GROQ_API_KEY=your-groq-api-key
```

## Verification After Deployment

After adding the secrets and Railway redeploys, verify the providers are working:

```bash
# Test Fireworks
curl https://your-railway-app.up.railway.app/catalog/models?gateway=fireworks

# Test Together
curl https://your-railway-app.up.railway.app/catalog/models?gateway=together

# Test all providers
curl https://your-railway-app.up.railway.app/catalog/models?gateway=all
```

## Priority Order

### Minimum Required (for basic functionality)
1. SUPABASE_URL
2. SUPABASE_KEY
3. OPENROUTER_API_KEY
4. PORTKEY_API_KEY
5. STRIPE_SECRET_KEY
6. RESEND_API_KEY

### Highly Recommended
7. ADMIN_API_KEY
8. ADMIN_EMAIL
9. FRONTEND_URL
10. FIREWORKS_API_KEY ✨ NEW
11. TOGETHER_API_KEY ✨ NEW
12. FEATHERLESS_API_KEY ✨ UPDATED
13. GROQ_API_KEY ✨ UPDATED

### Optional (for additional provider support)
- CHUTES_API_KEY (already configured)
- Other provider keys as needed

## Security Notes

⚠️ **Never commit API keys to Git**
- Keys should only be in Railway's environment variables
- Use different keys for development and production
- Rotate keys periodically
- Monitor usage for suspicious activity

## Railway Deployment Tips

1. **Auto-Deploy**: Railway will auto-deploy when you push to main
2. **Build Logs**: Check build logs if deployment fails
3. **Runtime Logs**: Monitor runtime logs for API errors
4. **Health Check**: Use `/health` endpoint to verify deployment
5. **Environment**: All secrets are available at runtime

## Common Issues

### "Provider not configured" errors
- Ensure the API key variable name matches exactly (case-sensitive)
- Verify the key value doesn't have extra spaces
- Check Railway deployment logs for configuration errors

### Models not appearing in frontend
- Verify all required secrets are added
- Check that Railway has redeployed after adding secrets
- Test the catalog endpoint directly

### Authentication errors
- Verify API keys are valid
- Check if keys have correct prefixes (fw_, tgp_v1_, etc.)
- Ensure keys haven't expired or been revoked

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Test endpoints directly with curl
3. Verify environment variables are set correctly
4. Review [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) for detailed deployment guide