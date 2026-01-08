# Monitoring API Authentication - Usage Examples

This document provides practical examples of how to use the new optional authentication features in the monitoring system.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Hook Usage](#hook-usage)
3. [Component Usage](#component-usage)
4. [Custom Implementation](#custom-implementation)
5. [Error Handling](#error-handling)

---

## Basic Usage

### Using the Monitoring Service Directly

```typescript
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey } from '@/lib/api';

// Example 1: Without authentication (public access)
async function getPublicHealthStats() {
  try {
    const stats = await monitoringService.getHealthStats();
    console.log('Public stats:', stats);
    return stats;
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    throw error;
  }
}

// Example 2: With authentication (for logged-in users)
async function getAuthenticatedHealthStats() {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.log('User not authenticated, using public access');
    return monitoringService.getHealthStats();
  }
  
  try {
    const stats = await monitoringService.getHealthStats(apiKey);
    console.log('Authenticated stats:', stats);
    return stats;
  } catch (error) {
    console.error('Failed to fetch authenticated stats:', error);
    throw error;
  }
}

// Example 3: Smart wrapper that handles both cases
async function getHealthStats() {
  const apiKey = getApiKey() || undefined;
  return monitoringService.getHealthStats(apiKey);
}
```

### Fetching Model Health

```typescript
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey } from '@/lib/api';

async function checkModelHealth(provider: string, model: string) {
  const apiKey = getApiKey() || undefined;
  
  try {
    const health = await monitoringService.getModelHealth(provider, model, apiKey);
    
    if (!health) {
      console.log(`No health data available for ${provider}/${model}`);
      return null;
    }
    
    console.log(`Health for ${provider}/${model}:`, {
      status: health.last_status,
      responseTime: health.average_response_time_ms,
      successRate: (health.success_count / health.call_count) * 100
    });
    
    return health;
  } catch (error) {
    console.error(`Failed to fetch health for ${provider}/${model}:`, error);
    throw error;
  }
}

// Usage
checkModelHealth('openai', 'gpt-4');
```

---

## Hook Usage

### Using Hooks in Components

```typescript
'use client';

import { useModelHealthStats, useModelHealthList } from '@/hooks/use-model-health';
import { getApiKey } from '@/lib/api';

export function MonitoringDashboard() {
  // Get API key if user is authenticated
  const apiKey = getApiKey() || undefined;
  
  // Use hooks with optional authentication
  const { stats, loading: statsLoading, error: statsError } = useModelHealthStats(apiKey);
  const { data, loading: listLoading, error: listError } = useModelHealthList(50, 0, apiKey);
  
  if (statsLoading || listLoading) {
    return <div>Loading monitoring data...</div>;
  }
  
  if (statsError || listError) {
    return <div>Error loading monitoring data</div>;
  }
  
  return (
    <div>
      <h1>Monitoring Dashboard</h1>
      <div>Total Models: {stats?.total_models}</div>
      <div>Success Rate: {(stats?.success_rate * 100).toFixed(1)}%</div>
      <div>
        <h2>Models</h2>
        <ul>
          {data?.models.map(model => (
            <li key={`${model.provider}-${model.model}`}>
              {model.provider}/{model.model} - {model.last_status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### Using Multiple Hooks with Polling

```typescript
'use client';

import { useModelHealthStats, useModelHealthList, useModelHealthPolling } from '@/hooks/use-model-health';
import { getApiKey } from '@/lib/api';

export function RealTimeMonitoring() {
  const apiKey = getApiKey() || undefined;
  
  const { stats, loading, error, refetch: refetchStats } = useModelHealthStats(apiKey);
  const { data, loading: listLoading, refetch: refetchList } = useModelHealthList(50, 0, apiKey);
  
  // Poll every 30 seconds when tab is visible
  useModelHealthPolling(() => {
    refetchStats();
    refetchList();
  }, 30000);
  
  return (
    <div>
      <h1>Real-Time Monitoring</h1>
      <p>Auto-refreshes every 30 seconds</p>
      {/* Display monitoring data */}
    </div>
  );
}
```

---

## Component Usage

### Custom Monitoring Component

```typescript
'use client';

import { useState, useEffect } from 'react';
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey } from '@/lib/api';

interface Props {
  provider: string;
  model: string;
}

export function ModelHealthCard({ provider, model }: Props) {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const apiKey = getApiKey() || undefined;
    
    async function fetchHealth() {
      setLoading(true);
      setError(null);
      
      try {
        const data = await monitoringService.getModelHealth(provider, model, apiKey);
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    fetchHealth();
  }, [provider, model]);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!health) return <div>No health data available</div>;
  
  return (
    <div className="border rounded-lg p-4">
      <h3>{provider}/{model}</h3>
      <div>Status: {health.last_status}</div>
      <div>Response Time: {health.average_response_time_ms}ms</div>
      <div>Calls: {health.call_count}</div>
    </div>
  );
}
```

### Provider Summary Component

```typescript
'use client';

import { useProviderSummary } from '@/hooks/use-model-health';
import { getApiKey } from '@/lib/api';

interface Props {
  provider: string;
}

export function ProviderSummaryCard({ provider }: Props) {
  const apiKey = getApiKey() || undefined;
  const { summary, loading, error } = useProviderSummary(provider, apiKey);
  
  if (loading) return <div>Loading provider summary...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!summary) return null;
  
  return (
    <div className="card">
      <h2>{provider} Summary</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span>Total Models:</span>
          <span>{summary.total_models}</span>
        </div>
        <div>
          <span>Success Rate:</span>
          <span>{(summary.average_success_rate * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span>Avg Response Time:</span>
          <span>{summary.average_response_time}ms</span>
        </div>
        <div>
          <span>Total Calls:</span>
          <span>{summary.total_calls.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
```

---

## Custom Implementation

### Creating a Custom Monitoring Service

```typescript
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey } from '@/lib/api';

class CustomMonitoringService {
  private getAuthKey(): string | undefined {
    return getApiKey() || undefined;
  }
  
  async getHealthWithRetry(provider: string, model: string, maxRetries = 3) {
    const apiKey = this.getAuthKey();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await monitoringService.getModelHealth(provider, model, apiKey);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        console.log(`Retry ${attempt}/${maxRetries} for ${provider}/${model}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  async batchGetHealth(models: Array<{ provider: string; model: string }>) {
    const apiKey = this.getAuthKey();
    
    const promises = models.map(({ provider, model }) =>
      monitoringService.getModelHealth(provider, model, apiKey)
        .catch(error => {
          console.error(`Failed to fetch ${provider}/${model}:`, error);
          return null;
        })
    );
    
    return Promise.all(promises);
  }
  
  async getUnhealthyModelsAboveThreshold(threshold: number) {
    const apiKey = this.getAuthKey();
    
    try {
      const data = await monitoringService.getUnhealthyModels(threshold, apiKey);
      return data?.models || [];
    } catch (error) {
      console.error('Failed to fetch unhealthy models:', error);
      return [];
    }
  }
}

export const customMonitoring = new CustomMonitoringService();

// Usage
const unhealthy = await customMonitoring.getUnhealthyModelsAboveThreshold(0.3);
console.log(`Found ${unhealthy.length} unhealthy models with >30% error rate`);
```

### Creating a Monitoring Context

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey } from '@/lib/api';

interface MonitoringContextType {
  stats: any | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined);

export function MonitoringProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const refresh = async () => {
    const apiKey = getApiKey() || undefined;
    setLoading(true);
    setError(null);
    
    try {
      const data = await monitoringService.getHealthStats(apiKey);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    refresh();
    
    // Refresh every minute
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <MonitoringContext.Provider value={{ stats, loading, error, refresh }}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within MonitoringProvider');
  }
  return context;
}

// Usage in component
function MyComponent() {
  const { stats, loading, error, refresh } = useMonitoring();
  
  return (
    <div>
      <button onClick={refresh}>Refresh</button>
      {stats && <div>Total Models: {stats.total_models}</div>}
    </div>
  );
}
```

---

## Error Handling

### Comprehensive Error Handling Example

```typescript
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey } from '@/lib/api';

async function robustHealthCheck(provider: string, model: string) {
  const apiKey = getApiKey() || undefined;
  
  try {
    const health = await monitoringService.getModelHealth(provider, model, apiKey);
    
    if (!health) {
      console.log(`No health data for ${provider}/${model} yet`);
      return {
        status: 'unknown',
        message: 'No health data available',
        health: null
      };
    }
    
    if (health.last_status === 'error') {
      return {
        status: 'error',
        message: health.last_error_message || 'Unknown error',
        health
      };
    }
    
    return {
      status: 'success',
      message: 'Model is healthy',
      health
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('HTTP 401')) {
        console.error('Authentication failed, but should have retried automatically');
        return {
          status: 'auth_error',
          message: 'Authentication error (this should not happen)',
          health: null
        };
      }
      
      if (error.message.includes('HTTP 429')) {
        return {
          status: 'rate_limited',
          message: 'Rate limit exceeded, please try again later',
          health: null
        };
      }
      
      if (error.message.includes('HTTP 5')) {
        return {
          status: 'server_error',
          message: 'Server error, please try again later',
          health: null
        };
      }
      
      return {
        status: 'error',
        message: error.message,
        health: null
      };
    }
    
    return {
      status: 'error',
      message: 'Unknown error occurred',
      health: null
    };
  }
}

// Usage
const result = await robustHealthCheck('openai', 'gpt-4');

switch (result.status) {
  case 'success':
    console.log('✅', result.message);
    break;
  case 'error':
    console.error('❌', result.message);
    break;
  case 'rate_limited':
    console.warn('⏱️', result.message);
    break;
  case 'server_error':
    console.error('🔥', result.message);
    break;
  case 'unknown':
    console.log('❓', result.message);
    break;
}
```

### Handling 401 Errors Gracefully

```typescript
import { monitoringService } from '@/lib/monitoring-service';
import { getApiKey, removeApiKey } from '@/lib/api';

async function safeMonitoringCall() {
  const apiKey = getApiKey() || undefined;
  
  try {
    return await monitoringService.getHealthStats(apiKey);
  } catch (error) {
    if (error instanceof Error && error.message.includes('401')) {
      // This should not happen because service auto-retries without auth
      // But if it does, clear the invalid API key
      console.error('API key is invalid, clearing from storage');
      removeApiKey();
      
      // Retry without authentication
      return monitoringService.getHealthStats();
    }
    throw error;
  }
}
```

---

## Best Practices

### 1. Always Handle Null/Undefined API Keys

```typescript
// ✅ Good
const apiKey = getApiKey() || undefined;
const stats = await monitoringService.getHealthStats(apiKey);

// ❌ Bad
const apiKey = getApiKey();
const stats = await monitoringService.getHealthStats(apiKey); // TypeScript might complain
```

### 2. Use Hooks in React Components

```typescript
// ✅ Good - Use hooks in React components
function MyComponent() {
  const apiKey = getApiKey() || undefined;
  const { stats } = useModelHealthStats(apiKey);
  return <div>{stats?.total_models}</div>;
}

// ❌ Bad - Don't use service directly in render
function MyComponent() {
  const [stats, setStats] = useState(null);
  const apiKey = getApiKey() || undefined;
  monitoringService.getHealthStats(apiKey).then(setStats); // Don't do this!
  return <div>{stats?.total_models}</div>;
}
```

### 3. Handle Loading and Error States

```typescript
// ✅ Good
function MyComponent() {
  const apiKey = getApiKey() || undefined;
  const { stats, loading, error } = useModelHealthStats(apiKey);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return <div>No data</div>;
  
  return <div>{stats.total_models}</div>;
}
```

### 4. Implement Retry Logic for Critical Operations

```typescript
async function criticalMonitoringOperation() {
  const apiKey = getApiKey() || undefined;
  let lastError;
  
  for (let i = 0; i < 3; i++) {
    try {
      return await monitoringService.getHealthStats(apiKey);
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError;
}
```

---

**Last Updated:** December 2, 2025
**Status:** ✅ Complete Examples
