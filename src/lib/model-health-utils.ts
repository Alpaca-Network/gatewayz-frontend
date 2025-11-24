/**
 * Model Health Utility Functions
 * Helper functions for calculating and formatting model health metrics
 */

import { ModelHealth, DerivedHealthMetrics } from "@/types/model-health";

/**
 * Calculate success rate as a percentage
 */
export function calculateSuccessRate(model: ModelHealth): number {
  if (model.call_count === 0) return 0;
  return (model.success_count / model.call_count) * 100;
}

/**
 * Calculate error rate as a percentage
 */
export function calculateErrorRate(model: ModelHealth): number {
  if (model.call_count === 0) return 0;
  return (model.error_count / model.call_count) * 100;
}

/**
 * Get health status based on success rate
 */
export function getHealthStatus(successRate: number): "healthy" | "degraded" | "unhealthy" {
  if (successRate >= 95) return "healthy";
  if (successRate >= 80) return "degraded";
  return "unhealthy";
}

/**
 * Get status color class based on success rate
 */
export function getStatusColor(successRate: number): string {
  if (successRate >= 95) return "text-green-600";
  if (successRate >= 80) return "text-yellow-600";
  return "text-red-600";
}

/**
 * Get background color class based on success rate
 */
export function getStatusBgColor(successRate: number): string {
  if (successRate >= 95) return "bg-green-100 text-green-800";
  if (successRate >= 80) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

/**
 * Classify response time
 */
export function getResponseTimeClass(ms: number): "fast" | "moderate" | "slow" {
  if (ms < 1000) return "fast";
  if (ms < 3000) return "moderate";
  return "slow";
}

/**
 * Get response time color class
 */
export function getResponseTimeColor(ms: number): string {
  const classification = getResponseTimeClass(ms);
  switch (classification) {
    case "fast":
      return "text-green-600";
    case "moderate":
      return "text-yellow-600";
    case "slow":
      return "text-red-600";
  }
}

/**
 * Format timestamp to relative time (e.g., "5m ago", "2h ago")
 */
export function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Calculate all derived metrics for a model
 */
export function getDerivedMetrics(model: ModelHealth): DerivedHealthMetrics {
  const successRate = calculateSuccessRate(model);
  const errorRate = calculateErrorRate(model);
  const healthStatus = getHealthStatus(successRate);
  const responseTimeCategory = getResponseTimeClass(model.average_response_time_ms);

  return {
    successRate,
    errorRate,
    healthStatus,
    responseTimeCategory,
  };
}

/**
 * Get status icon emoji
 */
export function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    success: "✅",
    error: "❌",
    timeout: "⏱️",
    rate_limited: "🚫",
    network_error: "📡",
  };
  return icons[status] || "○";
}

/**
 * Format response time with appropriate unit
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get health badge variant
 */
export function getHealthBadgeVariant(successRate: number): "default" | "secondary" | "destructive" {
  if (successRate >= 95) return "default";
  if (successRate >= 80) return "secondary";
  return "destructive";
}
