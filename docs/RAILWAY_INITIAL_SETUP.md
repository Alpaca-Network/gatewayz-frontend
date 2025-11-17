# Railway Initial Deployment Setup

Complete guide to automatically create and deploy your first container to Railway.

## Overview

This guide covers the **one-time setup** to get your application running on Railway. After this, all deployments are automatic.

### What This Does

The initialization script will:
1. ✅ Authenticate with Railway
2. ✅ Select your project
3. ✅ Deploy current code as initial container
4. ✅ Configure environment variables
5. ✅ Verify deployment is working
6. ✅ Set up domain

### Timeline

- **Total time**: ~15-20 minutes (mostly waiting for build)
- **Active setup time**: ~5 minutes
- **Build time**: 2-3 minutes

---

## Prerequisites

### 1. Railway Project

Create a Railway project if you don't have one:

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Blank Project"**
4. Name it (e.g., "Gatewayz Backend")
5. Copy the **Project ID** from the URL or dashboard

### 2. Railway API Token

Get your API token:

1. Go to https://railway.app
2. Account (top right) → **Settings** → **Tokens**
3. Click **"Create New Token"**
4. Copy the token (starts with `rwy_`)

### 3. Environment Variables

Prepare your environment variables. These will be needed after deployment:

From your `.env` file or `src/config/config.py`, you need:

```
ENVIRONMENT=production
SUPABASE_URL=...
SUPABASE_KEY=...
OPENROUTER_API_KEY=...
PORTKEY_API_KEY=...
FEATHERLESS_API_KEY=...
CHUTES_API_KEY=...
DEEPINFRA_API_KEY=...
FIREWORKS_API_KEY=...
TOGETHER_API_KEY=...
HUGGINGFACE_API_KEY=...
ENCRYPTION_KEY=...
ADMIN_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RESEND_API_KEY=...
STATSIG_SDK_KEY=...
POSTHOG_API_KEY=...
JWT_SECRET=...
REDIS_URL=... (optional, if using Redis)
```

---

## Step-by-Step Setup

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

Or if you have Homebrew:
```bash
brew install railway
```

Verify:
```bash
railway --version
```

### Step 2: Set Environment Variables (Optional)

You can provide these upfront or let the script prompt for them:

```bash
export RAILWAY_TOKEN="rwy_..."
export RAILWAY_PROJECT_ID="project-id-here"
```

### Step 3: Run Initial Deployment Script

From the repository root:

```bash
bash scripts/init-railway-deployment.sh
```

The script will:

1. **Authenticate with Railway**
   - Uses your token
   - Connects to your project

2. **Deploy Current Code**
   - Builds container from `railway.json`
   - Uses Nixpacks builder
   - Deploys to Railway

3. **Generate Domain**
   - Creates a Railway-hosted domain
   - Or you can add custom domain later

4. **Verify Deployment**
   - Checks `/health` endpoint
   - Reports status

### Step 4: Add Environment Variables

The script will pause and ask you to configure variables.

**Via Railway Dashboard** (Recommended):

1. Go to https://railway.app
2. Open your project
3. Click **"backend"** service
4. Click **Variables** tab
5. Paste all your environment variables
6. Click **"Save"**

**Via Railway CLI** (Alternative):

```bash
railway env set ENVIRONMENT=production
railway env set SUPABASE_URL="https://..."
railway env set SUPABASE_KEY="..."
# ... set all variables
```

**Via Bulk Upload** (If available):

```bash
# Create .env file in Railway
cat > railway.env << 'EOF'
ENVIRONMENT=production
SUPABASE_URL=...
SUPABASE_KEY=...
EOF

railway env push railway.env
```

### Step 5: Verify Deployment

The script will automatically check if your app is running:

```bash
# Manual health check
curl https://your-railway-domain.railway.app/health

# Should return:
# {"status": "healthy"}
```

If successful:
```
✓ Health check passed!
✓ Your app is live at: https://your-domain.railway.app
```

---

## Setting Environment Variables

### Option 1: Railway Dashboard (Easiest)

1. Go to https://railway.app
2. Project → backend service → Variables
3. Add each variable manually or paste multiple:

```
ENVIRONMENT=production
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=your-key-here
```

Click **Save**. Railway will restart the service.

### Option 2: Railway CLI

```bash
# Set individual variables
railway env set ENVIRONMENT=production
railway env set SUPABASE_URL=https://project.supabase.co
railway env set SUPABASE_KEY=your-key

# View all variables
railway env

# Delete a variable
railway env delete VARIABLE_NAME
```

### Option 3: Environment File

Create a `.railway.env` file:

```
ENVIRONMENT=production
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=key
# ... rest of variables
```

Then:
```bash
railway env push .railway.env
```

---

## Troubleshooting Initial Setup

### "railway: command not found"

Install Railway CLI:
```bash
npm install -g @railway/cli
```

### "Error: Could not switch to project"

The project ID is invalid. Check:
1. Project ID is correct
2. Project exists in your Railway account
3. Token has access to the project

Get correct ID:
```bash
railway project list
```

### Build Fails

Common reasons:
1. **Python dependencies error**: Check `requirements.txt` is valid
2. **Import error**: Verify code runs locally: `python src/main.py`
3. **Missing environment variable**: Not needed for build, but needed at runtime

View build logs:
```bash
railway logs --follow
```

### Health Check Returns 503/502

This usually means:
1. App is still starting (wait 30 seconds)
2. Environment variables not set
3. Database connection failed

Check:
```bash
# View logs
railway logs --follow

# Look for errors like:
# - SUPABASE_URL not set
# - Database connection refused
# - Import errors
```

### Domain Not Generated

Railway may not auto-generate a domain. Add manually:

1. Go to https://railway.app
2. Project → backend service
3. Settings → Networking
4. Click **"Generate Domain"** or add custom domain

### Health Endpoint Not Responding

Ensure your `/health` endpoint:
1. Is implemented in code
2. Responds with HTTP 200
3. Returns valid JSON: `{"status": "healthy"}`

Check in your code:
```python
# src/routes/health.py should have:
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

---

## Useful Commands

### View Logs

```bash
# Live logs
railway logs --follow

# Last 50 lines
railway logs --tail 50

# Specific timeframe
railway logs --since 1h
```

### Check Status

```bash
# Service information
railway service list

# Domain
railway domain

# Environment variables
railway env

# Deployment status
railway deployment list
```

### Manage Service

```bash
# Restart service
railway env --restore

# Redeploy (push current code)
railway up --detach

# View config
railway config
```

---

## After Initial Deployment

### 1. Configure Auto-Deployment

Now that you have an initial container, set up automatic deployments:

```bash
bash scripts/setup-auto-deploy.sh
```

This configures:
- `RAILWAY_TOKEN`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_DOMAIN`

### 2. Test Auto-Deployment

Create a test PR and merge to staging:

```bash
git checkout -b test-auto-deploy
echo "# Test" >> README.md
git add README.md
git commit -m "test: test auto-deployment"
git push origin test-auto-deploy
```

Merge to staging on GitHub. Auto-deployment will trigger.

### 3. Verify It Works

Watch the deployment:
```bash
# GitHub Actions
https://github.com/your-repo/actions

# Railway logs
railway logs --follow
```

---

## Common Patterns

### Update Environment Variables

```bash
# Add new variable
railway env set NEW_VAR=value

# Update existing
railway env set EXISTING_VAR=new-value

# Remove
railway env delete OLD_VAR
```

### Trigger Manual Deployment

```bash
railway up --detach
```

### View Deployment History

```bash
railway deployment list
```

### Rollback to Previous Deployment

```bash
# List deployments
railway deployment list

# The UI makes this easier: https://railway.app
# Deployments tab → select previous → Redeploy
```

---

## Production Checklist

Before going to production, verify:

- [ ] App starts without errors: `railway logs --follow`
- [ ] Health endpoint responds: `curl https://your-domain/health`
- [ ] Database connected: Check logs for connection success
- [ ] All environment variables set: `railway env`
- [ ] Domain is working: `curl https://your-domain/`
- [ ] Auto-deployment configured: `gh secret list`
- [ ] PR monitoring enabled: Check GitHub Actions workflows

---

## Next Steps

1. ✅ Install Railway CLI
2. ✅ Run: `bash scripts/init-railway-deployment.sh`
3. ✅ Configure environment variables in Railway
4. ✅ Verify deployment is working
5. ✅ Run: `bash scripts/setup-auto-deploy.sh`
6. ✅ Test auto-deployment with a test PR

---

## Quick Reference

| Task | Command |
|------|---------|
| View logs | `railway logs --follow` |
| Set variable | `railway env set VAR=value` |
| View variables | `railway env` |
| Deploy manually | `railway up --detach` |
| View deployments | `railway deployment list` |
| Get domain | `railway domain` |
| Restart service | `railway env --restore` |

---

## Support

- **Railway Docs**: https://docs.railway.app
- **Railway CLI**: `railway --help`
- **Our Docs**: `docs/AUTO_DEPLOYMENT_SETUP.md`

Questions? Check the docs or view workflow logs.

---

**Last Updated**: 2025-11-17
**Version**: 1.0
