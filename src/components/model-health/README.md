# Model Health Monitoring Components

This directory contains all components and utilities for implementing model health monitoring in the Gatewayz frontend.

## Overview

The model health system tracks performance metrics for every model call, including:
- Success/error rates
- Response times
- Call counts
- Last status and error messages
- Provider-level statistics

## Architecture

```
model-health/
├── Components
│   ├── status-indicator.tsx          # Status icon display
│   ├── health-badge.tsx              # Health status badge (Healthy/Degraded/Unhealthy)
│   ├── response-time-badge.tsx       # Color-coded response time display
│   ├── model-health-card.tsx         # Comprehensive model health card
│   └── unhealthy-models-alert.tsx    # Alert banner for problematic models
│
├── Hooks (in src/hooks/)
│   └── use-model-health.ts           # Custom hooks for fetching health data
│
├── Types (in src/types/)
│   └── model-health.ts               # TypeScript type definitions
│
└── Utils (in src/lib/)
    └── model-health-utils.ts         # Helper functions for calculations
```

## Components

### StatusIndicator

Displays an emoji icon based on the model's last status.

```tsx
import { StatusIndicator } from "@/components/model-health";

<StatusIndicator status="success" />
// Renders: ✅

<StatusIndicator status="error" />
// Renders: ❌
```

**Props:**
- `status`: ModelStatus - One of "success", "error", "timeout", "rate_limited", "network_error"
- `className?`: string - Additional CSS classes

### HealthBadge

Displays a colored badge indicating overall health based on success rate.

```tsx
import { HealthBadge } from "@/components/model-health";

<HealthBadge successRate={98} />
// Shows: "Healthy" in green

<HealthBadge successRate={85} />
// Shows: "Degraded" in yellow

<HealthBadge successRate={70} />
// Shows: "Unhealthy" in red
```

**Props:**
- `successRate`: number - Success rate percentage (0-100)
- `className?`: string - Additional CSS classes

**Color Thresholds:**
- Green (Healthy): ≥95% success rate
- Yellow (Degraded): 80-95% success rate
- Red (Unhealthy): <80% success rate

### ResponseTimeBadge

Displays response time with color coding.

```tsx
import { ResponseTimeBadge } from "@/components/model-health";

<ResponseTimeBadge ms={500} />
// Shows: "500ms" in green

<ResponseTimeBadge ms={2000} />
// Shows: "2000ms" in yellow

<ResponseTimeBadge ms={5000} />
// Shows: "5.00s" in red
```

**Props:**
- `ms`: number - Response time in milliseconds
- `className?`: string - Additional CSS classes

**Color Thresholds:**
- Green (Fast): <1000ms
- Yellow (Moderate): 1000-3000ms
- Red (Slow): >3000ms

### ModelHealthCard

Comprehensive card showing all health metrics for a model.

```tsx
import { ModelHealthCard } from "@/components/model-health";

<ModelHealthCard health={modelHealthData} />
```

**Props:**
- `health`: ModelHealth - Complete health data object
- `className?`: string - Additional CSS classes

**Displays:**
- Provider and model name
- Status indicator
- Health badge
- Average response time
- Success rate
- Total calls
- Last called timestamp
- Last error message (if any)

### UnhealthyModelsAlert

Alert banner that automatically polls and displays models with high error rates.

```tsx
import { UnhealthyModelsAlert } from "@/components/model-health";

<UnhealthyModelsAlert />

// With custom settings
<UnhealthyModelsAlert
  errorThreshold={0.15}
  pollInterval={180000} // 3 minutes
/>
```

**Props:**
- `errorThreshold?`: number - Error rate threshold (default: 0.2 = 20%)
- `pollInterval?`: number - Polling interval in milliseconds (default: 300000 = 5 minutes)
- `className?`: string - Additional CSS classes

**Features:**
- Automatically polls for updates
- Shows top 5 unhealthy models
- Only displays when issues exist
- Stops polling when tab is hidden

## Custom Hooks

### useModelHealth

Fetch health data for a specific model.

```tsx
import { useModelHealth } from "@/hooks/use-model-health";

const { health, loading, error, refetch } = useModelHealth("openrouter", "anthropic/claude-3-opus");
```

### useModelHealthStats

Fetch overall system statistics.

```tsx
import { useModelHealthStats } from "@/hooks/use-model-health";

const { stats, loading, error, refetch } = useModelHealthStats();
// stats contains: total_models, success_rate, average_response_time, etc.
```

### useModelHealthList

Fetch paginated list of all models with health data.

```tsx
import { useModelHealthList } from "@/hooks/use-model-health";

const { data, loading, error, refetch } = useModelHealthList(50, 0);
// data.models: Array of model health objects
// data.total: Total count
```

### useUnhealthyModels

Fetch models with high error rates.

```tsx
import { useUnhealthyModels } from "@/hooks/use-model-health";

const { data, loading, error, refetch } = useUnhealthyModels(0.2);
// Returns models with >20% error rate
```

### useProviderSummary

Fetch aggregated statistics for a provider.

```tsx
import { useProviderSummary } from "@/hooks/use-model-health";

const { summary, loading, error, refetch } = useProviderSummary("openrouter");
```

### useProviderList

Fetch list of all providers.

```tsx
import { useProviderList } from "@/hooks/use-model-health";

const { providers, loading, error, refetch } = useProviderList();
// Returns: ["openrouter", "portkey", "featherless", ...]
```

### useModelHealthPolling

Utility hook for automatic polling with tab visibility detection.

```tsx
import { useModelHealthPolling } from "@/hooks/use-model-health";

useModelHealthPolling(refetchFunction, 60000); // Poll every 60 seconds
// Automatically stops when tab is hidden
```

## Utility Functions

Located in `src/lib/model-health-utils.ts`:

```tsx
import {
  calculateSuccessRate,
  calculateErrorRate,
  getHealthStatus,
  getStatusColor,
  getResponseTimeClass,
  formatTimeAgo,
  getDerivedMetrics,
  getStatusIcon,
  formatResponseTime,
} from "@/lib/model-health-utils";

// Calculate success rate
const successRate = calculateSuccessRate(modelHealth); // Returns 0-100

// Get health status
const status = getHealthStatus(95); // Returns "healthy" | "degraded" | "unhealthy"

// Format time
const ago = formatTimeAgo("2024-11-24T12:00:00Z"); // Returns "5m ago"

// Get all derived metrics at once
const metrics = getDerivedMetrics(modelHealth);
// Returns: { successRate, errorRate, healthStatus, responseTimeCategory }
```

## TypeScript Types

All types are defined in `src/types/model-health.ts`:

```typescript
type ModelStatus = "success" | "error" | "timeout" | "rate_limited" | "network_error";

interface ModelHealth {
  provider: string;
  model: string;
  last_response_time_ms: number;
  last_status: ModelStatus;
  last_called_at: string;
  call_count: number;
  success_count: number;
  error_count: number;
  average_response_time_ms: number;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ModelHealthStats {
  total_models: number;
  total_calls: number;
  total_success: number;
  total_errors: number;
  success_rate: number;
  average_response_time: number;
  providers: number;
}
```

## Complete Dashboard Page

A full dashboard implementation is available at:

**Location:** `src/app/model-health/page.tsx`

**URL:** `/model-health`

**Features:**
- KPI cards (total models, success rate, avg response time, total calls)
- Unhealthy models alert banner
- Searchable table of all models
- Pagination support
- Auto-refresh every 60 seconds
- Manual refresh button

## Quick Integration Examples

### Add Status Badge to Model Selection

```tsx
import { useModelHealth } from "@/hooks/use-model-health";
import { StatusIndicator, HealthBadge } from "@/components/model-health";

function ModelOption({ provider, model }) {
  const { health } = useModelHealth(provider, model);

  if (!health) return <span>{model}</span>;

  const successRate = (health.success_count / health.call_count) * 100;

  return (
    <div className="flex items-center gap-2">
      <StatusIndicator status={health.last_status} />
      <span>{model}</span>
      <HealthBadge successRate={successRate} />
    </div>
  );
}
```

### Add Alert to Dashboard

```tsx
import { UnhealthyModelsAlert } from "@/components/model-health";

function Dashboard() {
  return (
    <div>
      <UnhealthyModelsAlert />
      {/* Rest of dashboard */}
    </div>
  );
}
```

### Display Model Health Card

```tsx
import { useModelHealth } from "@/hooks/use-model-health";
import { ModelHealthCard } from "@/components/model-health";

function ModelDetails({ provider, model }) {
  const { health, loading } = useModelHealth(provider, model);

  if (loading) return <div>Loading...</div>;
  if (!health) return <div>No health data available</div>;

  return <ModelHealthCard health={health} />;
}
```

## API Endpoints

All hooks connect to these backend endpoints:

- `GET /v1/model-health` - List all models
- `GET /v1/model-health/{provider}/{model}` - Get specific model health
- `GET /v1/model-health/unhealthy` - Get problematic models
- `GET /v1/model-health/stats` - Overall statistics
- `GET /v1/model-health/provider/{provider}/summary` - Provider summary
- `GET /v1/model-health/providers` - List all providers

## Environment Variables

The hooks use the following environment variable:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
```

Falls back to `https://api.gatewayz.ai` if not set.

## Best Practices

1. **Error Handling**: All hooks return `error` state - handle it gracefully
2. **Loading States**: Show skeletons or loading indicators while `loading` is true
3. **Null Checks**: Health data may be null for new models - handle this case
4. **Polling**: Use `useModelHealthPolling` hook for automatic updates
5. **Performance**: Be mindful of polling intervals - don't poll too frequently
6. **Caching**: Backend has 5-minute cache - consider this in your refresh logic

## Testing

```bash
# Type check
pnpm typecheck

# Run development server
pnpm dev

# Access dashboard
# Navigate to http://localhost:3000/model-health
```

## Support

For questions or issues:
- Check the backend API documentation in `gatewayz-backend/docs/MODEL_HEALTH_QUICK_START.md`
- Review API endpoint code in `gatewayz-backend/src/routes/model_health.py`
- Contact the backend team for API changes

## Future Enhancements

Potential improvements to consider:

1. **Historical Data**: Add trend charts showing health over time
2. **Filtering**: Add filters by provider, health status, response time
3. **Sorting**: Allow sorting table by different columns
4. **Export**: Add CSV/JSON export functionality
5. **Notifications**: Add real-time notifications for degraded models
6. **Custom Thresholds**: Allow users to set custom alert thresholds
7. **Detailed View**: Modal or page showing detailed model history
8. **Comparison**: Side-by-side comparison of multiple models
