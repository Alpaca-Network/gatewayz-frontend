# Architecture

## Components
- FastAPI application (app.py)
  - CORS enabled for all origins by default
  - Security via HTTP Bearer (API key)
  - Routes grouped for health, models, user, admin, plans, proxy
- Supabase access (supabase_config.py, db.py)
  - Client initialization with Config
  - CRUD and analytics on users, api keys, usage, plans
- OpenRouter integration
  - OpenAI SDK configured with base_url https://openrouter.ai/api/v1
  - Defaults include HTTP-Referer and X-Title headers
- Model cache
  - In-memory cache for OpenRouter models with TTL
  - Admin endpoints to refresh and inspect cache

## Data flow
- Requests authenticate via get_api_key dependency
- Business logic executes DB operations via db.py
- For chat completions, request is proxied to OpenRouter and usage recorded
- Rate limits and plan entitlements enforced via db helpers

## Security notes
- Do not expose real API keys
- Tighten CORS for production
- Consider rate limiting at infra layer as well
