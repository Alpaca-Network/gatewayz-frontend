TitleSection: How to Run the Gatewayz Backend Locally

Overview
This guide explains how to run the FastAPI backend locally after the recent initialization refactor (create_app factory with startup events). It also covers basic verification, environment variables, and running tests.

Prerequisites
- Python 3.10+ (recommended)
- pip
- Optional (for certain features): Redis (see setup scripts), valid Supabase credentials

1) Clone and set up a virtual environment
- Clone the repository and open a terminal in the project root (gatewayz-backend)
- Create and activate a virtual environment
  - macOS/Linux:
    - python3 -m venv .venv
    - source .venv/bin/activate
  - Windows (PowerShell):
    - py -m venv .venv
    - .venv\Scripts\Activate.ps1
- Install dependencies
  - pip install -r requirements.txt

2) Configure environment variables
The app reads settings from environment variables via src/config.py. For full details, see docs/environment.md. Common variables:
- SUPABASE_URL: Your Supabase project URL
- SUPABASE_KEY: Your Supabase service role key
- GATEWAY_DB: Path to a SQLite DB file for local dev (e.g., ./gateway.db). Tests set this dynamically.
- ADMIN_API_KEY: Token required for admin endpoints (default is "admin_key_placeholder"; set your own)
- VERCEL_API_KEY: Required by some routes or integrations in tests

Example (macOS/Linux):
- export SUPABASE_URL="https://your-project.supabase.co"
- export SUPABASE_KEY="your-supabase-service-role-key"
- export GATEWAY_DB="./gateway.db"
- export ADMIN_API_KEY="my-local-admin-key"
- export VERCEL_API_KEY="test-vercel-key"

On Windows (PowerShell), use:
- $env:SUPABASE_URL="https://your-project.supabase.co"
- $env:SUPABASE_KEY="your-supabase-service-role-key"
- $env:GATEWAY_DB="./gateway.db"
- $env:ADMIN_API_KEY="my-local-admin-key"
- $env:VERCEL_API_KEY="test-vercel-key"

3) Run the server (choose one)
- Standard app import path (recommended):
  - uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
- Factory mode (equivalent; uses create_app):
  - uvicorn "src.main:create_app" --factory --host 0.0.0.0 --port 8000 --reload

Notes:
- The application no longer performs configuration validation and DB checks at import time.
- Validation and optional DB initialization run during FastAPI startup events, making imports test-friendly.

4) Verify the server
- Health check:
  - curl http://127.0.0.1:8000/health
- Root endpoint:
  - curl http://127.0.0.1:8000/

If you see a healthy response (status 200), the server is running correctly.

5) Try an admin endpoint (optional)
Admin endpoints use bearer auth with ADMIN_API_KEY.
- Example: create a user with credits
  - curl -X POST \
    -H "Authorization: Bearer $ADMIN_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"credits": 10}' \
    http://127.0.0.1:8000/admin/create_user
- Example: add credits
  - curl -X POST \
    -H "Authorization: Bearer $ADMIN_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"api_key": "<user_api_key>", "credits": 5}' \
    http://127.0.0.1:8000/admin/add_credits

6) Run tests
- Ensure your virtual environment is active and required env vars are set (tests set some values internally).
- pytest -q

Troubleshooting
- Supabase connection issues: verify SUPABASE_URL and SUPABASE_KEY. The startup may log connection errors but keep the app running for local development. See docs/troubleshooting.md.
- Admin auth failures: ensure Authorization header is set to "Bearer <ADMIN_API_KEY>" and ADMIN_API_KEY matches your environment.
- Port already in use: change --port or stop the conflicting process.
- Redis features: some features may require Redis. See setup_local_redis.bat or setup_redis_wsl.bat for Windows helpers.

Deployment Notes
- Vercel: The repository includes vercel.json. The default export app = create_app() in src/main.py is compatible with serverless deployments. See docs/deployment.md for details.

Related Documentation
- docs/environment.md: Full list of environment variables
- docs/setup.md: Broader setup instructions
- docs/troubleshooting.md: Common issues and fixes
- docs/api.md: API reference and endpoints
