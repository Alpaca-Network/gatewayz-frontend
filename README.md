# AI Gateway API (FastAPI)
OpenRouter proxy with user credits, API key management, rate limits, and subscription plan entitlements. Built with FastAPI and Supabase.

- Core app: app.py
- Data access: db.py, supabase_config.py
- Models/schemas: models.py
- Deployment guide: DEPLOYMENT.md

## Quickstart
Prerequisites:
- Python 3.11+
- Supabase project with required tables
- OpenRouter API key

Setup:
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in values
uvicorn app:app --reload
```

Environment variables:
- SUPABASE_URL
- SUPABASE_KEY
- OPENROUTER_API_KEY
- OPENROUTER_SITE_URL (optional)
- OPENROUTER_SITE_NAME (optional)

Details: docs/environment.md

## API Overview
Public:
- GET /health
- GET /models
- GET /models/providers

Authenticated (HTTP Bearer token = your API key):
- GET /user/balance
- GET /user/monitor
- API Key management (create/list/update/delete)
- Plan endpoints (list/get/assign/usage/entitlements)
- POST /v1/chat/completions (OpenAI-compatible)

Examples:
```
curl http://localhost:8000/health
```

```
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-r1-0528",
    "messages": [{"role":"user","content":"Hello"}],
    "max_tokens": 50
  }'
```

Full endpoint details: docs/api.md

## Architecture
- FastAPI app with CORS enabled
- Supabase as data store (users, api_keys_new, rate_limit_configs, usage_records, plans, user_plans)
- OpenRouter via OpenAI SDK
- Model list cache with manual refresh

More: docs/architecture.md

## Deployment
See DEPLOYMENT.md for Vercel, Railway, Heroku, DigitalOcean, AWS Lambda.
Vercel config: vercel.json

Brief summary: docs/deployment.md

## Operations
Health checks, cache control, monitoring: docs/operations.md

## Troubleshooting
Common issues and fixes: docs/troubleshooting.md

## Contributing
Guidelines and local workflows: docs/contributing.md

## License
TBD
