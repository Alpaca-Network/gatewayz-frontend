# Statsig Analytics Setup Guide

## Overview

This guide explains how Statsig analytics is configured in the Gatewayz backend and how to enable event logging.

**Important**: This is a **Python backend** implementation using the Statsig Python SDK, NOT the JavaScript SDK. The backend provides server-side analytics endpoints that can be called from any frontend.

## Architecture

```
Frontend/Client
    ↓ HTTP POST
Backend API Endpoint (/v1/analytics/events)
    ↓
Statsig Service (src/services/statsig_service.py)
    ↓
Statsig Cloud (console.statsig.com)
```

## Current Configuration Status

✅ **Implemented**:
- Service implementation in `src/services/statsig_service.py`
- Analytics routes at `/v1/analytics/events` and `/v1/analytics/batch`
- Integration with FastAPI app lifecycle (startup/shutdown)
- Environment variable configuration in `.env.example`
- Graceful fallback when SDK is not available
- Comprehensive test coverage in `tests/routes/test_analytics.py`

⚠️ **Required for Production**:
- Install dependencies: `pip install -r requirements.txt`
- Set `STATSIG_SERVER_SECRET_KEY` in `.env` file
- Restart the backend server

## Quick Start

### 1. Install Dependencies

```bash
# Install all Python dependencies including Statsig SDK
pip install -r requirements.txt

# Or install Statsig SDK directly
pip3 install statsig-python-core
```

This will install `statsig-python-core==0.10.2` (Python 3.7+ required).

**Important**: The package name is `statsig-python-core` but you import it as `statsig_python_core`:
```python
from statsig_python_core import Statsig, StatsigUser, StatsigOptions
```

### 2. Get Statsig API Key

1. Go to [Statsig Console](https://console.statsig.com)
2. Navigate to **Project Settings** → **API Keys**
3. Copy your **Server Secret Key** (starts with `secret-`)

**Important**: Use the **Server Secret Key**, NOT the client SDK key!

### 3. Configure Environment Variables

Create or update `.env` file in the project root:

```bash
# Copy example if you don't have .env yet
cp .env.example .env
```

Add your Statsig server secret key:

```bash
STATSIG_SERVER_SECRET_KEY=secret-YOUR-ACTUAL-KEY-HERE
```

### 4. Start the Backend Server

```bash
python src/main.py
```

### 5. Verify Initialization

Check the server logs on startup. You should see:

```
✅ Statsig SDK initialized successfully
   Environment: development
   Server Key: secret-XXX...
```

If the key is not set, you'll see:

```
⚠️  STATSIG_SERVER_SECRET_KEY not set - Statsig analytics disabled (using fallback)
   To enable: Set STATSIG_SERVER_SECRET_KEY in your .env file
```

## API Usage

### Single Event Logging

**Endpoint**: `POST /v1/analytics/events`

```bash
curl -X POST http://localhost:8000/v1/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "chat_message_sent",
    "user_id": "user123",
    "value": "gpt-4",
    "metadata": {
      "model": "gpt-4",
      "tokens": 150,
      "cost": 0.003
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Event 'chat_message_sent' logged successfully"
}
```

### Batch Event Logging

**Endpoint**: `POST /v1/analytics/batch`

```bash
curl -X POST http://localhost:8000/v1/analytics/batch \
  -H "Content-Type: application/json" \
  -d '[
    {
      "event_name": "page_view",
      "metadata": {"page": "/dashboard"}
    },
    {
      "event_name": "button_click",
      "value": "export_data"
    }
  ]'
```

**Response**:
```json
{
  "success": true,
  "message": "2 events logged successfully"
}
```

## Event Schema

### AnalyticsEvent Model

```python
{
  "event_name": str,        # Required - Event name (e.g., "chat_message_sent")
  "user_id": str,           # Optional - User ID (defaults to authenticated user or "anonymous")
  "value": str,             # Optional - Event value
  "metadata": dict          # Optional - Event metadata/properties
}
```

### User ID Priority

The service determines the user ID in this order:

1. **Authenticated User**: From auth middleware (`current_user`)
2. **Provided User ID**: From the `user_id` field in the request
3. **Anonymous**: Falls back to `"anonymous"`

## Service Implementation

### StatsigService Class

Located in `src/services/statsig_service.py`

**Initialization**:
```python
from statsig_python_core import Statsig, StatsigUser, StatsigOptions

# Create options
options = StatsigOptions()
options.environment = "development"  # or "staging", "production"

# Initialize Statsig
statsig = Statsig("secret-YOUR-SERVER-KEY", options)
statsig.initialize().wait()
```

**Methods**:

#### `async def initialize()`
Initializes the Statsig SDK with the server secret key. Must be called during app startup.

#### `def log_event(user_id, event_name, value=None, metadata=None) -> bool`
Logs an event to Statsig. Returns `True` on success.

**Example**:
```python
from statsig_python_core import StatsigUser

statsig.log_event(
    user=StatsigUser("user_id"),
    event_name="add_to_cart",
    value="SKU_12345",
    metadata={
        "price": "9.99",
        "item_name": "diet_coke_48_pack"
    }
)
```

#### `def get_feature_flag(flag_name, user_id, default_value=False) -> bool`
Retrieves a feature flag value for a user.

#### `async def shutdown()`
Gracefully shuts down the SDK and flushes pending events.

### Graceful Fallback

The service includes graceful fallback behavior:

- If `STATSIG_SERVER_SECRET_KEY` is not set → Logs to console only
- If SDK import fails → Logs to console only
- If SDK initialization fails → Logs to console only

This ensures the application continues to work even if Statsig is not configured.

## Integration Points

### App Startup (src/main.py:242)

```python
from src.services.statsig_service import statsig_service
await statsig_service.initialize()
```

### App Shutdown (src/main.py:289)

```python
await statsig_service.shutdown()
```

### Routes (src/routes/analytics.py)

The analytics router is automatically loaded in `src/main.py:130` and provides:
- `POST /v1/analytics/events` - Single event logging
- `POST /v1/analytics/batch` - Batch event logging

## Testing

### Run Validation Script

```bash
python3 validate_statsig.py
```

This script checks:
- ✅ Service implementation
- ✅ Analytics routes
- ✅ Main app integration
- ✅ Environment configuration
- ✅ Python dependencies

### Run Unit Tests

```bash
pytest tests/routes/test_analytics.py -v
```

### Run Integration Test

```bash
python tests/integration/test_analytics_integration.py
```

## Viewing Events in Statsig

1. Go to [Statsig Console](https://console.statsig.com)
2. Navigate to **Events** → **Event Stream**
3. You should see events appearing in real-time
4. Filter by event name, user ID, or metadata

## Common Event Names

Recommended event naming conventions:

```
- chat_message_sent
- chat_message_received
- api_request_completed
- model_switched
- page_view
- button_click
- error_occurred
- user_signed_up
- user_logged_in
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `STATSIG_SERVER_SECRET_KEY` | Yes | Server secret key from Statsig console | `secret-...` |
| `APP_ENV` | No | Environment (development/staging/production) | `development` |

## Troubleshooting

### Events Not Appearing in Statsig Console

1. **Check server logs** for initialization errors
2. **Verify API key** is correct (starts with `secret-`)
3. **Restart backend** after changing `.env` file
4. **Check network** connectivity to Statsig servers
5. **Wait a few minutes** for events to appear (may have delay)

### "Fallback" Mode

If you see logs like:
```
📊 [Fallback] Analytics event: chat_message_sent (user: user123)
```

This means Statsig SDK is not properly initialized. Check:
- Is `STATSIG_SERVER_SECRET_KEY` set in `.env`?
- Did you run `pip install -r requirements.txt`?
- Did you restart the backend server?

### Import Error

```
ModuleNotFoundError: No module named 'statsig_python_core'
```

Solution:
```bash
pip install statsig-python-core==0.10.2
```

**Note**: The package name is `statsig-python-core` (with hyphens), but you must import it as `statsig_python_core` (with underscores):
```python
from statsig_python_core import Statsig  # ✅ Correct
from statsig-python-core import Statsig  # ❌ Wrong (hyphens don't work in imports)
```

## Differences from JavaScript Implementation

**You provided JavaScript/frontend instructions, but this is a Python backend:**

| JavaScript SDK | Python SDK (This Codebase) |
|----------------|----------------------------|
| `@statsig/js-client` | `statsig-python-core` |
| `StatsigClient` | `statsig.initialize()` |
| `client.logEvent()` | `statsig.log_event()` |
| Client SDK Key | Server Secret Key |
| Browser auto-capture | Manual event logging via API |

**The Python SDK is server-side** and requires:
- Server Secret Key (not client key)
- Backend API calls
- No auto-capture (manual event logging)

## Next Steps

1. ✅ Service implemented → `src/services/statsig_service.py`
2. ✅ Routes configured → `src/routes/analytics.py`
3. ✅ Tests written → `tests/routes/test_analytics.py`
4. ⚠️ **TODO**: Set `STATSIG_SERVER_SECRET_KEY` in production `.env`
5. ⚠️ **TODO**: Install dependencies in production environment
6. ⚠️ **TODO**: Update frontend to call `/v1/analytics/events` API

## Example Frontend Integration

If you want to log events from a JavaScript frontend:

```javascript
// Log event via backend API (NOT direct Statsig client)
async function logEvent(eventName, metadata = {}) {
  try {
    const response = await fetch('http://localhost:8000/v1/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_name: eventName,
        metadata: metadata
      })
    });

    const data = await response.json();
    console.log('Event logged:', data);
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

// Usage
logEvent('chat_message_sent', {
  model: 'gpt-4',
  tokens: 150
});
```

## Additional Resources

- [Statsig Python SDK Documentation](https://docs.statsig.com/server/pythonSDK)
- [Statsig Console](https://console.statsig.com)
- [API Reference](http://localhost:8000/docs) - After starting the server

---

**Last Updated**: 2025-10-27
**Validated**: ✅ All configuration checks passed
