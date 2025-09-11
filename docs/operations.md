# Operations

## Health
- GET /health
- Use for uptime and dependency checks (DB, OpenRouter)

## Logs and monitoring
- Vercel: dashboard logs and alerts
- Railway: railway logs
- Heroku: heroku logs --tail
- DigitalOcean: App Platform dashboard

## Usage and rate limits
- User: GET /user/monitor, GET /user/balance
- Admin: GET /admin/monitor
- Configure rate limits: POST /admin/rate_limit

## Model cache
- Refresh: POST /admin/refresh_models
- Status: GET /admin/cache_status
