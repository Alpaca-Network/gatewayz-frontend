# Activity Logging System

## Overview

The Gatewayz backend now automatically logs all user activity to the `activity_log` table in Supabase. This provides comprehensive tracking of API usage, authentication events, and session management for analytics and auditing purposes.

## What Gets Logged

### 1. **Chat Completions** (`/v1/chat/completions`)

Every chat completion request (both streaming and non-streaming) logs:

```json
{
  "user_id": 123,
  "model": "deepseek/deepseek-r1-0528",
  "provider": "DeepSeek",
  "tokens": 1500,
  "cost": 0.0075,
  "speed": 45.2,
  "finish_reason": "stop",
  "app": "API",
  "metadata": {
    "prompt_tokens": 500,
    "completion_tokens": 1000,
    "endpoint": "/v1/chat/completions",
    "stream": false,
    "session_id": 456
  }
}
```

### 2. **Unified Responses** (`/v1/responses`)

The new unified API endpoint logs similar data:

```json
{
  "user_id": 123,
  "model": "gpt-4",
  "provider": "OpenAI",
  "tokens": 2000,
  "cost": 0.06,
  "speed": 38.5,
  "finish_reason": "stop",
  "app": "API",
  "metadata": {
    "prompt_tokens": 800,
    "completion_tokens": 1200,
    "endpoint": "/v1/responses",
    "session_id": 456
  }
}
```

### 3. **Authentication** (`/auth`)

Login and registration events are logged:

**Login:**
```json
{
  "user_id": 123,
  "model": "auth",
  "provider": "Privy",
  "tokens": 0,
  "cost": 0.0,
  "finish_reason": "login",
  "app": "Auth",
  "metadata": {
    "action": "login",
    "auth_method": "EMAIL",
    "privy_user_id": "did:privy:...",
    "is_new_user": false
  }
}
```

**Registration:**
```json
{
  "user_id": 124,
  "model": "auth",
  "provider": "Privy",
  "tokens": 0,
  "cost": 0.0,
  "finish_reason": "register",
  "app": "Auth",
  "metadata": {
    "action": "register",
    "auth_method": "GOOGLE",
    "privy_user_id": "did:privy:...",
    "is_new_user": true,
    "initial_credits": 10.0
  }
}
```

### 4. **Chat Sessions** (`/v1/chat/sessions`)

Session creation is logged:

```json
{
  "user_id": 123,
  "model": "gpt-4",
  "provider": "Chat History",
  "tokens": 0,
  "cost": 0.0,
  "finish_reason": "session_created",
  "app": "Chat",
  "metadata": {
    "action": "create_session",
    "session_id": 789,
    "session_title": "My Conversation"
  }
}
```

## Database Schema

### `activity_log` Table

```sql
CREATE TABLE activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model VARCHAR(255) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  speed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  finish_reason VARCHAR(50),
  app VARCHAR(50) NOT NULL DEFAULT 'API',
  metadata JSONB,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_user_timestamp ON activity_log(user_id, timestamp DESC);
CREATE INDEX idx_activity_timestamp ON activity_log(timestamp DESC);
CREATE INDEX idx_activity_model ON activity_log(model);
CREATE INDEX idx_activity_provider ON activity_log(provider);
```

## API Endpoints

### Get Activity Statistics

```bash
GET /user/activity/stats?days=30
```

**Query Parameters:**
- `days` - Number of days to look back (1-365)
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)

**Response:**
```json
{
  "total_requests": 150,
  "total_tokens": 45000,
  "total_spend": 2.35,
  "daily_stats": [
    {
      "date": "2025-01-09",
      "spend": 0.15,
      "tokens": 3000,
      "requests": 10
    }
  ],
  "by_model": {
    "gpt-4": {
      "requests": 50,
      "tokens": 20000,
      "cost": 1.20
    }
  },
  "by_provider": {
    "OpenAI": {
      "requests": 80,
      "tokens": 30000,
      "cost": 1.80
    }
  }
}
```

### Get Activity Log

```bash
GET /user/activity/log?limit=10&page=1
```

**Query Parameters:**
- `limit` - Records per page (1-1000, default 10)
- `page` - Page number (starts at 1)
- `offset` - Alternative to page (records to skip)
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)
- `model` - Filter by model name
- `provider` - Filter by provider name

**Response:**
```json
{
  "logs": [
    {
      "id": 123,
      "user_id": 1,
      "timestamp": "2025-01-09T13:00:00Z",
      "model": "gpt-4",
      "provider": "OpenAI",
      "tokens": 1234,
      "cost": 0.0123,
      "speed": 45.67,
      "finish_reason": "stop",
      "app": "API",
      "metadata": {
        "prompt_tokens": 234,
        "completion_tokens": 1000,
        "endpoint": "/v1/chat/completions"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10
}
```

## Implementation Details

### Activity Logging Function

Located in [`src/db/activity.py`](../src/db/activity.py):

```python
def log_activity(
    user_id: int,
    model: str,
    provider: str,
    tokens: int,
    cost: float,
    speed: float = 0.0,
    finish_reason: str = "stop",
    app: str = "API",
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]
```

**Features:**
- ✅ Non-blocking: Failures don't interrupt main request flow
- ✅ Automatic timestamp in UTC
- ✅ JSONB metadata for flexible additional data
- ✅ Returns created record or None on error

### Provider Detection

The system automatically detects providers from model names:

```python
def get_provider_from_model(model: str) -> str:
    """Determine provider from model name"""
    model_lower = model.lower()

    if 'gpt' in model_lower or 'openai' in model_lower:
        return 'OpenAI'
    elif 'claude' in model_lower or 'anthropic' in model_lower:
        return 'Anthropic'
    elif 'gemini' in model_lower or 'palm' in model_lower:
        return 'Google'
    elif 'deepseek' in model_lower:
        return 'DeepSeek'
    # ... more providers
    else:
        return 'Other'
```

### Error Handling

All activity logging is wrapped in try-except blocks:

```python
try:
    log_activity(
        user_id=user["id"],
        model=model,
        provider=provider_name,
        tokens=total_tokens,
        cost=cost,
        # ...
    )
except Exception as e:
    logger.warning(f"Failed to log activity: {e}")
    # Continue with main request flow
```

This ensures that:
- Activity logging failures never break API requests
- Errors are logged for monitoring
- The system remains resilient

## Frontend Integration

The frontend can now display:

### Activity Dashboard
- Total requests, tokens, and spend
- Daily usage charts
- Model breakdown
- Provider breakdown

### Activity Log
- Paginated list of all activities
- Filterable by date, model, provider
- Detailed metadata for each request

### Real-time Updates
- Activity is logged immediately after each request
- Stats update in real-time as users interact with the API
- No manual refresh needed

## Migration Guide

### Existing Installations

If you're upgrading from an older version:

1. **Create the `activity_log` table:**
   ```sql
   -- Run the SQL schema above
   ```

2. **Verify indexes:**
   ```sql
   \d+ activity_log
   ```

3. **Test activity logging:**
   ```bash
   # Make a chat completion request
   curl -X POST https://your-api.com/v1/chat/completions \
     -H "Authorization: Bearer your_api_key" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}'

   # Check activity was logged
   curl https://your-api.com/user/activity/log \
     -H "Authorization: Bearer your_api_key"
   ```

## Performance Considerations

### Database Indexes

The `activity_log` table has optimized indexes for common queries:
- User + timestamp (most common query)
- Timestamp only (admin queries)
- Model and provider (analytics)

### Retention Policy

Consider implementing a retention policy for old activity logs:

```sql
-- Example: Delete logs older than 1 year
DELETE FROM activity_log
WHERE timestamp < NOW() - INTERVAL '1 year';
```

### Partitioning

For high-volume installations, consider table partitioning by date:

```sql
-- Create monthly partitions
CREATE TABLE activity_log_2025_01 PARTITION OF activity_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## Monitoring

### Key Metrics to Track

1. **Activity Log Growth Rate**
   ```sql
   SELECT DATE(timestamp), COUNT(*)
   FROM activity_log
   GROUP BY DATE(timestamp)
   ORDER BY DATE(timestamp) DESC
   LIMIT 30;
   ```

2. **Failed Logging Attempts**
   - Check application logs for `"Failed to log activity"` warnings

3. **Query Performance**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM activity_log
   WHERE user_id = 123
   ORDER BY timestamp DESC
   LIMIT 10;
   ```

## Troubleshooting

### Activity Not Appearing

1. **Check database connection:**
   ```bash
   # Verify Supabase credentials
   echo $SUPABASE_URL
   echo $SUPABASE_KEY
   ```

2. **Check application logs:**
   ```bash
   # Look for logging errors
   grep "Failed to log activity" logs/app.log
   ```

3. **Verify table exists:**
   ```sql
   SELECT COUNT(*) FROM activity_log;
   ```

### Slow Query Performance

1. **Verify indexes:**
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'activity_log';
   ```

2. **Analyze query plans:**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM activity_log
   WHERE user_id = 123
   AND timestamp > NOW() - INTERVAL '30 days';
   ```

## Security

### Data Privacy

- Activity logs contain no sensitive message content
- Only metadata like model, tokens, and cost are stored
- User IDs are stored as foreign keys with CASCADE delete

### Access Control

- Users can only access their own activity logs
- Admin endpoints require `ADMIN_API_KEY`
- All queries use RLS (Row Level Security) in Supabase

## Future Enhancements

Potential improvements:

1. **Real-time Streaming**
   - WebSocket updates for live activity feed
   - Server-sent events for dashboard

2. **Advanced Analytics**
   - Cost predictions based on usage patterns
   - Anomaly detection for unusual usage
   - Budget alerts and spending limits

3. **Export Features**
   - CSV/Excel export for activity logs
   - PDF reports for monthly summaries
   - Integration with accounting systems

4. **Aggregation Tables**
   - Pre-computed daily/monthly summaries
   - Faster query performance for large datasets

## Support

- 📚 [API Documentation](https://docs.gatewayz.com)
- 💬 [Discord Community](https://discord.gg/gatewayz)
- 📧 Email: support@gatewayz.com

## Changelog

**v1.0.0** (2025-01-09)
- Initial implementation of automatic activity logging
- Support for chat completions, responses, auth, and sessions
- Activity statistics and log retrieval endpoints
- Provider auto-detection from model names
- Comprehensive metadata support with JSONB
