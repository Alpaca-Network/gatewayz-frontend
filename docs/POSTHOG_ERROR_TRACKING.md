# PostHog Error Tracking Integration

## Overview

This document describes the PostHog error tracking integration for the Gatewayz Universal Inference API. The integration provides automatic exception capture and manual error reporting capabilities.

## Features

- **Automatic Exception Capture**: All unhandled exceptions are automatically captured and sent to PostHog
- **Manual Exception Capture**: Ability to manually capture and report specific exceptions
- **User Context**: Exceptions include user identification when available
- **Request Context**: Exception reports include request path, method, and other relevant metadata
- **Graceful Degradation**: If PostHog is not configured or fails, the application continues to function normally

## Configuration

### Environment Variables

The following environment variables are required for PostHog error tracking:

```bash
# Required
POSTHOG_API_KEY=phc_iz1i6TdtphwFCtQfK2tWxsoythvgLNcxJJO9zpNmxZf

# Optional (defaults to https://us.i.posthog.com)
POSTHOG_HOST=https://us.i.posthog.com

# Optional (for debugging)
POSTHOG_DEBUG=false
```

### Setup

1. Add the environment variables to your `.env` file or deployment environment
2. The PostHog service is automatically initialized on application startup
3. Error tracking is enabled by default when `POSTHOG_API_KEY` is set

## Implementation Details

### PostHog Service (`src/services/posthog_service.py`)

The PostHog service is a singleton that manages the PostHog client and provides methods for event capture and error tracking.

#### Key Features:

- **Exception Autocapture**: Enabled via `enable_exception_autocapture=True` parameter
- **Async Mode**: Uses async mode for better performance (`sync_mode=False`)
- **Graceful Degradation**: Handles missing API key and initialization errors gracefully

#### Methods:

##### `initialize()`
Initializes the PostHog client with exception autocapture enabled.

##### `capture_exception(exception, distinct_id, properties)`
Manually captures an exception and sends it to PostHog.

**Parameters:**
- `exception` (Exception): The exception object to capture
- `distinct_id` (str, optional): User identifier (defaults to "system")
- `properties` (dict, optional): Additional context properties

**Example:**
```python
from src.services.posthog_service import posthog_service

try:
    # Some code that might raise an exception
    risky_operation()
except Exception as e:
    posthog_service.capture_exception(
        exception=e,
        distinct_id="user_123",
        properties={
            "context": "processing_payment",
            "payment_id": "pay_123"
        }
    )
    # Handle the exception
```

### FastAPI Exception Handler (`src/main.py`)

The global exception handler in FastAPI has been enhanced to automatically capture all unhandled exceptions.

#### Features:

- **Automatic User Identification**: Extracts user ID from request state or authorization header
- **Request Context**: Includes request path, method, error type, and error message
- **Fallback Behavior**: If PostHog capture fails, the error is logged but doesn't affect response

#### Exception Properties Captured:

- `path`: Request URL path
- `method`: HTTP method (GET, POST, etc.)
- `error_type`: Exception class name
- `error_message`: Exception message

## Testing

### Unit Tests

Comprehensive unit tests are available in `tests/services/test_posthog_service.py`:

```bash
pytest tests/services/test_posthog_service.py -v
```

Tests cover:
- PostHog initialization with exception autocapture
- Manual exception capture with distinct_id
- Default distinct_id handling
- Graceful handling when PostHog is not initialized

### Manual Testing

To test error tracking in development:

1. Set up PostHog API key in your environment:
   ```bash
   export POSTHOG_API_KEY="your_api_key"
   export POSTHOG_HOST="https://us.i.posthog.com"
   ```

2. Start the development server:
   ```bash
   python src/main.py
   ```

3. Trigger an error:
   ```bash
   # This endpoint doesn't exist, so it will trigger an error
   curl -X GET http://localhost:8000/trigger-error
   ```

4. Check PostHog dashboard for the captured exception

## Usage Examples

### Example 1: Capturing Exceptions in Route Handlers

```python
from fastapi import APIRouter, HTTPException
from src.services.posthog_service import posthog_service

router = APIRouter()

@router.post("/process")
async def process_data(data: dict):
    try:
        # Process data
        result = process_complex_operation(data)
        return {"result": result}
    except ValueError as e:
        # Capture the exception with context
        posthog_service.capture_exception(
            exception=e,
            distinct_id=data.get("user_id", "anonymous"),
            properties={
                "operation": "process_complex_operation",
                "data_keys": list(data.keys())
            }
        )
        raise HTTPException(status_code=400, detail=str(e))
```

### Example 2: Capturing Exceptions in Service Layer

```python
from src.services.posthog_service import posthog_service

def process_payment(user_id: str, amount: float):
    try:
        # Payment processing logic
        charge = stripe.Charge.create(amount=amount, currency="usd")
        return charge
    except stripe.error.CardError as e:
        # Capture payment errors
        posthog_service.capture_exception(
            exception=e,
            distinct_id=user_id,
            properties={
                "amount": amount,
                "error_code": e.code,
                "error_type": "card_error"
            }
        )
        raise
```

### Example 3: Capturing Exceptions in Background Tasks

```python
from fastapi import BackgroundTasks
from src.services.posthog_service import posthog_service

def send_notification_email(user_id: str, email: str):
    try:
        # Send email
        send_email(email, "Notification")
    except Exception as e:
        # Capture background task errors
        posthog_service.capture_exception(
            exception=e,
            distinct_id=user_id,
            properties={
                "task": "send_notification_email",
                "email": email
            }
        )

@router.post("/notify")
async def notify_user(user_id: str, email: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(send_notification_email, user_id, email)
    return {"status": "notification_queued"}
```

## Best Practices

1. **Include Context**: Always include relevant context in the `properties` parameter
2. **User Identification**: Use actual user IDs when available for better tracking
3. **Don't Over-Capture**: Only capture exceptions that need attention, not expected errors
4. **Privacy**: Don't include sensitive information (passwords, tokens) in properties
5. **Error Handling**: Don't let PostHog failures affect your application logic

## Monitoring

### PostHog Dashboard

View captured exceptions in the PostHog dashboard:
1. Navigate to your PostHog project
2. Go to "Exceptions" or "Error Tracking" section
3. Filter by distinct_id, error_type, or custom properties

### Metrics to Monitor

- **Error Rate**: Number of exceptions per time period
- **Error Types**: Distribution of exception types
- **User Impact**: Number of unique users affected
- **Request Paths**: Which endpoints are generating errors

## Troubleshooting

### PostHog Not Capturing Exceptions

1. Check that `POSTHOG_API_KEY` is set:
   ```bash
   echo $POSTHOG_API_KEY
   ```

2. Check application logs for PostHog initialization:
   ```
   PostHog initialized successfully with exception autocapture (host: ...)
   ```

3. Verify PostHog SDK version:
   ```bash
   pip show posthog
   ```
   Minimum version: 3.7.0

4. Enable debug mode:
   ```bash
   export POSTHOG_DEBUG=true
   ```

### Exceptions Not Appearing in Dashboard

1. Check if PostHog is initialized:
   - Look for initialization message in logs
   - Check for any initialization errors

2. Verify API key is correct:
   - Check PostHog project settings
   - Ensure API key has write permissions

3. Check for network issues:
   - Verify connectivity to PostHog host
   - Check firewall rules

## Related Documentation

- [PostHog Error Tracking Documentation](https://posthog.com/docs/error-tracking)
- [PostHog Python SDK Documentation](https://posthog.com/docs/libraries/python)
- [FastAPI Exception Handling](https://fastapi.tiangolo.com/tutorial/handling-errors/)

## Change Log

### 2025-11-21
- Enabled exception autocapture in PostHog initialization
- Added `capture_exception` method to PostHog service
- Updated FastAPI global exception handler to capture errors
- Added comprehensive unit tests for error tracking
- Created documentation for error tracking integration
