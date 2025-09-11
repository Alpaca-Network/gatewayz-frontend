# Setup

## Prerequisites
- Python 3.11+
- Supabase project
- OpenRouter API key

## Install
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Configure environment
Edit .env:
- SUPABASE_URL
- SUPABASE_KEY
- OPENROUTER_API_KEY
- OPENROUTER_SITE_URL (optional)
- OPENROUTER_SITE_NAME (optional)

## Run locally
```
uvicorn app:app --reload
# http://localhost:8000/docs
```

## Expected Supabase tables
- users
- api_keys_new
- rate_limit_configs
- usage_records
- plans
- user_plans

These are referenced by db.py and are required for full functionality.

## Python version
The project targets Python 3.11 (see Heroku runtime example in DEPLOYMENT.md).
