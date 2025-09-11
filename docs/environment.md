# Environment

Environment variables read in config.py:
- SUPABASE_URL
- SUPABASE_KEY
- OPENROUTER_API_KEY
- OPENROUTER_SITE_URL (default: https://your-site.com)
- OPENROUTER_SITE_NAME (default: Openrouter AI Gateway)

Validation
- Config.validate ensures required variables are set
- Skips validation when VERCEL is set

Example .env:
```
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_KEY=ey...
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Your Site Name
```
