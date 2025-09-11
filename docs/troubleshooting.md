# Troubleshooting

## Database connection failed
- Verify SUPABASE_URL and SUPABASE_KEY
- Ensure expected tables exist and RLS policies permit operations

## Missing environment variables
- Ensure .env contains SUPABASE_URL, SUPABASE_KEY, OPENROUTER_API_KEY
- Config.validate enforces these unless VERCEL is set

## OpenRouter connection failed
- Verify OPENROUTER_API_KEY
- Ensure sufficient credits and active key

## CORS issues
- Default CORS allows all origins in app.py
- Tighten or adjust for your environment

## Rate limit or entitlement errors
- Check configured limits and active plan for the user/key
- Review admin monitor metrics

## Testing deployment
- Use curl examples from DEPLOYMENT.md to validate endpoints post-deploy
