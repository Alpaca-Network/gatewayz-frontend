# Model Health Integration - Usage Examples

This document provides practical examples for integrating model health monitoring into various parts of the Gatewayz frontend.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Adding Health to Model Cards](#adding-health-to-model-cards)
3. [Dashboard Integration](#dashboard-integration)
4. [Model Selection UI](#model-selection-ui)
5. [Settings Page Integration](#settings-page-integration)
6. [Real-time Alerts](#real-time-alerts)

---

## Quick Start

### 1. View the Dashboard

Navigate to `/model-health` to see the complete health monitoring dashboard:

```
http://localhost:3000/model-health
```

Features:
- Overall system KPIs
- Unhealthy models alert
- Searchable table of all models
- Auto-refresh every 60 seconds

### 2. Add Alert to Any Page

The simplest integration - add unhealthy model alerts to any page:

```tsx
import { UnhealthyModelsAlert } from "@/components/model-health";

export default function MyPage() {
  return (
    <div>
      <UnhealthyModelsAlert />
      {/* Rest of your page */}
    </div>
  );
}
```

---

## Adding Health to Model Cards

### Example 1: Simple Status Indicator

Add a health status icon next to model names:

```tsx
"use client";

import { useModelHealth } from "@/hooks/use-model-health";
import { StatusIndicator } from "@/components/model-health";

function ModelCard({ provider, modelName }) {
  const { health } = useModelHealth(provider, modelName);

  return (
    <div className="flex items-center gap-2">
      {health && <StatusIndicator status={health.last_status} />}
      <h3>{modelName}</h3>
    </div>
  );
}
```

### Example 2: Full Health Badge

Add health status and response time:

```tsx
"use client";

import { useModelHealth } from "@/hooks/use-model-health";
import { HealthBadge, ResponseTimeBadge } from "@/components/model-health";
import { calculateSuccessRate } from "@/lib/model-health-utils";

function ModelCard({ provider, modelName }) {
  const { health, loading } = useModelHealth(provider, modelName);

  if (loading) return <div>Loading...</div>;
  if (!health) return <div>{modelName}</div>;

  const successRate = calculateSuccessRate(health);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">{modelName}</h3>
        <HealthBadge successRate={successRate} />
      </div>
      <div className="text-sm text-muted-foreground">
        Response time: <ResponseTimeBadge ms={health.average_response_time_ms} />
      </div>
      <div className="text-sm text-muted-foreground">
        Success rate: {successRate.toFixed(1)}%
      </div>
    </div>
  );
}
```

### Example 3: Model Detail Card

Full health information card:

```tsx
"use client";

import { useModelHealth } from "@/hooks/use-model-health";
import { ModelHealthCard } from "@/components/model-health";
import { Skeleton } from "@/components/ui/skeleton";

function ModelDetails({ provider, modelName }) {
  const { health, loading, error } = useModelHealth(provider, modelName);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <div className="text-red-600">Failed to load health data</div>;
  }

  if (!health) {
    return (
      <div className="text-muted-foreground">
        No health data available yet for this model
      </div>
    );
  }

  return <ModelHealthCard health={health} />;
}
```

---

## Dashboard Integration

### Example 1: Add Health Section to Main Dashboard

```tsx
"use client";

import { useModelHealthStats } from "@/hooks/use-model-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnhealthyModelsAlert } from "@/components/model-health";
import { Activity, TrendingUp } from "lucide-react";

function Dashboard() {
  const { stats, loading } = useModelHealthStats();

  return (
    <div className="space-y-6">
      {/* Unhealthy Models Alert */}
      <UnhealthyModelsAlert />

      {/* System Health KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div className="text-2xl font-bold">{stats?.total_models || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div className="text-2xl font-bold">
                {stats ? (stats.success_rate * 100).toFixed(1) : 0}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div className="text-2xl font-bold">
                {stats ? Math.round(stats.average_response_time) : 0}ms
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rest of dashboard */}
    </div>
  );
}
```

### Example 2: Provider Comparison

```tsx
"use client";

import { useProviderList, useProviderSummary } from "@/hooks/use-model-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ProviderComparison() {
  const { providers } = useProviderList();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {providers.map((provider) => (
        <ProviderCard key={provider} provider={provider} />
      ))}
    </div>
  );
}

function ProviderCard({ provider }: { provider: string }) {
  const { summary, loading } = useProviderSummary(provider);

  if (loading) return <div>Loading...</div>;
  if (!summary) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{provider}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Models:</span>
            <span className="font-semibold">{summary.model_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Success Rate:</span>
            <span className="font-semibold">
              {(summary.success_rate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Response:</span>
            <span className="font-semibold">
              {Math.round(summary.average_response_time)}ms
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Model Selection UI

### Example: Chat Model Selector with Health

```tsx
"use client";

import { useState } from "react";
import { useModelHealth } from "@/hooks/use-model-health";
import { StatusIndicator, HealthBadge } from "@/components/model-health";
import { calculateSuccessRate } from "@/lib/model-health-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelOption {
  provider: string;
  model: string;
  displayName: string;
}

const availableModels: ModelOption[] = [
  { provider: "openrouter", model: "anthropic/claude-3-opus", displayName: "Claude 3 Opus" },
  { provider: "openrouter", model: "openai/gpt-4", displayName: "GPT-4" },
  // ... more models
];

function ModelSelector() {
  const [selectedModel, setSelectedModel] = useState<string>("");

  return (
    <Select value={selectedModel} onValueChange={setSelectedModel}>
      <SelectTrigger>
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {availableModels.map((model) => (
          <SelectItem key={`${model.provider}-${model.model}`} value={model.model}>
            <ModelSelectItem {...model} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModelSelectItem({ provider, model, displayName }: ModelOption) {
  const { health } = useModelHealth(provider, model);

  if (!health) {
    return <span>{displayName}</span>;
  }

  const successRate = calculateSuccessRate(health);

  return (
    <div className="flex items-center justify-between w-full gap-2">
      <div className="flex items-center gap-2">
        <StatusIndicator status={health.last_status} />
        <span>{displayName}</span>
      </div>
      <HealthBadge successRate={successRate} />
    </div>
  );
}
```

---

## Settings Page Integration

### Example: API Keys with Model Health

```tsx
"use client";

import { useModelHealthList } from "@/hooks/use-model-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function SettingsAPIPage() {
  const { data, loading } = useModelHealthList(10, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Key Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {/* API key settings UI */}
        </CardContent>
      </Card>

      {/* Recently Used Models Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recently Used Models</CardTitle>
          <Link href="/model-health">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-2">
              {data?.models.slice(0, 5).map((model) => (
                <div
                  key={`${model.provider}-${model.model}`}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <span className="text-sm">
                    {model.provider}/{model.model}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {Math.round(model.average_response_time_ms)}ms
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {((model.success_count / model.call_count) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Real-time Alerts

### Example 1: Persistent Alert Banner

Add to your app layout for site-wide visibility:

```tsx
// app/layout.tsx or similar

import { UnhealthyModelsAlert } from "@/components/model-health";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <header>{/* Header content */}</header>

        {/* Site-wide health alert */}
        <div className="container mx-auto px-4">
          <UnhealthyModelsAlert className="my-4" />
        </div>

        <main>{children}</main>

        <footer>{/* Footer content */}</footer>
      </body>
    </html>
  );
}
```

### Example 2: Custom Alert with Actions

```tsx
"use client";

import { useUnhealthyModels } from "@/hooks/use-model-health";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

function CustomHealthAlert() {
  const { data } = useUnhealthyModels(0.15); // 15% error threshold

  if (!data || data.models.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Model Performance Issues Detected</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          {data.models.length} model{data.models.length > 1 ? "s are" : " is"} currently
          experiencing elevated error rates.
        </p>
        <div className="flex gap-2">
          <Link href="/model-health">
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

### Example 3: Toast Notifications

```tsx
"use client";

import { useEffect } from "react";
import { useUnhealthyModels } from "@/hooks/use-model-health";
import { useToast } from "@/hooks/use-toast";

function HealthMonitor() {
  const { data } = useUnhealthyModels(0.2);
  const { toast } = useToast();

  useEffect(() => {
    if (data && data.models.length > 0) {
      toast({
        title: "Model Health Alert",
        description: `${data.models.length} model(s) are experiencing issues`,
        variant: "destructive",
      });
    }
  }, [data, toast]);

  return null; // This component doesn't render anything
}

// Add to your layout or main page
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HealthMonitor />
      {children}
    </>
  );
}
```

---

## Advanced Patterns

### Pattern 1: Conditional Rendering Based on Health

Only show certain models if they're healthy:

```tsx
"use client";

import { useModelHealth } from "@/hooks/use-model-health";
import { calculateSuccessRate } from "@/lib/model-health-utils";

function ModelOption({ provider, model, children }) {
  const { health } = useModelHealth(provider, model);

  // Don't show if unhealthy
  if (health) {
    const successRate = calculateSuccessRate(health);
    if (successRate < 80) {
      return null; // Hide unhealthy models
    }
  }

  return <div>{children}</div>;
}
```

### Pattern 2: Loading States with Skeleton

```tsx
"use client";

import { useModelHealthList } from "@/hooks/use-model-health";
import { Skeleton } from "@/components/ui/skeleton";

function ModelList() {
  const { data, loading } = useModelHealthList(20, 0);

  if (loading && !data) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data?.models.map((model) => (
        <div key={`${model.provider}-${model.model}`}>
          {/* Model card */}
        </div>
      ))}
    </div>
  );
}
```

### Pattern 3: Polling with Custom Interval

```tsx
"use client";

import { useModelHealthStats, useModelHealthPolling } from "@/hooks/use-model-health";

function LiveStats() {
  const { stats, refetch } = useModelHealthStats();

  // Poll every 30 seconds, stops when tab is hidden
  useModelHealthPolling(refetch, 30000);

  return (
    <div>
      <h3>Live Statistics</h3>
      <p>Success Rate: {stats ? (stats.success_rate * 100).toFixed(1) : 0}%</p>
      <p>Avg Response: {stats ? Math.round(stats.average_response_time) : 0}ms</p>
    </div>
  );
}
```

---

## Testing

### Manual Testing

1. Start the development server:
```bash
cd gatewayz-frontend
pnpm dev
```

2. Navigate to different pages:
- `/model-health` - Full dashboard
- Any page with integrated components

3. Test scenarios:
- Check loading states
- Search/filter functionality
- Pagination
- Auto-refresh
- Tab visibility (polling should stop when tab is hidden)

### Mock Data

For development without backend:

```tsx
// Mock hook for development
export function useModelHealth(provider: string, model: string) {
  return {
    health: {
      provider,
      model,
      last_response_time_ms: 1200,
      last_status: "success" as const,
      last_called_at: new Date().toISOString(),
      call_count: 100,
      success_count: 98,
      error_count: 2,
      average_response_time_ms: 1150,
      last_error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    loading: false,
    error: null,
    refetch: () => {},
  };
}
```

---

## Troubleshooting

### Issue: No health data showing

**Cause**: Model hasn't been called yet or backend is not returning data

**Solution**:
1. Check backend API is running
2. Verify model has been called at least once
3. Check browser console for errors
4. Verify `NEXT_PUBLIC_API_BASE_URL` is set correctly

### Issue: Polling not working

**Cause**: Hook dependencies or intervals not set up correctly

**Solution**:
1. Ensure you're using `useModelHealthPolling` hook
2. Check that refetch function is stable (wrapped in useCallback)
3. Verify polling interval is reasonable (not too short)

### Issue: Type errors

**Cause**: Missing type imports

**Solution**:
```tsx
import type { ModelHealth } from "@/types/model-health";
```

---

## Best Practices

1. **Always handle loading and error states**
2. **Show "No data yet" instead of errors for new models**
3. **Use polling sparingly** - default 60s interval is good
4. **Don't block UI on health data** - show model even if health fails
5. **Use skeleton loaders** for better UX during loading
6. **Cache aggressively** - backend already has 5-min cache
7. **Test with real API** - mock data doesn't catch API issues

---

## Next Steps

1. Implement basic status indicators in model selection UI
2. Add unhealthy models alert to main dashboard
3. Create full model health page at `/model-health`
4. Add health metrics to settings/analytics pages
5. Consider custom thresholds for different use cases
6. Add historical data tracking (future enhancement)

For more details, see the full documentation in `src/components/model-health/README.md`.
