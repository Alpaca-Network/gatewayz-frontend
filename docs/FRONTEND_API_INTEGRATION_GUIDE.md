# Gatewayz Admin Frontend API Integration Guide

## Overview

This guide provides complete API integration documentation for building the Gatewayz admin frontend. It includes all endpoints, request/response formats, TypeScript interfaces, and practical implementation examples.

## 🔧 Setup & Configuration

### 1. API Client Configuration

```typescript
// src/lib/api.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 2. TypeScript Interfaces

```typescript
// src/types/api.ts

// Base interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total_count: number;
  has_more: boolean;
  page: number;
  limit: number;
}

// Model interfaces
export interface Model {
  id: string;
  name: string;
  provider: string;
  gateway: string;
  context_length?: number;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
  description?: string;
  capabilities?: string[];
  metadata?: {
    created_at?: string;
    updated_at?: string;
  };
}

export interface ModelzModel {
  model_id: string;
  is_graduated: boolean;
  token_data: {
    Token: string;
    isGraduated: boolean;
    MarketCap?: number;
    priceInUSD?: number;
    Holders?: number;
    volume24h?: number;
    website?: string;
    imgurl?: string;
  };
  source: string;
  has_token: boolean;
}

// Provider interfaces
export interface Provider {
  slug: string;
  site_url?: string;
  logo_url?: string;
  moderated_by_openrouter?: boolean;
  source_gateway?: string;
  source_gateways?: string[];
}

export interface ProviderStats {
  provider: string;
  total_requests: number;
  total_tokens: number;
  average_latency: number;
  success_rate: number;
  cost: number;
  top_models: Array<{
    model: string;
    requests: number;
    tokens: number;
  }>;
}

// User interfaces
export interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  last_login?: string;
  credits: number;
  usage_stats: {
    total_requests: number;
    total_tokens: number;
    total_cost: number;
  };
  api_keys?: Array<{
    id: string;
    name: string;
    created_at: string;
    last_used?: string;
  }>;
}

// System interfaces
export interface GatewayHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time: number;
  uptime: number;
  models_count: number;
  last_checked: string;
  error_rate: number;
}

export interface CacheStatus {
  gateway?: string;
  status: 'valid' | 'expired' | 'empty';
  message: string;
  cache_size: number;
  timestamp?: number;
  ttl: number;
  age_seconds?: number;
  is_valid: boolean;
}

export interface TrendingModel {
  model_id: string;
  requests: number;
  growth: number;
  provider: string;
  gateway: string;
}

// Analytics interfaces
export interface GatewaySummary {
  total_gateways: number;
  active_gateways: number;
  total_models: number;
  total_providers: number;
  gateways: GatewayHealth[];
}

export interface UsageAnalytics {
  usage: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    unique_users: number;
  }>;
  period: string;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
}
```

## 🔐 Admin Authentication Endpoints

### Admin Login
```typescript
// src/services/auth.ts
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export const authService = {
  login: async (credentials: AdminLoginRequest): Promise<AdminLoginResponse> => {
    const response = await apiClient.post<AdminLoginResponse>('/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('admin_token');
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  }
};
```

## 🛡️ Admin Management Endpoints

### Admin Credits Management
```typescript
// src/services/admin.ts
export interface AddCreditsRequest {
  user_id: string;
  amount: number;
  reason?: string;
}

export interface AddCreditsResponse {
  success: boolean;
  message: string;
  user_id: string;
  new_balance: number;
  added_amount: number;
}

export interface BalanceInfo {
  user_id: string;
  email: string;
  current_balance: number;
  total_spent: number;
  last_updated: string;
}

export const adminService = {
  // Add credits to user account
  addCredits: async (data: AddCreditsRequest): Promise<AddCreditsResponse> => {
    const response = await apiClient.post<AddCreditsResponse>('/admin/add_credits', data);
    return response.data;
  },

  // Get all user balances
  getAllBalances: async (): Promise<{
    users: BalanceInfo[];
    total_credits_issued: number;
    total_credits_spent: number;
  }> => {
    const response = await apiClient.get('/admin/balance');
    return response.data;
  }
};
```

### Admin Monitoring
```typescript
export interface MonitorData {
  system_status: {
    uptime: string;
    memory_usage: number;
    cpu_usage: number;
    disk_usage: number;
  };
  api_stats: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    average_response_time: number;
  };
  user_stats: {
    total_users: number;
    active_users: number;
    new_users_today: number;
  };
  gateway_stats: Array<{
    name: string;
    status: string;
    response_time: number;
    requests_count: number;
  }>;
}

export const adminService = {
  // Get system monitoring data
  getMonitorData: async (): Promise<MonitorData> => {
    const response = await apiClient.get<MonitorData>('/admin/monitor');
    return response.data;
  }
};
```

### Admin Rate Limiting
```typescript
export interface RateLimitRequest {
  user_id?: string;
  ip_address?: string;
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  reason?: string;
}

export interface RateLimitResponse {
  success: boolean;
  message: string;
  limits_applied: {
    user_id?: string;
    ip_address?: string;
    requests_per_minute: number;
    requests_per_hour: number;
    requests_per_day: number;
  };
}

export const adminService = {
  // Set rate limits for users or IP addresses
  setRateLimit: async (data: RateLimitRequest): Promise<RateLimitResponse> => {
    const response = await apiClient.post<RateLimitResponse>('/admin/limit', data);
    return response.data;
  }
};
```

### Admin Provider Management
```typescript
export interface RefreshProvidersResponse {
  success: boolean;
  message: string;
  providers_refreshed: string[];
  total_providers: number;
  refresh_time: string;
}

export const adminService = {
  // Refresh all provider data
  refreshProviders: async (): Promise<RefreshProvidersResponse> => {
    const response = await apiClient.post<RefreshProvidersResponse>('/admin/refresh-providers');
    return response.data;
  }
};
```

### Admin Cache Management
```typescript
export interface CacheStatus {
  gateway: string;
  status: 'valid' | 'expired' | 'empty';
  size: number;
  age_seconds: number;
  ttl: number;
  last_refresh: string;
}

export interface HuggingFaceCacheStatus {
  cache_size: number;
  last_refresh: string;
  ttl: number;
  status: 'valid' | 'expired' | 'empty';
}

export const adminService = {
  // Get cache status for all gateways
  getCacheStatus: async (): Promise<{
    caches: CacheStatus[];
    total_size: number;
    last_refresh: string;
  }> => {
    const response = await apiClient.get('/admin/cache-status');
    return response.data;
  },

  // Get HuggingFace cache status
  getHuggingFaceCacheStatus: async (): Promise<HuggingFaceCacheStatus> => {
    const response = await apiClient.get<HuggingFaceCacheStatus>('/admin/huggingface-cache-status');
    return response.data;
  },

  // Refresh HuggingFace cache
  refreshHuggingFaceCache: async (): Promise<{
    success: boolean;
    message: string;
    cache_size: number;
    refresh_time: string;
  }> => {
    const response = await apiClient.post('/admin/refresh-huggingface-cache');
    return response.data;
  }
};
```

### Admin Model Testing & Debugging
```typescript
export interface HuggingFaceTestResponse {
  success: boolean;
  model_id: string;
  model_info: {
    id: string;
    downloads: number;
    likes: number;
    tags: string[];
    pipeline_tag: string;
  };
  test_results: {
    response_time: number;
    status: 'success' | 'error';
    error_message?: string;
  };
}

export interface DebugModelsResponse {
  models: Array<{
    id: string;
    gateway: string;
    provider: string;
    status: 'active' | 'inactive' | 'error';
    last_tested: string;
    error_count: number;
    success_rate: number;
  }>;
  total_models: number;
  active_models: number;
  error_models: number;
}

export const adminService = {
  // Test HuggingFace model
  testHuggingFaceModel: async (huggingFaceId: string): Promise<HuggingFaceTestResponse> => {
    const response = await apiClient.get<HuggingFaceTestResponse>(`/admin/test-huggingface/${huggingFaceId}`);
    return response.data;
  },

  // Debug all models
  debugModels: async (): Promise<DebugModelsResponse> => {
    const response = await apiClient.get<DebugModelsResponse>('/admin/debug-models');
    return response.data;
  }
};
```

### Admin Rate Limiting Management
```typescript
export interface SystemRateLimitStats {
  total_active_limits: number;
  total_blocked_requests: number;
  total_allowed_requests: number;
  average_response_time: number;
  top_blocked_users: Array<{
    user_id: string;
    blocked_count: number;
    last_blocked: string;
  }>;
}

export interface RateLimitAlert {
  id: string;
  user_id: string;
  alert_type: 'rate_limit_exceeded' | 'quota_exhausted' | 'suspicious_activity';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  resolved: boolean;
  resolved_at?: string;
}

export const adminService = {
  // Get system-wide rate limiting statistics
  getSystemRateLimits: async (): Promise<{
    status: string;
    system_stats: SystemRateLimitStats;
    timestamp: string;
  }> => {
    const response = await apiClient.get('/admin/rate-limits/system');
    return response.data;
  },

  // Get rate limit alerts
  getRateLimitAlerts: async (params?: {
    api_key?: string;
    resolved?: boolean;
    limit?: number;
  }): Promise<{
    status: string;
    total_alerts: number;
    alerts: RateLimitAlert[];
    timestamp: string;
  }> => {
    const response = await apiClient.get('/admin/rate-limits/alerts', { params });
    return response.data;
  },

  // Clear rate limit cache
  clearRateLimitCache: async (): Promise<{
    status: string;
    message: string;
    timestamp: string;
  }> => {
    const response = await apiClient.post('/admin/clear-rate-limit-cache');
    return response.data;
  }
};
```

### Admin Coupon Management
```typescript
export interface CreateCouponRequest {
  code: string;
  value_usd: number;
  coupon_scope: 'user_specific' | 'global';
  max_uses?: number;
  valid_until?: string;
  coupon_type: 'percentage' | 'fixed_amount';
  assigned_to_user_id?: number;
  description?: string;
  valid_from?: string;
}

export interface CouponResponse {
  id: number;
  code: string;
  value_usd: number;
  coupon_scope: string;
  max_uses: number;
  current_uses: number;
  valid_until?: string;
  coupon_type: string;
  is_active: boolean;
  created_by: number;
  created_by_type: string;
  assigned_to_user_id?: number;
  description?: string;
  valid_from?: string;
  created_at: string;
  updated_at: string;
}

export interface CouponAnalyticsResponse {
  coupon: CouponResponse;
  total_redemptions: number;
  unique_users: number;
  total_value_distributed: number;
  redemption_rate: number;
  remaining_uses: number;
  is_expired: boolean;
}

export interface CouponStatsResponse {
  total_coupons: number;
  active_coupons: number;
  expired_coupons: number;
  total_value_distributed: number;
  total_redemptions: number;
  average_redemption_rate: number;
}

export const adminService = {
  // Create a new coupon
  createCoupon: async (couponRequest: CreateCouponRequest): Promise<CouponResponse> => {
    const response = await apiClient.post<CouponResponse>('/admin/coupons', couponRequest);
    return response.data;
  },

  // List all coupons with filters
  listCoupons: async (params?: {
    scope?: string;
    coupon_type?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    coupons: CouponResponse[];
    total: number;
    offset: number;
    limit: number;
  }> => {
    const response = await apiClient.get('/admin/coupons', { params });
    return response.data;
  },

  // Get specific coupon
  getCoupon: async (couponId: number): Promise<CouponResponse> => {
    const response = await apiClient.get<CouponResponse>(`/admin/coupons/${couponId}`);
    return response.data;
  },

  // Update a coupon
  updateCoupon: async (couponId: number, updates: Partial<CreateCouponRequest>): Promise<CouponResponse> => {
    const response = await apiClient.patch<CouponResponse>(`/admin/coupons/${couponId}`, updates);
    return response.data;
  },

  // Deactivate a coupon
  deactivateCoupon: async (couponId: number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/coupons/${couponId}`);
    return response.data;
  },

  // Get coupon analytics
  getCouponAnalytics: async (couponId: number): Promise<CouponAnalyticsResponse> => {
    const response = await apiClient.get<CouponAnalyticsResponse>(`/admin/coupons/${couponId}/analytics`);
    return response.data;
  },

  // Get coupon statistics overview
  getCouponStats: async (): Promise<CouponStatsResponse> => {
    const response = await apiClient.get<CouponStatsResponse>('/admin/coupons/stats/overview');
    return response.data;
  }
};
```

### Admin Notification Management
```typescript
export interface NotificationStats {
  total_notifications: number;
  sent_notifications: number;
  failed_notifications: number;
  pending_notifications: number;
  delivery_rate: number;
  last_24h_notifications: number;
}

export interface ProcessNotificationsResponse {
  status: string;
  message: string;
  stats: {
    processed: number;
    sent: number;
    failed: number;
  };
}

export const adminService = {
  // Get notification statistics
  getNotificationStats: async (): Promise<NotificationStats> => {
    const response = await apiClient.get<NotificationStats>('/admin/notifications/stats');
    return response.data;
  },

  // Process all pending notifications
  processNotifications: async (): Promise<ProcessNotificationsResponse> => {
    const response = await apiClient.post<ProcessNotificationsResponse>('/admin/notifications/process');
    return response.data;
  }
};
```

### Admin Role Management
```typescript
export interface UpdateRoleRequest {
  user_id: number;
  new_role: 'user' | 'developer' | 'admin';
  reason?: string;
}

export interface RoleResponse {
  user_id: number;
  role: string;
  permissions: string[];
}

export interface RoleAuditLogResponse {
  logs: Array<{
    id: number;
    user_id: number;
    old_role: string;
    new_role: string;
    changed_by: number;
    reason?: string;
    created_at: string;
  }>;
  total: number;
}

export const adminService = {
  // Update user role
  updateUserRole: async (request: UpdateRoleRequest): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await apiClient.post('/admin/roles/update', request);
    return response.data;
  },

  // Get user role information
  getUserRole: async (userId: number): Promise<RoleResponse> => {
    const response = await apiClient.get<RoleResponse>(`/admin/roles/${userId}`);
    return response.data;
  },

  // Get role audit log
  getRoleAuditLog: async (params?: {
    user_id?: number;
    limit?: number;
  }): Promise<RoleAuditLogResponse> => {
    const response = await apiClient.get<RoleAuditLogResponse>('/admin/roles/audit/log', { params });
    return response.data;
  },

  // List users by role
  listUsersByRole: async (role: string, limit: number = 100): Promise<{
    role: string;
    users: Array<{
      user_id: number;
      username: string;
      email: string;
      role: string;
      created_at: string;
    }>;
    total: number;
  }> => {
    const response = await apiClient.get(`/admin/roles/list/${role}`, { params: { limit } });
    return response.data;
  },

  // Get role permissions
  getRolePermissions: async (role: string): Promise<{
    role: string;
    permissions: string[];
    description: string;
  }> => {
    const response = await apiClient.get(`/admin/roles/permissions/${role}`);
    return response.data;
  }
};
```

### Admin Plan Management
```typescript
export interface AssignPlanRequest {
  user_id: number;
  plan_id: string;
  duration_months: number;
}

export const adminService = {
  // Assign plan to user
  assignPlanToUser: async (request: AssignPlanRequest): Promise<{
    status: string;
    message: string;
    user_id: number;
    plan_id: string;
    duration_months: number;
    timestamp: string;
  }> => {
    const response = await apiClient.post('/admin/assign-plan', request);
    return response.data;
  }
};
```

### Admin Trial Analytics
```typescript
export interface TrialAnalyticsResponse {
  success: boolean;
  analytics: {
    total_trials: number;
    active_trials: number;
    expired_trials: number;
    converted_trials: number;
    conversion_rate: number;
    average_trial_duration: number;
    trial_signups_last_7_days: number;
    trial_signups_last_30_days: number;
  };
}

export const adminService = {
  // Get trial analytics
  getTrialAnalytics: async (): Promise<TrialAnalyticsResponse> => {
    const response = await apiClient.get<TrialAnalyticsResponse>('/admin/trial/analytics');
    return response.data;
  }
};
```

### Admin User Management
```typescript
export interface UserInfo {
  id: number;
  username: string;
  email: string;
  credits: number;
  is_active: boolean;
  role: string;
  registration_date: string;
  auth_method: string;
  subscription_status: string;
  trial_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AllUsersResponse {
  status: string;
  total_users: number;
  statistics: {
    active_users: number;
    inactive_users: number;
    admin_users: number;
    developer_users: number;
    regular_users: number;
    total_credits: number;
    average_credits: number;
    subscription_breakdown: Record<string, number>;
  };
  users: UserInfo[];
  timestamp: string;
}

export interface UserDetailResponse {
  status: string;
  user: UserInfo;
  api_keys: Array<{
    id: number;
    key_name: string;
    api_key: string;
    is_active: boolean;
    is_primary: boolean;
    environment_tag: string;
    created_at: string;
    last_used_at?: string;
  }>;
  recent_usage: Array<{
    id: number;
    user_id: number;
    model: string;
    tokens_used: number;
    cost: number;
    created_at: string;
  }>;
  recent_activity: Array<{
    id: number;
    user_id: number;
    action: string;
    endpoint: string;
    created_at: string;
  }>;
  timestamp: string;
}

export const adminService = {
  // Get all users information
  getAllUsers: async (): Promise<AllUsersResponse> => {
    const response = await apiClient.get<AllUsersResponse>('/admin/users');
    return response.data;
  },

  // Get specific user information
  getUserById: async (userId: number): Promise<UserDetailResponse> => {
    const response = await apiClient.get<UserDetailResponse>(`/admin/users/${userId}`);
    return response.data;
  }
};
```

## 🔧 Admin React Query Hooks

### Admin Service Hooks
```typescript
// src/hooks/useAdmin.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin';

// Credits Management Hooks
export const useAddCredits = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminService.addCredits,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'balances'] });
    },
  });
};

export const useAllBalances = () => {
  return useQuery({
    queryKey: ['admin', 'balances'],
    queryFn: adminService.getAllBalances,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

// Monitoring Hooks
export const useMonitorData = () => {
  return useQuery({
    queryKey: ['admin', 'monitor'],
    queryFn: adminService.getMonitorData,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 10 * 1000, // Refetch every 10 seconds for real-time monitoring
  });
};

// Rate Limiting Hooks
export const useSetRateLimit = () => {
  return useMutation({
    mutationFn: adminService.setRateLimit,
    onSuccess: () => {
      // Optionally invalidate related queries
    },
  });
};

// Provider Management Hooks
export const useRefreshProviders = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminService.refreshProviders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });
};

// Cache Management Hooks
export const useAdminCacheStatus = () => {
  return useQuery({
    queryKey: ['admin', 'cache-status'],
    queryFn: adminService.getCacheStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useHuggingFaceCacheStatus = () => {
  return useQuery({
    queryKey: ['admin', 'huggingface-cache-status'],
    queryFn: adminService.getHuggingFaceCacheStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useRefreshHuggingFaceCache = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminService.refreshHuggingFaceCache,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'huggingface-cache-status'] });
    },
  });
};

// Model Testing & Debugging Hooks
export const useTestHuggingFaceModel = () => {
  return useMutation({
    mutationFn: adminService.testHuggingFaceModel,
  });
};

export const useDebugModels = () => {
  return useQuery({
    queryKey: ['admin', 'debug-models'],
    queryFn: adminService.debugModels,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

// Rate Limiting Hooks
export const useSystemRateLimits = () => {
  return useQuery({
    queryKey: ['admin', 'rate-limits', 'system'],
    queryFn: adminService.getSystemRateLimits,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useRateLimitAlerts = (params?: {
  api_key?: string;
  resolved?: boolean;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['admin', 'rate-limits', 'alerts', params],
    queryFn: () => adminService.getRateLimitAlerts(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useClearRateLimitCache = () => {
  return useMutation({
    mutationFn: adminService.clearRateLimitCache,
  });
};

// Coupon Management Hooks
export const useCreateCoupon = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminService.createCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
  });
};

export const useListCoupons = (params?: {
  scope?: string;
  coupon_type?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: ['admin', 'coupons', 'list', params],
    queryFn: () => adminService.listCoupons(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useGetCoupon = (couponId: number) => {
  return useQuery({
    queryKey: ['admin', 'coupons', couponId],
    queryFn: () => adminService.getCoupon(couponId),
    enabled: !!couponId,
  });
};

export const useUpdateCoupon = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ couponId, updates }: { couponId: number; updates: any }) =>
      adminService.updateCoupon(couponId, updates),
    onSuccess: (_, { couponId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons', couponId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons', 'list'] });
    },
  });
};

export const useDeactivateCoupon = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminService.deactivateCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
  });
};

export const useCouponAnalytics = (couponId: number) => {
  return useQuery({
    queryKey: ['admin', 'coupons', couponId, 'analytics'],
    queryFn: () => adminService.getCouponAnalytics(couponId),
    enabled: !!couponId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCouponStats = () => {
  return useQuery({
    queryKey: ['admin', 'coupons', 'stats'],
    queryFn: adminService.getCouponStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Notification Management Hooks
export const useNotificationStats = () => {
  return useQuery({
    queryKey: ['admin', 'notifications', 'stats'],
    queryFn: adminService.getNotificationStats,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useProcessNotifications = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminService.processNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
  });
};

// Role Management Hooks
export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminService.updateUserRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });
};

export const useGetUserRole = (userId: number) => {
  return useQuery({
    queryKey: ['admin', 'roles', userId],
    queryFn: () => adminService.getUserRole(userId),
    enabled: !!userId,
  });
};

export const useRoleAuditLog = (params?: {
  user_id?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['admin', 'roles', 'audit', params],
    queryFn: () => adminService.getRoleAuditLog(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useUsersByRole = (role: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['admin', 'roles', 'list', role, limit],
    queryFn: () => adminService.listUsersByRole(role, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useRolePermissions = (role: string) => {
  return useQuery({
    queryKey: ['admin', 'roles', 'permissions', role],
    queryFn: () => adminService.getRolePermissions(role),
    enabled: !!role,
    staleTime: 10 * 60 * 1000, // 10 minutes (permissions don't change often)
  });
};

// Plan Management Hooks
export const useAssignPlanToUser = () => {
  return useMutation({
    mutationFn: adminService.assignPlanToUser,
  });
};

// Trial Analytics Hooks
export const useTrialAnalytics = () => {
  return useQuery({
    queryKey: ['admin', 'trial', 'analytics'],
    queryFn: adminService.getTrialAnalytics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

// User Management Hooks
export const useAllUsers = () => {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminService.getAllUsers,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useUserById = (userId: number) => {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminService.getUserById(userId),
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};
```

### React Hook for Authentication
```typescript
// src/hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { authService, AdminLoginRequest } from '../services/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('admin_token');
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('admin_token');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    const response = await authService.login(credentials);
    localStorage.setItem('admin_token', response.access_token);
    setUser(response.user);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## 📊 Dashboard & Analytics Endpoints

### Gateway Summary
```typescript
// src/services/dashboard.ts
export const dashboardService = {
  getGatewaySummary: async (): Promise<GatewaySummary> => {
    const response = await apiClient.get<GatewaySummary>('/gateways/summary');
    return response.data;
  },

  getProviderStats: async (providerName: string): Promise<ProviderStats> => {
    const response = await apiClient.get<ProviderStats>(`/provider/${providerName}/stats`);
    return response.data;
  },

  getTrendingModels: async (limit: number = 10, period: string = '7d'): Promise<{
    trending_models: TrendingModel[];
    period: string;
    total_requests: number;
  }> => {
    const response = await apiClient.get('/models/trending', {
      params: { limit, period }
    });
    return response.data;
  },

  getAllGatewaysSummary: async (): Promise<GatewayHealth[]> => {
    const response = await apiClient.get<GatewayHealth[]>('/gateways/summary');
    return response.data.gateways;
  }
};
```

### React Query Hooks for Dashboard
```typescript
// src/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard';

export const useGatewaySummary = () => {
  return useQuery({
    queryKey: ['dashboard', 'gateway-summary'],
    queryFn: dashboardService.getGatewaySummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useProviderStats = (providerName: string) => {
  return useQuery({
    queryKey: ['dashboard', 'provider-stats', providerName],
    queryFn: () => dashboardService.getProviderStats(providerName),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!providerName,
  });
};

export const useTrendingModels = (limit: number = 10, period: string = '7d') => {
  return useQuery({
    queryKey: ['dashboard', 'trending-models', limit, period],
    queryFn: () => dashboardService.getTrendingModels(limit, period),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};
```

## 🏗️ Models Management Endpoints

### Models Service
```typescript
// src/services/models.ts
export interface ModelsFilters {
  gateway?: string;
  provider?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ModelComparisonRequest {
  model_ids: string[];
  criteria?: string[];
}

export const modelsService = {
  // Get all models with filters
  getModels: async (filters: ModelsFilters = {}): Promise<PaginatedResponse<Model>> => {
    const response = await apiClient.get<PaginatedResponse<Model>>('/models', {
      params: filters
    });
    return response.data;
  },

  // Get specific model
  getModel: async (modelId: string): Promise<Model> => {
    const response = await apiClient.get<Model>(`/models/${modelId}`);
    return response.data;
  },

  // Compare models
  compareModels: async (request: ModelComparisonRequest): Promise<{
    comparison: Array<{
      model_id: string;
      gateway: string;
      pricing: {
        prompt: number;
        completion: number;
        total_per_1m: number;
      };
      context_length: number;
      performance_score?: number;
    }>;
    recommendations: {
      cheapest: string;
      fastest: string;
      best_value: string;
    };
  }> => {
    const response = await apiClient.post('/models/compare', request);
    return response.data;
  },

  // Advanced search
  searchModels: async (params: {
    q?: string;
    provider?: string;
    max_context?: number;
    min_context?: number;
    capabilities?: string[];
    gateway?: string;
  }): Promise<{
    models: Array<Model & { relevance_score: number }>;
    total_count: number;
    search_metadata: {
      query: string;
      filters_applied: any;
    };
  }> => {
    const response = await apiClient.get('/models/search', { params });
    return response.data;
  },

  // Get model count by provider
  getModelCountByProvider: async (): Promise<Record<string, number>> => {
    const response = await apiClient.get<Record<string, number>>('/models/providers/count');
    return response.data;
  }
};
```

### React Query Hooks for Models
```typescript
// src/hooks/useModels.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelsService, ModelsFilters, ModelComparisonRequest } from '../services/models';

export const useModels = (filters: ModelsFilters = {}) => {
  return useQuery({
    queryKey: ['models', filters],
    queryFn: () => modelsService.getModels(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useModel = (modelId: string) => {
  return useQuery({
    queryKey: ['models', modelId],
    queryFn: () => modelsService.getModel(modelId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!modelId,
  });
};

export const useModelComparison = () => {
  return useMutation({
    mutationFn: (request: ModelComparisonRequest) => 
      modelsService.compareModels(request),
  });
};

export const useModelSearch = () => {
  return useMutation({
    mutationFn: (params: any) => modelsService.searchModels(params),
  });
};

export const useModelCountByProvider = () => {
  return useQuery({
    queryKey: ['models', 'provider-count'],
    queryFn: modelsService.getModelCountByProvider,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};
```

## 🔗 Modelz Integration Endpoints

### Modelz Service
```typescript
// src/services/modelz.ts
export interface ModelzFilters {
  isGraduated?: boolean;
}

export const modelzService = {
  // Get Modelz models
  getModelzModels: async (filters: ModelzFilters = {}): Promise<{
    models: ModelzModel[];
    total_count: number;
    filter: {
      is_graduated: boolean | null;
      description: string;
    };
    source: string;
    api_reference: string;
  }> => {
    const response = await apiClient.get('/modelz/models', {
      params: { isGraduated: filters.isGraduated }
    });
    return response.data;
  },

  // Get Modelz model IDs only
  getModelzModelIds: async (filters: ModelzFilters = {}): Promise<{
    model_ids: string[];
    total_count: number;
    filter: {
      is_graduated: boolean | null;
      description: string;
    };
    source: string;
  }> => {
    const response = await apiClient.get('/modelz/ids', {
      params: { isGraduated: filters.isGraduated }
    });
    return response.data;
  },

  // Check if model exists on Modelz
  checkModelOnModelz: async (modelId: string, filters: ModelzFilters = {}): Promise<{
    model_id: string;
    exists_on_modelz: boolean;
    filter: {
      is_graduated: boolean | null;
      description: string;
    };
    source: string;
    model_details?: any;
  }> => {
    const response = await apiClient.get(`/modelz/check/${modelId}`, {
      params: { isGraduated: filters.isGraduated }
    });
    return response.data;
  }
};
```

### React Query Hooks for Modelz
```typescript
// src/hooks/useModelz.ts
import { useQuery } from '@tanstack/react-query';
import { modelzService, ModelzFilters } from '../services/modelz';

export const useModelzModels = (filters: ModelzFilters = {}) => {
  return useQuery({
    queryKey: ['modelz', 'models', filters],
    queryFn: () => modelzService.getModelzModels(filters),
    staleTime: 30 * 60 * 1000, // 30 minutes (cached on backend)
  });
};

export const useModelzModelIds = (filters: ModelzFilters = {}) => {
  return useQuery({
    queryKey: ['modelz', 'ids', filters],
    queryFn: () => modelzService.getModelzModelIds(filters),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useModelzCheck = (modelId: string, filters: ModelzFilters = {}) => {
  return useQuery({
    queryKey: ['modelz', 'check', modelId, filters],
    queryFn: () => modelzService.checkModelOnModelz(modelId, filters),
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!modelId,
  });
};
```

## 👥 Users Management Endpoints

### Users Service
```typescript
// src/services/users.ts
export interface UsersFilters {
  limit?: number;
  offset?: number;
  role?: string;
  status?: string;
  search?: string;
}

export interface UpdateUserRequest {
  role?: string;
  credits?: number;
  status?: string;
}

export const usersService = {
  // Get all users
  getUsers: async (filters: UsersFilters = {}): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>('/users', {
      params: filters
    });
    return response.data;
  },

  // Get specific user
  getUser: async (userId: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${userId}`);
    return response.data;
  },

  // Update user
  updateUser: async (userId: string, data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${userId}`, data);
    return response.data;
  },

  // Delete user
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`);
  },

  // Get user analytics
  getUserAnalytics: async (userId: string, period: string = '30d'): Promise<{
    usage: Array<{
      date: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
    period: string;
    total_requests: number;
    total_tokens: number;
    total_cost: number;
  }> => {
    const response = await apiClient.get(`/users/${userId}/analytics`, {
      params: { period }
    });
    return response.data;
  }
};
```

### React Query Hooks for Users
```typescript
// src/hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService, UsersFilters, UpdateUserRequest } from '../services/users';

export const useUsers = (filters: UsersFilters = {}) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => usersService.getUsers(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useUser = (userId: string) => {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => usersService.getUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserRequest }) =>
      usersService.updateUser(userId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: string) => usersService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
```

## 🏥 System Health Endpoints

### System Health Service
```typescript
// src/services/system.ts
export const systemService = {
  // Get all gateways health
  getGatewaysHealth: async (): Promise<{
    gateways: GatewayHealth[];
    overall_status: string;
    timestamp: string;
  }> => {
    const response = await apiClient.get('/health/gateways');
    return response.data;
  },

  // Get specific gateway health
  getGatewayHealth: async (gateway: string): Promise<GatewayHealth> => {
    const response = await apiClient.get<GatewayHealth>(`/health/${gateway}`);
    return response.data;
  },

  // Get gateway health history
  getGatewayHealthHistory: async (gateway: string, hours: number = 24): Promise<{
    gateway: string;
    history: Array<{
      timestamp: string;
      status: string;
      response_time: number;
      uptime: number;
    }>;
    period: string;
    average_uptime: number;
  }> => {
    const response = await apiClient.get(`/health/${gateway}/history`, {
      params: { hours }
    });
    return response.data;
  }
};
```

### React Query Hooks for System Health
```typescript
// src/hooks/useSystemHealth.ts
import { useQuery } from '@tanstack/react-query';
import { systemService } from '../services/system';

export const useGatewaysHealth = () => {
  return useQuery({
    queryKey: ['system', 'health', 'gateways'],
    queryFn: systemService.getGatewaysHealth,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useGatewayHealth = (gateway: string) => {
  return useQuery({
    queryKey: ['system', 'health', 'gateway', gateway],
    queryFn: () => systemService.getGatewayHealth(gateway),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    enabled: !!gateway,
  });
};

export const useGatewayHealthHistory = (gateway: string, hours: number = 24) => {
  return useQuery({
    queryKey: ['system', 'health', 'history', gateway, hours],
    queryFn: () => systemService.getGatewayHealthHistory(gateway, hours),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!gateway,
  });
};
```

## 💾 Cache Management Endpoints

### Cache Service
```typescript
// src/services/cache.ts
export const cacheService = {
  // Get cache status for all gateways
  getCacheStatus: async (): Promise<{
    caches: Array<{
      gateway: string;
      status: string;
      size: number;
      age_seconds: number;
      ttl: number;
    }>;
    total_size: number;
    last_refresh: string;
  }> => {
    const response = await apiClient.get('/cache/status');
    return response.data;
  },

  // Refresh gateway cache
  refreshGatewayCache: async (gateway: string): Promise<{
    success: boolean;
    gateway: string;
    message: string;
    cache_size?: number;
    timestamp: string;
  }> => {
    const response = await apiClient.post(`/cache/${gateway}/refresh`);
    return response.data;
  },

  // Clear gateway cache
  clearGatewayCache: async (gateway: string): Promise<{
    success: boolean;
    gateway: string;
    message: string;
    timestamp: string;
  }> => {
    const response = await apiClient.delete(`/cache/${gateway}/clear`);
    return response.data;
  },

  // Modelz cache management
  getModelzCacheStatus: async (): Promise<CacheStatus> => {
    const response = await apiClient.get<ApiResponse<CacheStatus>>('/cache/modelz/status');
    return response.data.data!;
  },

  refreshModelzCache: async (): Promise<{
    status: string;
    message: string;
    cache_size: number;
    timestamp: number;
    ttl: number;
  }> => {
    const response = await apiClient.post('/cache/modelz/refresh');
    return response.data.data;
  },

  clearModelzCache: async (): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
  }> => {
    const response = await apiClient.delete('/cache/modelz/clear');
    return response.data;
  }
};
```

### React Query Hooks for Cache Management
```typescript
// src/hooks/useCacheManagement.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cacheService } from '../services/cache';

export const useCacheStatus = () => {
  return useQuery({
    queryKey: ['cache', 'status'],
    queryFn: cacheService.getCacheStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useModelzCacheStatus = () => {
  return useQuery({
    queryKey: ['cache', 'modelz', 'status'],
    queryFn: cacheService.getModelzCacheStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useRefreshCache = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (gateway: string) => cacheService.refreshGatewayCache(gateway),
    onSuccess: (_, gateway) => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      if (gateway === 'modelz') {
        queryClient.invalidateQueries({ queryKey: ['modelz'] });
      }
    },
  });
};

export const useClearCache = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (gateway: string) => cacheService.clearGatewayCache(gateway),
    onSuccess: (_, gateway) => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'status'] });
      if (gateway === 'modelz') {
        queryClient.invalidateQueries({ queryKey: ['modelz'] });
      }
    },
  });
};

export const useModelzCacheManagement = () => {
  const queryClient = useQueryClient();
  
  const refreshModelzCache = useMutation({
    mutationFn: cacheService.refreshModelzCache,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'modelz'] });
      queryClient.invalidateQueries({ queryKey: ['modelz'] });
    },
  });
  
  const clearModelzCache = useMutation({
    mutationFn: cacheService.clearModelzCache,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache', 'modelz'] });
      queryClient.invalidateQueries({ queryKey: ['modelz'] });
    },
  });
  
  return { refreshModelzCache, clearModelzCache };
};
```

## 📈 Analytics Endpoints

### Analytics Service
```typescript
// src/services/analytics.ts
export const analyticsService = {
  // Get provider analytics
  getProviderAnalytics: async (period: string = '30d', metric: string = 'requests'): Promise<{
    providers: Array<{
      name: string;
      requests: number;
      tokens: number;
      cost: number;
      growth: number;
      top_models: string[];
    }>;
    period: string;
    total_requests: number;
  }> => {
    const response = await apiClient.get('/analytics/providers', {
      params: { period, metric }
    });
    return response.data;
  },

  // Get usage analytics
  getUsageAnalytics: async (period: string = '7d', groupBy: string = 'day'): Promise<UsageAnalytics> => {
    const response = await apiClient.get('/analytics/usage', {
      params: { period, group_by: groupBy }
    });
    return response.data;
  },

  // Get gateway analytics
  getGatewayAnalytics: async (gateway: string, period: string = '7d'): Promise<{
    gateway: string;
    performance: Array<{
      timestamp: string;
      response_time: number;
      uptime: number;
      requests: number;
    }>;
    period: string;
    average_response_time: number;
    average_uptime: number;
  }> => {
    const response = await apiClient.get(`/analytics/gateway/${gateway}`, {
      params: { period }
    });
    return response.data;
  }
};
```

### React Query Hooks for Analytics
```typescript
// src/hooks/useAnalytics.ts
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics';

export const useProviderAnalytics = (period: string = '30d', metric: string = 'requests') => {
  return useQuery({
    queryKey: ['analytics', 'providers', period, metric],
    queryFn: () => analyticsService.getProviderAnalytics(period, metric),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUsageAnalytics = (period: string = '7d', groupBy: string = 'day') => {
  return useQuery({
    queryKey: ['analytics', 'usage', period, groupBy],
    queryFn: () => analyticsService.getUsageAnalytics(period, groupBy),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useGatewayAnalytics = (gateway: string, period: string = '7d') => {
  return useQuery({
    queryKey: ['analytics', 'gateway', gateway, period],
    queryFn: () => analyticsService.getGatewayAnalytics(gateway, period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!gateway,
  });
};
```

## 🎨 Admin React Components Examples

### Admin Dashboard Component
```typescript
// src/components/Admin/AdminDashboard.tsx
import React from 'react';
import { Row, Col, Card, Statistic, Spin, Alert } from 'antd';
import { useMonitorData } from '../../hooks/useAdmin';

export const AdminDashboard: React.FC = () => {
  const { data: monitorData, isLoading, error } = useMonitorData();

  if (isLoading) {
    return <Spin size="large" />;
  }

  if (error) {
    return <Alert message="Failed to load monitoring data" type="error" />;
  }

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      
      {/* System Status */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="System Uptime"
              value={monitorData?.system_status.uptime}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Memory Usage"
              value={monitorData?.system_status.memory_usage}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="CPU Usage"
              value={monitorData?.system_status.cpu_usage}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Disk Usage"
              value={monitorData?.system_status.disk_usage}
              suffix="%"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* API Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Requests"
              value={monitorData?.api_stats.total_requests}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Success Rate"
              value={monitorData?.api_stats.successful_requests}
              suffix={`/${monitorData?.api_stats.total_requests}`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Avg Response Time"
              value={monitorData?.api_stats.average_response_time}
              suffix="ms"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* User Statistics */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Users"
              value={monitorData?.user_stats.total_users}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Active Users"
              value={monitorData?.user_stats.active_users}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="New Users Today"
              value={monitorData?.user_stats.new_users_today}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

### Admin Credits Management Component
```typescript
// src/components/Admin/CreditsManagement.tsx
import React, { useState } from 'react';
import { Table, Button, Input, Modal, Form, InputNumber, message, Space, Tag } from 'antd';
import { useAllBalances, useAddCredits } from '../../hooks/useAdmin';

export const CreditsManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: balancesData, isLoading } = useAllBalances();
  const addCredits = useAddCredits();

  const handleAddCredits = async (values: { amount: number; reason?: string }) => {
    try {
      await addCredits.mutateAsync({
        user_id: selectedUser.user_id,
        amount: values.amount,
        reason: values.reason,
      });
      message.success('Credits added successfully');
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('Failed to add credits');
    }
  };

  const columns = [
    {
      title: 'User ID',
      dataIndex: 'user_id',
      key: 'user_id',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Current Balance',
      dataIndex: 'current_balance',
      key: 'current_balance',
      render: (balance: number) => (
        <Tag color={balance > 0 ? 'green' : 'red'}>
          ${balance.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: 'Total Spent',
      dataIndex: 'total_spent',
      key: 'total_spent',
      render: (spent: number) => `$${spent.toFixed(2)}`,
    },
    {
      title: 'Last Updated',
      dataIndex: 'last_updated',
      key: 'last_updated',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: any) => (
        <Button
          type="primary"
          onClick={() => {
            setSelectedUser(record);
            setIsModalVisible(true);
          }}
        >
          Add Credits
        </Button>
      ),
    },
  ];

  return (
    <div className="credits-management">
      <div className="credits-header">
        <h1>Credits Management</h1>
        <div className="credits-summary">
          <Space>
            <Tag color="blue">
              Total Credits Issued: ${balancesData?.total_credits_issued?.toFixed(2) || '0.00'}
            </Tag>
            <Tag color="red">
              Total Credits Spent: ${balancesData?.total_credits_spent?.toFixed(2) || '0.00'}
            </Tag>
          </Space>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={balancesData?.users || []}
        loading={isLoading}
        rowKey="user_id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
        }}
      />

      <Modal
        title={`Add Credits to ${selectedUser?.email}`}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddCredits}
        >
          <Form.Item
            label="Amount"
            name="amount"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              style={{ width: '100%' }}
              prefix="$"
              placeholder="Enter credit amount"
            />
          </Form.Item>
          <Form.Item
            label="Reason (Optional)"
            name="reason"
          >
            <Input.TextArea
              rows={3}
              placeholder="Enter reason for adding credits"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={addCredits.isPending}>
                Add Credits
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
```

### Admin Cache Management Component
```typescript
// src/components/Admin/CacheManagement.tsx
import React from 'react';
import { Card, Button, Table, Space, Tag, message, Row, Col, Statistic } from 'antd';
import { 
  useAdminCacheStatus, 
  useHuggingFaceCacheStatus, 
  useRefreshHuggingFaceCache 
} from '../../hooks/useAdmin';

export const CacheManagement: React.FC = () => {
  const { data: cacheStatus, isLoading: cacheLoading } = useAdminCacheStatus();
  const { data: hfCacheStatus, isLoading: hfLoading } = useHuggingFaceCacheStatus();
  const refreshHFCache = useRefreshHuggingFaceCache();

  const handleRefreshHFCache = async () => {
    try {
      await refreshHFCache.mutateAsync();
      message.success('HuggingFace cache refreshed successfully');
    } catch (error) {
      message.error('Failed to refresh HuggingFace cache');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'green';
      case 'expired': return 'orange';
      case 'empty': return 'red';
      default: return 'default';
    }
  };

  const cacheColumns = [
    {
      title: 'Gateway',
      dataIndex: 'gateway',
      key: 'gateway',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => size.toLocaleString(),
    },
    {
      title: 'Age',
      dataIndex: 'age_seconds',
      key: 'age_seconds',
      render: (age: number) => `${Math.round(age / 60)}m`,
    },
    {
      title: 'TTL',
      dataIndex: 'ttl',
      key: 'ttl',
      render: (ttl: number) => `${Math.round(ttl / 60)}m`,
    },
    {
      title: 'Last Refresh',
      dataIndex: 'last_refresh',
      key: 'last_refresh',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  return (
    <div className="cache-management">
      <h1>Cache Management</h1>
      
      {/* Cache Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Cache Size"
              value={cacheStatus?.total_size || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="HF Cache Size"
              value={hfCacheStatus?.cache_size || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="HF Cache Status"
              value={hfCacheStatus?.status || 'Unknown'}
              valueStyle={{ 
                color: hfCacheStatus?.status === 'valid' ? '#52c41a' : '#ff4d4f' 
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Gateway Caches */}
      <Card title="Gateway Caches" style={{ marginBottom: 16 }}>
        <Table
          columns={cacheColumns}
          dataSource={cacheStatus?.caches || []}
          loading={cacheLoading}
          rowKey="gateway"
          pagination={false}
        />
      </Card>

      {/* HuggingFace Cache */}
      <Card 
        title="HuggingFace Cache" 
        extra={
          <Button 
            type="primary" 
            onClick={handleRefreshHFCache}
            loading={refreshHFCache.isPending}
          >
            Refresh Cache
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Statistic
              title="Cache Size"
              value={hfCacheStatus?.cache_size || 0}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Status"
              value={hfCacheStatus?.status || 'Unknown'}
              valueStyle={{ 
                color: hfCacheStatus?.status === 'valid' ? '#52c41a' : '#ff4d4f' 
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="TTL"
              value={hfCacheStatus?.ttl ? Math.round(hfCacheStatus.ttl / 60) : 0}
              suffix="minutes"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Last Refresh"
              value={hfCacheStatus?.last_refresh ? 
                new Date(hfCacheStatus.last_refresh).toLocaleString() : 
                'Never'
              }
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};
```

### Admin Model Testing Component
```typescript
// src/components/Admin/ModelTesting.tsx
import React, { useState } from 'react';
import { Card, Table, Button, Input, Modal, message, Space, Tag, Form } from 'antd';
import { useDebugModels, useTestHuggingFaceModel } from '../../hooks/useAdmin';

export const ModelTesting: React.FC = () => {
  const [isTestModalVisible, setIsTestModalVisible] = useState(false);
  const [testModelId, setTestModelId] = useState('');
  const [form] = Form.useForm();

  const { data: debugData, isLoading } = useDebugModels();
  const testHuggingFaceModel = useTestHuggingFaceModel();

  const handleTestModel = async (values: { modelId: string }) => {
    try {
      const result = await testHuggingFaceModel.mutateAsync(values.modelId);
      message.success(`Model ${values.modelId} tested successfully`);
      console.log('Test result:', result);
    } catch (error) {
      message.error(`Failed to test model ${values.modelId}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'orange';
      case 'error': return 'red';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Model ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Gateway',
      dataIndex: 'gateway',
      key: 'gateway',
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Success Rate',
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (rate: number) => `${rate.toFixed(1)}%`,
    },
    {
      title: 'Error Count',
      dataIndex: 'error_count',
      key: 'error_count',
      render: (count: number) => (
        <Tag color={count > 0 ? 'red' : 'green'}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Last Tested',
      dataIndex: 'last_tested',
      key: 'last_tested',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: any) => (
        <Button
          size="small"
          onClick={() => {
            setTestModelId(record.id);
            setIsTestModalVisible(true);
          }}
        >
          Test Model
        </Button>
      ),
    },
  ];

  return (
    <div className="model-testing">
      <div className="model-testing-header">
        <h1>Model Testing & Debugging</h1>
        <Space>
          <Tag color="blue">
            Total Models: {debugData?.total_models || 0}
          </Tag>
          <Tag color="green">
            Active: {debugData?.active_models || 0}
          </Tag>
          <Tag color="red">
            Errors: {debugData?.error_models || 0}
          </Tag>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={debugData?.models || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
          }}
        />
      </Card>

      <Modal
        title="Test HuggingFace Model"
        open={isTestModalVisible}
        onCancel={() => setIsTestModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            handleTestModel(values);
            setIsTestModalVisible(false);
            form.resetFields();
          }}
        >
          <Form.Item
            label="Model ID"
            name="modelId"
            initialValue={testModelId}
            rules={[{ required: true, message: 'Please enter model ID' }]}
          >
            <Input placeholder="Enter HuggingFace model ID" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={testHuggingFaceModel.isPending}
              >
                Test Model
              </Button>
              <Button onClick={() => setIsTestModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
```

### Admin Rate Limiting Management Component
```typescript
// src/components/Admin/RateLimitManagement.tsx
import React, { useState } from 'react';
import { Card, Table, Button, message, Space, Tag, Row, Col, Statistic, Alert } from 'antd';
import { 
  useSystemRateLimits, 
  useRateLimitAlerts, 
  useClearRateLimitCache 
} from '../../hooks/useAdmin';

export const RateLimitManagement: React.FC = () => {
  const [alertFilters, setAlertFilters] = useState<{
    api_key?: string;
    resolved?: boolean;
    limit?: number;
  }>({ limit: 100 });

  const { data: systemData, isLoading: systemLoading } = useSystemRateLimits();
  const { data: alertsData, isLoading: alertsLoading } = useRateLimitAlerts(alertFilters);
  const clearCache = useClearRateLimitCache();

  const handleClearCache = async () => {
    try {
      await clearCache.mutateAsync();
      message.success('Rate limit cache cleared successfully');
    } catch (error) {
      message.error('Failed to clear rate limit cache');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'blue';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const alertColumns = [
    {
      title: 'Alert Type',
      dataIndex: 'alert_type',
      key: 'alert_type',
      render: (type: string) => (
        <Tag color="red">{type.replace('_', ' ').toUpperCase()}</Tag>
      ),
    },
    {
      title: 'User ID',
      dataIndex: 'user_id',
      key: 'user_id',
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>
          {severity.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'resolved',
      key: 'resolved',
      render: (resolved: boolean) => (
        <Tag color={resolved ? 'green' : 'red'}>
          {resolved ? 'RESOLVED' : 'PENDING'}
        </Tag>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  return (
    <div className="rate-limit-management">
      <div className="rate-limit-header">
        <h1>Rate Limiting Management</h1>
        <Space>
          <Button 
            type="primary" 
            onClick={handleClearCache}
            loading={clearCache.isPending}
          >
            Clear Cache
          </Button>
        </Space>
      </div>

      {/* System Statistics */}
      <Row gutter={[16, 16]} style={{ lineHeight: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Limits"
              value={systemData?.system_stats.total_active_limits || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Blocked Requests"
              value={systemData?.system_stats.total_blocked_requests || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Allowed Requests"
              value={systemData?.system_stats.total_allowed_requests || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Avg Response Time"
              value={systemData?.system_stats.average_response_time || 0}
              suffix="ms"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Top Blocked Users */}
      {systemData?.system_stats.top_blocked_users && (
        <Card title="Top Blocked Users" style={{ marginTop: 16 }}>
          <Table
            dataSource={systemData.system_stats.top_blocked_users}
            columns={[
              {
                title: 'User ID',
                dataIndex: 'user_id',
                key: 'user_id',
              },
              {
                title: 'Blocked Count',
                dataIndex: 'blocked_count',
                key: 'blocked_count',
                render: (count: number) => (
                  <Tag color="red">{count}</Tag>
                ),
              },
              {
                title: 'Last Blocked',
                dataIndex: 'last_blocked',
                key: 'last_blocked',
                render: (date: string) => new Date(date).toLocaleString(),
              },
            ]}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* Rate Limit Alerts */}
      <Card 
        title={`Rate Limit Alerts (${alertsData?.total_alerts || 0})`} 
        style={{ marginTop: 16 }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button 
            type={alertFilters.resolved === false ? 'primary' : 'default'}
            onClick={() => setAlertFilters({ ...alertFilters, resolved: false })}
          >
            Pending Only
          </Button>
          <Button 
            type={alertFilters.resolved === true ? 'primary' : 'default'}
            onClick={() => setAlertFilters({ ...alertFilters, resolved: true })}
          >
            Resolved Only
          </Button>
          <Button 
            type={alertFilters.resolved === undefined ? 'primary' : 'default'}
            onClick={() => setAlertFilters({ ...alertFilters, resolved: undefined })}
          >
            All Alerts
          </Button>
        </Space>

        <Table
          columns={alertColumns}
          dataSource={alertsData?.alerts || []}
          loading={alertsLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
          }}
        />
      </Card>
    </div>
  );
};
```

### Admin Coupon Management Component
```typescript
// src/components/Admin/CouponManagement.tsx
import React, { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  DatePicker, 
  message, 
  Space, 
  Tag, 
  Row, 
  Col, 
  Statistic 
} from 'antd';
import { 
  useCreateCoupon, 
  useListCoupons, 
  useCouponStats, 
  useDeactivateCoupon 
} from '../../hooks/useAdmin';

export const CouponManagement: React.FC = () => {
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const { data: couponsData, isLoading } = useListCoupons();
  const { data: statsData } = useCouponStats();
  const createCoupon = useCreateCoupon();
  const deactivateCoupon = useDeactivateCoupon();

  const handleCreateCoupon = async (values: any) => {
    try {
      await createCoupon.mutateAsync(values);
      message.success('Coupon created successfully');
      setIsCreateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('Failed to create coupon');
    }
  };

  const handleDeactivateCoupon = async (couponId: number) => {
    try {
      await deactivateCoupon.mutateAsync(couponId);
      message.success('Coupon deactivated successfully');
    } catch (error) {
      message.error('Failed to deactivate coupon');
    }
  };

  const getStatusColor = (isActive: boolean, isExpired: boolean) => {
    if (!isActive) return 'red';
    if (isExpired) return 'orange';
    return 'green';
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Tag color="blue">{code}</Tag>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value_usd',
      key: 'value_usd',
      render: (value: number, record: any) => (
        <span>
          {record.coupon_type === 'percentage' ? `${value}%` : `$${value}`}
        </span>
      ),
    },
    {
      title: 'Scope',
      dataIndex: 'coupon_scope',
      key: 'coupon_scope',
      render: (scope: string) => (
        <Tag color={scope === 'global' ? 'green' : 'blue'}>
          {scope.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Uses',
      key: 'uses',
      render: (_, record: any) => (
        <span>
          {record.current_uses} / {record.max_uses || '∞'}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record: any) => {
        const isExpired = record.valid_until && new Date(record.valid_until) < new Date();
        return (
          <Tag color={getStatusColor(record.is_active, isExpired)}>
            {!record.is_active ? 'INACTIVE' : isExpired ? 'EXPIRED' : 'ACTIVE'}
          </Tag>
        );
      },
    },
    {
      title: 'Valid Until',
      dataIndex: 'valid_until',
      key: 'valid_until',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : 'No expiry',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: any) => (
        <Space>
          <Button 
            size="small" 
            type="primary"
            onClick={() => {
              // Navigate to coupon details
              window.open(`/admin/coupons/${record.id}`, '_blank');
            }}
          >
            View
          </Button>
          {record.is_active && (
            <Button 
              size="small" 
              danger
              onClick={() => handleDeactivateCoupon(record.id)}
            >
              Deactivate
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="coupon-management">
      <div className="coupon-header">
        <h1>Coupon Management</h1>
        <Button 
          type="primary" 
          onClick={() => setIsCreateModalVisible(true)}
        >
          Create Coupon
        </Button>
      </div>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Coupons"
              value={statsData?.total_coupons || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Coupons"
              value={statsData?.active_coupons || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Value Distributed"
              value={statsData?.total_value_distributed || 0}
              prefix="$"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Average Redemption Rate"
              value={statsData?.average_redemption_rate || 0}
              suffix="%"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Coupons Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={couponsData?.coupons || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
          }}
        />
      </Card>

      {/* Create Coupon Modal */}
      <Modal
        title="Create New Coupon"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateCoupon}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Coupon Code"
                name="code"
                rules={[{ required: true, message: 'Please enter coupon code' }]}
              >
                <Input placeholder="e.g., WELCOME20" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Value"
                name="value_usd"
                rules={[{ required: true, message: 'Please enter value' }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                  placeholder="Enter value"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Coupon Type"
                name="coupon_type"
                rules={[{ required: true, message: 'Please select type' }]}
              >
                <Select placeholder="Select type">
                  <Select.Option value="percentage">Percentage</Select.Option>
                  <Select.Option value="fixed_amount">Fixed Amount</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Scope"
                name="coupon_scope"
                rules={[{ required: true, message: 'Please select scope' }]}
              >
                <Select placeholder="Select scope">
                  <Select.Option value="global">Global</Select.Option>
                  <Select.Option value="user_specific">User Specific</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Max Uses"
                name="max_uses"
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="Leave empty for unlimited"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Valid Until"
                name="valid_until"
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  showTime
                  placeholder="Select expiry date"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Description"
            name="description"
          >
            <Input.TextArea
              rows={3}
              placeholder="Optional description"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createCoupon.isPending}>
                Create Coupon
              </Button>
              <Button onClick={() => setIsCreateModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
```

### Admin User Management Component
```typescript
// src/components/Admin/UserManagement.tsx
import React, { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  message, 
  Space, 
  Tag, 
  Row, 
  Col, 
  Statistic,
  Input,
  Select,
  Tabs
} from 'antd';
import { 
  useAllUsers, 
  useUserById 
} from '../../hooks/useAdmin';

export const UserManagement: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const { data: usersData, isLoading } = useAllUsers();
  const { data: userDetail, isLoading: detailLoading } = useUserById(selectedUserId || 0);

  const handleViewUser = (userId: number) => {
    setSelectedUserId(userId);
    setIsDetailModalVisible(true);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'developer': return 'blue';
      case 'user': return 'green';
      default: return 'default';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'green' : 'red';
  };

  // Filter users based on search and role
  const filteredUsers = usersData?.users?.filter(user => {
    const matchesSearch = !searchText || 
      user.username.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  }) || [];

  const userColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (username: string) => (
        <strong>{username}</strong>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      key: 'credits',
      render: (credits: number) => (
        <Tag color={credits > 0 ? 'green' : 'red'}>
          ${credits.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={getRoleColor(role)}>
          {role?.toUpperCase() || 'USER'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={getStatusColor(isActive)}>
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      ),
    },
    {
      title: 'Subscription',
      dataIndex: 'subscription_status',
      key: 'subscription_status',
      render: (status: string) => (
        <Tag color="blue">
          {status?.toUpperCase() || 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: any) => (
        <Button
          size="small"
          type="primary"
          onClick={() => handleViewUser(record.id)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const apiKeyColumns = [
    {
      title: 'Key Name',
      dataIndex: 'key_name',
      key: 'key_name',
    },
    {
      title: 'API Key',
      dataIndex: 'api_key',
      key: 'api_key',
      render: (key: string) => (
        <code style={{ fontSize: '12px' }}>
          {key.substring(0, 20)}...
        </code>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      ),
    },
    {
      title: 'Environment',
      dataIndex: 'environment_tag',
      key: 'environment_tag',
      render: (env: string) => (
        <Tag color="blue">{env?.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Last Used',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'Never',
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Users"
                  value={usersData?.total_users || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Active Users"
                  value={usersData?.statistics?.active_users || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Credits"
                  value={usersData?.statistics?.total_credits || 0}
                  prefix="$"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Admin Users"
                  value={usersData?.statistics?.admin_users || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="User Statistics">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic
                  title="Developer Users"
                  value={usersData?.statistics?.developer_users || 0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Regular Users"
                  value={usersData?.statistics?.regular_users || 0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Average Credits"
                  value={usersData?.statistics?.average_credits || 0}
                  prefix="$"
                />
              </Col>
            </Row>
          </Card>
        </div>
      ),
    },
    {
      key: 'users',
      label: `All Users (${filteredUsers.length})`,
      children: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Input
                placeholder="Search users..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                style={{ width: 150 }}
              >
                <Select.Option value="all">All Roles</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
                <Select.Option value="developer">Developer</Select.Option>
                <Select.Option value="user">User</Select.Option>
              </Select>
            </Space>
          </div>

          <Table
            columns={userColumns}
            dataSource={filteredUsers}
            loading={isLoading}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="user-management">
      <h1>User Management</h1>

      <Card>
        <Tabs 
          defaultActiveKey="overview"
          items={tabItems}
        />
      </Card>

      {/* User Detail Modal */}
      <Modal
        title={`User Details - ${userDetail?.user?.username}`}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {userDetail && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="User ID"
                    value={userDetail.user.id}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Credits"
                    value={userDetail.user.credits}
                    prefix="$"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Role"
                    value={userDetail.user.role?.toUpperCase() || 'USER'}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="API Keys" style={{ marginBottom: 16 }}>
              <Table
                columns={apiKeyColumns}
                dataSource={userDetail.api_keys}
                loading={detailLoading}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>

            {userDetail.recent_usage.length > 0 && (
              <Card title="Recent Usage" style={{ marginBottom: 16 }}>
                <Table
                  dataSource={userDetail.recent_usage}
                  loading={detailLoading}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Model', dataIndex: 'model', key: 'model' },
                    { title: 'Tokens', dataIndex: 'tokens_used', key: 'tokens_used' },
                    { title: 'Cost', dataIndex: 'cost', key: 'cost', render: (cost: number) => `$${cost.toFixed(4)}` },
                    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (date: string) => new Date(date).toLocaleString() },
                  ]}
                />
              </Card>
            )}

            {userDetail.recent_activity.length > 0 && (
              <Card title="Recent Activity">
                <Table
                  dataSource={userDetail.recent_activity}
                  loading={detailLoading}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Action', dataIndex: 'action', key: 'action' },
                    { title: 'Endpoint', dataIndex: 'endpoint', key: 'endpoint' },
                    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (date: string) => new Date(date).toLocaleString() },
                  ]}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
```

### Admin Role Management Component
```typescript
// src/components/Admin/RoleManagement.tsx
import React, { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Select, 
  Input, 
  message, 
  Space, 
  Tag, 
  Tabs 
} from 'antd';
import { 
  useUsersByRole, 
  useUpdateUserRole, 
  useRoleAuditLog,
  useRolePermissions 
} from '../../hooks/useAdmin';

export const RoleManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: userData, isLoading: usersLoading } = useUsersByRole('user', 100);
  const { data: developerData, isLoading: developersLoading } = useUsersByRole('developer', 100);
  const { data: adminData, isLoading: adminsLoading } = useUsersByRole('admin', 100);
  const { data: auditData, isLoading: auditLoading } = useRoleAuditLog({ limit: 50 });
  const updateUserRole = useUpdateUserRole();

  const handleUpdateRole = async (values: any) => {
    try {
      await updateUserRole.mutateAsync({
        user_id: selectedUser.user_id,
        new_role: values.new_role,
        reason: values.reason,
      });
      message.success('User role updated successfully');
      setIsUpdateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('Failed to update user role');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'developer': return 'blue';
      case 'user': return 'green';
      default: return 'default';
    }
  };

  const userColumns = [
    {
      title: 'User ID',
      dataIndex: 'user_id',
      key: 'user_id',
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={getRoleColor(role)}>
          {role.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: any) => (
        <Button
          size="small"
          type="primary"
          onClick={() => {
            setSelectedUser(record);
            setIsUpdateModalVisible(true);
          }}
        >
          Update Role
        </Button>
      ),
    },
  ];

  const auditColumns = [
    {
      title: 'User ID',
      dataIndex: 'user_id',
      key: 'user_id',
    },
    {
      title: 'Role Change',
      key: 'role_change',
      render: (_, record: any) => (
        <Space>
          <Tag color="red">{record.old_role.toUpperCase()}</Tag>
          <span>→</span>
          <Tag color="green">{record.new_role.toUpperCase()}</Tag>
        </Space>
      ),
    },
    {
      title: 'Changed By',
      dataIndex: 'changed_by',
      key: 'changed_by',
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || 'No reason provided',
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  const tabItems = [
    {
      key: 'users',
      label: `Users (${userData?.total || 0})`,
      children: (
        <Table
          columns={userColumns}
          dataSource={userData?.users || []}
          loading={usersLoading}
          rowKey="user_id"
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'developers',
      label: `Developers (${developerData?.total || 0})`,
      children: (
        <Table
          columns={userColumns}
          dataSource={developerData?.users || []}
          loading={developersLoading}
          rowKey="user_id"
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'admins',
      label: `Admins (${adminData?.total || 0})`,
      children: (
        <Table
          columns={userColumns}
          dataSource={adminData?.users || []}
          loading={adminsLoading}
          rowKey="user_id"
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'audit',
      label: 'Audit Log',
      children: (
        <Table
          columns={auditColumns}
          dataSource={auditData?.logs || []}
          loading={auditLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      ),
    },
  ];

  return (
    <div className="role-management">
      <h1>Role Management</h1>

      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      {/* Update Role Modal */}
      <Modal
        title={`Update Role for ${selectedUser?.username}`}
        open={isUpdateModalVisible}
        onCancel={() => setIsUpdateModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateRole}
        >
          <Form.Item
            label="New Role"
            name="new_role"
            rules={[{ required: true, message: 'Please select new role' }]}
          >
            <Select placeholder="Select new role">
              <Select.Option value="user">User</Select.Option>
              <Select.Option value="developer">Developer</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Reason"
            name="reason"
          >
            <Input.TextArea
              rows={3}
              placeholder="Optional reason for role change"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={updateUserRole.isPending}
              >
                Update Role
              </Button>
              <Button onClick={() => setIsUpdateModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
```

### Dashboard Component
```typescript
// src/components/Dashboard/Dashboard.tsx
import React from 'react';
import { Row, Col, Card, Statistic, Spin } from 'antd';
import { useGatewaySummary, useTrendingModels } from '../../hooks/useDashboard';

export const Dashboard: React.FC = () => {
  const { data: gatewaySummary, isLoading: summaryLoading } = useGatewaySummary();
  const { data: trendingData, isLoading: trendingLoading } = useTrendingModels();

  if (summaryLoading) {
    return <Spin size="large" />;
  }

  return (
    <div className="dashboard">
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Gateways"
              value={gatewaySummary?.total_gateways}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Gateways"
              value={gatewaySummary?.active_gateways}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Models"
              value={gatewaySummary?.total_models}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Providers"
              value={gatewaySummary?.total_providers}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Trending Models" loading={trendingLoading}>
            {trendingData?.trending_models.map((model) => (
              <div key={model.model_id} className="trending-model">
                <span>{model.model_id}</span>
                <span>{model.requests} requests</span>
                <span>+{model.growth}%</span>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

### Models Management Component
```typescript
// src/components/Models/ModelsManagement.tsx
import React, { useState } from 'react';
import { Table, Button, Input, Select, Space, Tag, message } from 'antd';
import { useModels, useModelComparison } from '../../hooks/useModels';

export const ModelsManagement: React.FC = () => {
  const [filters, setFilters] = useState({
    gateway: undefined,
    provider: undefined,
    search: undefined,
  });
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const { data: modelsData, isLoading, refetch } = useModels(filters);
  const compareModels = useModelComparison();

  const handleCompare = async () => {
    if (selectedModels.length < 2) {
      message.warning('Please select at least 2 models to compare');
      return;
    }

    try {
      const result = await compareModels.mutateAsync({
        model_ids: selectedModels,
        criteria: ['pricing', 'context_length', 'performance']
      });
      console.log('Comparison result:', result);
      message.success('Models compared successfully');
    } catch (error) {
      message.error('Failed to compare models');
    }
  };

  const columns = [
    {
      title: 'Model ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Button type="link">{id}</Button>,
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => <Tag color="blue">{provider}</Tag>,
    },
    {
      title: 'Gateway',
      dataIndex: 'gateway',
      key: 'gateway',
      render: (gateway: string) => <Tag color="green">{gateway}</Tag>,
    },
    {
      title: 'Context Length',
      dataIndex: 'context_length',
      key: 'context_length',
      render: (length: number) => length?.toLocaleString() || 'N/A',
    },
    {
      title: 'Pricing',
      key: 'pricing',
      render: (_, record: Model) => {
        const pricing = record.pricing;
        if (!pricing) return 'N/A';
        return (
          <div>
            <div>Prompt: ${pricing.prompt}</div>
            <div>Completion: ${pricing.completion}</div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="models-management">
      <div className="models-filters">
        <Space>
          <Input
            placeholder="Search models..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            placeholder="Select Gateway"
            value={filters.gateway}
            onChange={(value) => setFilters({ ...filters, gateway: value })}
            style={{ width: 150 }}
          >
            <Select.Option value="openrouter">OpenRouter</Select.Option>
            <Select.Option value="portkey">Portkey</Select.Option>
            <Select.Option value="featherless">Featherless</Select.Option>
          </Select>
          <Button onClick={() => refetch()}>Refresh</Button>
          {selectedModels.length > 0 && (
            <Button type="primary" onClick={handleCompare}>
              Compare ({selectedModels.length})
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={modelsData?.data || []}
        loading={isLoading}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedModels,
          onChange: setSelectedModels,
        }}
        pagination={{
          total: modelsData?.total_count,
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
      />
    </div>
  );
};
```

### Modelz Integration Component
```typescript
// src/components/Modelz/ModelzIntegration.tsx
import React, { useState } from 'react';
import { Card, Radio, Button, Table, Tag, Space, Statistic, Row, Col } from 'antd';
import { useModelzModels, useModelzCacheStatus } from '../../hooks/useModelz';
import { useModelzCacheManagement } from '../../hooks/useCacheManagement';

export const ModelzIntegration: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'graduated' | 'non-graduated'>('all');
  
  const { data: modelzData, isLoading, refetch } = useModelzModels(
    filter === 'all' ? undefined : filter === 'graduated'
  );
  
  const { data: cacheStatus } = useModelzCacheStatus();
  const { refreshModelzCache, clearModelzCache } = useModelzCacheManagement();

  const handleRefreshCache = async () => {
    try {
      await refreshModelzCache.mutateAsync();
      refetch();
    } catch (error) {
      console.error('Failed to refresh cache:', error);
    }
  };

  const handleClearCache = async () => {
    try {
      await clearModelzCache.mutateAsync();
      refetch();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const columns = [
    {
      title: 'Model ID',
      dataIndex: 'model_id',
      key: 'model_id',
    },
    {
      title: 'Graduated',
      dataIndex: 'is_graduated',
      key: 'is_graduated',
      render: (isGraduated: boolean) => (
        <Tag color={isGraduated ? 'green' : 'orange'}>
          {isGraduated ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Market Cap',
      key: 'market_cap',
      render: (_, record: ModelzModel) => {
        const marketCap = record.token_data.MarketCap;
        return marketCap ? `$${marketCap.toLocaleString()}` : 'N/A';
      },
    },
    {
      title: 'Holders',
      key: 'holders',
      render: (_, record: ModelzModel) => {
        const holders = record.token_data.Holders;
        return holders ? holders.toLocaleString() : 'N/A';
      },
    },
    {
      title: 'Volume 24h',
      key: 'volume',
      render: (_, record: ModelzModel) => {
        const volume = record.token_data.volume24h;
        return volume ? `$${volume.toLocaleString()}` : 'N/A';
      },
    },
  ];

  return (
    <div className="modelz-integration">
      <div className="modelz-header">
        <h1>Modelz Integration</h1>
        <p>Manage models that exist on Modelz platform</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Models"
              value={modelzData?.total_count || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Graduated"
              value={modelzData?.models?.filter(m => m.is_graduated).length || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Non-Graduated"
              value={modelzData?.models?.filter(m => !m.is_graduated).length || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Cache Status"
              value={cacheStatus?.status || 'Unknown'}
              valueStyle={{ 
                color: cacheStatus?.is_valid ? '#52c41a' : '#ff4d4f' 
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="modelz-controls">
          <Space>
            <Radio.Group
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <Radio.Button value="all">All Models</Radio.Button>
              <Radio.Button value="graduated">Graduated</Radio.Button>
              <Radio.Button value="non-graduated">Non-Graduated</Radio.Button>
            </Radio.Group>
            <Button onClick={() => refetch()}>Refresh Data</Button>
            <Button onClick={handleRefreshCache}>Refresh Cache</Button>
            <Button danger onClick={handleClearCache}>Clear Cache</Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={modelzData?.models || []}
          loading={isLoading}
          rowKey="model_id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
          }}
        />
      </Card>
    </div>
  );
};
```

## 🚀 Environment Configuration

### Development Environment
```env
# .env.development
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_APP_NAME=Gatewayz Admin (Dev)
REACT_APP_ADMIN_EMAIL=admin@localhost
```

### Production Environment
```env
# .env.production
REACT_APP_API_BASE_URL=https://api.gatewayz.com
REACT_APP_WS_URL=wss://api.gatewayz.com/ws
REACT_APP_APP_NAME=Gatewayz Admin
REACT_APP_ADMIN_EMAIL=admin@gatewayz.com
```

## 📱 Error Handling & Loading States

### Global Error Boundary
```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Loading States Component
```typescript
// src/components/LoadingStates.tsx
import React from 'react';
import { Spin, Skeleton } from 'antd';

export const LoadingSpinner: React.FC = () => (
  <div className="loading-container">
    <Spin size="large" />
  </div>
);

export const TableSkeleton: React.FC = () => (
  <div className="table-skeleton">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} active paragraph={{ rows: 1 }} />
    ))}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <Card>
    <Skeleton active paragraph={{ rows: 3 }} />
  </Card>
);
```

This comprehensive API integration guide provides everything needed to build a fully functional admin frontend for your Gatewayz API Gateway. All endpoints are documented with TypeScript interfaces, React Query hooks, and practical component examples.
