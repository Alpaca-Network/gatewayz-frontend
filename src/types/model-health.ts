/**
 * Model Health Types
 * Type definitions for the model health monitoring system
 */

export type ModelStatus = "success" | "error" | "timeout" | "rate_limited" | "network_error";

export interface ModelHealth {
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

export interface ModelHealthStats {
  total_models: number;
  total_calls: number;
  total_success: number;
  total_errors: number;
  success_rate: number;
  average_response_time: number;
  providers: number;
}

export interface ModelHealthListResponse {
  models: ModelHealth[];
  total: number;
  page: number;
  page_size: number;
}

export interface UnhealthyModelsResponse {
  models: Array<ModelHealth & { error_rate: number }>;
  threshold: number;
}

export interface ProviderSummary {
  provider: string;
  model_count: number;
  total_calls: number;
  success_rate: number;
  average_response_time: number;
}

export interface ProviderListResponse {
  providers: string[];
}

/**
 * Helper type for calculating derived health metrics
 */
export interface DerivedHealthMetrics {
  successRate: number;
  errorRate: number;
  healthStatus: "healthy" | "degraded" | "unhealthy";
  responseTimeCategory: "fast" | "moderate" | "slow";
}
