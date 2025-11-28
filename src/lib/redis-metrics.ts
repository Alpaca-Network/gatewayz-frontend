/**
 * Redis Metrics Service
 *
 * Centralized service for recording and retrieving real-time monitoring metrics:
 * - Request counts
 * - Latencies (TTFT, total response time)
 * - Health scores
 * - Provider/gateway performance
 *
 * All metrics use 1-hour TTL with hourly time bucketing for automatic expiration.
 */

import { getRedisClient, isRedisAvailable } from './redis-client';
import type Redis from 'ioredis';

// ============================================================================
// Types
// ============================================================================

export interface MetricRecordOptions {
  model: string;
  gateway?: string;
  provider?: string;
  session_id?: string;
}

export interface LatencyMetricOptions extends MetricRecordOptions {
  ttft_ms?: number;
  total_time_ms?: number;
  network_time_ms?: number;
  backend_time_ms?: number;
}

export interface StatusMetricOptions extends MetricRecordOptions {
  success: boolean;
  error_type?: 'timeout' | 'rate_limit' | 'network' | 'other';
  error_message?: string;
}

export interface GatewayMetricOptions {
  gateway: string;
  model_count?: number;
  response_time_ms?: number;
  error_type?: 'timeout' | 'error';
}

export interface ModelMetrics {
  model: string;
  time_bucket: string;
  requests: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  avg_ttft_ms: number | null;
  avg_total_time_ms: number | null;
  error_breakdown: {
    timeout: number;
    rate_limit: number;
    network: number;
    other: number;
  };
}

export interface ProviderMetrics {
  provider: string;
  time_bucket: string;
  total_requests: number;
  total_models: number;
  avg_success_rate: number;
  avg_ttft_ms: number | null;
  top_models: Array<{ model_id: string; requests: number }>;
  error_distribution: {
    timeout: number;
    rate_limit: number;
    network: number;
    other: number;
  };
}

export interface HealthScore {
  model_id: string;
  health_score: number;
  requests: number;
  avg_ttft_ms: number | null;
}

export interface TrendDataPoint {
  time_bucket: string;
  value: number;
}

// ============================================================================
// Redis Metrics Service
// ============================================================================

export class RedisMetricsService {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Get the Redis client, throwing if not available
   * Should only be called after checking isRedisAvailable()
   */
  private getRedis(): Redis {
    if (!this.redis) {
      throw new Error('Redis client not available');
    }
    return this.redis;
  }

  // ==========================================================================
  // Time Bucketing Utilities
  // ==========================================================================

  /**
   * Get current hourly time bucket (e.g., "2025-11-27-14")
   */
  getTimeBucket(date?: Date): string {
    const now = date || new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
  }

  /**
   * Get last N hourly time buckets
   */
  getLastNHourBuckets(hours: number): string[] {
    const buckets: string[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const date = new Date(now.getTime() - i * 60 * 60 * 1000);
      buckets.push(this.getTimeBucket(date));
    }

    return buckets;
  }

  /**
   * Build Redis key from parts
   */
  private buildKey(...parts: string[]): string {
    return parts.join(':');
  }

  // ==========================================================================
  // Recording Methods
  // ==========================================================================

  /**
   * Record a request start
   */
  async recordRequestStart(options: MetricRecordOptions): Promise<void> {
    try {
      if (!(await isRedisAvailable())) {
        return;
      }

      const bucket = this.getTimeBucket();
      const pipeline = this.getRedis().pipeline();

      // Increment request counters
      const modelKey = this.buildKey('metrics', 'model', options.model, 'requests', bucket);
      pipeline.incr(modelKey);
      pipeline.expire(modelKey, 3600);

      if (options.gateway) {
        const gatewayKey = this.buildKey('metrics', 'gateway', options.gateway, 'requests', bucket);
        pipeline.incr(gatewayKey);
        pipeline.expire(gatewayKey, 3600);
      }

      if (options.provider) {
        const providerKey = this.buildKey('metrics', 'provider', options.provider, 'requests', bucket);
        pipeline.incr(providerKey);
        pipeline.expire(providerKey, 3600);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('[RedisMetrics] Failed to record request start:', error);
    }
  }

  /**
   * Record latency metrics
   */
  async recordLatency(options: LatencyMetricOptions): Promise<void> {
    try {
      if (!(await isRedisAvailable())) {
        return;
      }

      const bucket = this.getTimeBucket();
      const pipeline = this.getRedis().pipeline();

      const latencyKey = this.buildKey('metrics', 'model', options.model, 'latency', bucket);

      // Update latency sums and counts
      if (options.ttft_ms !== undefined) {
        pipeline.hincrby(latencyKey, 'ttft_sum', Math.round(options.ttft_ms));
        pipeline.hincrby(latencyKey, 'ttft_count', 1);

        // Store in time-series for trends (6-hour retention)
        const seriesKey = this.buildKey('metrics', 'model', options.model, 'ttft_series');
        pipeline.zadd(seriesKey, Date.now(), options.ttft_ms.toString());
        pipeline.expire(seriesKey, 21600); // 6 hours
      }

      if (options.total_time_ms !== undefined) {
        pipeline.hincrby(latencyKey, 'total_sum', Math.round(options.total_time_ms));
        pipeline.hincrby(latencyKey, 'total_count', 1);
      }

      if (options.network_time_ms !== undefined) {
        pipeline.hincrby(latencyKey, 'network_sum', Math.round(options.network_time_ms));
      }

      if (options.backend_time_ms !== undefined) {
        pipeline.hincrby(latencyKey, 'backend_sum', Math.round(options.backend_time_ms));
      }

      pipeline.expire(latencyKey, 3600);

      await pipeline.exec();
    } catch (error) {
      console.error('[RedisMetrics] Failed to record latency:', error);
    }
  }

  /**
   * Record success/error status
   */
  async recordStatus(options: StatusMetricOptions): Promise<void> {
    try {
      if (!(await isRedisAvailable())) {
        return;
      }

      const bucket = this.getTimeBucket();
      const pipeline = this.getRedis().pipeline();

      const statusKey = this.buildKey('metrics', 'model', options.model, 'status', bucket);

      if (options.success) {
        pipeline.hincrby(statusKey, 'success', 1);
      } else {
        const errorField = options.error_type
          ? `error_${options.error_type}`
          : 'error_other';
        pipeline.hincrby(statusKey, errorField, 1);
      }

      pipeline.expire(statusKey, 3600);

      await pipeline.exec();

      // Update health score in sorted set
      await this.updateHealthScore(options.model, bucket);
    } catch (error) {
      console.error('[RedisMetrics] Failed to record status:', error);
    }
  }

  /**
   * Update health score in leaderboard
   */
  async updateHealthScore(model: string, bucket?: string): Promise<void> {
    try {
      const timeBucket = bucket || this.getTimeBucket();
      const statusKey = this.buildKey('metrics', 'model', model, 'status', timeBucket);

      // Get success and error counts
      const stats = await this.getRedis().hgetall(statusKey);
      const success = parseInt(stats.success || '0');
      const errorTimeout = parseInt(stats.error_timeout || '0');
      const errorRateLimit = parseInt(stats.error_rate_limit || '0');
      const errorNetwork = parseInt(stats.error_network || '0');
      const errorOther = parseInt(stats.error_other || '0');

      const total = success + errorTimeout + errorRateLimit + errorNetwork + errorOther;

      if (total > 0) {
        const successRate = (success / total) * 100;

        const healthKey = this.buildKey('metrics', 'health', 'models', timeBucket);
        await this.getRedis().zadd(healthKey, successRate, model);
        await this.getRedis().expire(healthKey, 3600);
      }
    } catch (error) {
      console.error('[RedisMetrics] Failed to update health score:', error);
    }
  }

  /**
   * Record complete request (convenience method)
   */
  async recordRequestComplete(
    options: MetricRecordOptions & LatencyMetricOptions & { success: boolean; error_type?: string }
  ): Promise<void> {
    try {
      // Record all metrics in parallel
      await Promise.all([
        this.recordLatency(options),
        this.recordStatus({
          model: options.model,
          gateway: options.gateway,
          provider: options.provider,
          success: options.success,
          error_type: options.error_type as any,
        }),
      ]);
    } catch (error) {
      console.error('[RedisMetrics] Failed to record request complete:', error);
    }
  }

  /**
   * Record gateway fetch metrics
   */
  async recordGatewayFetch(
    type: 'start' | 'success' | 'error',
    options: GatewayMetricOptions
  ): Promise<void> {
    try {
      if (!(await isRedisAvailable())) {
        return;
      }

      const bucket = this.getTimeBucket();
      const pipeline = this.getRedis().pipeline();

      if (type === 'success') {
        const successKey = this.buildKey('metrics', 'gateway', options.gateway, 'success', bucket);
        pipeline.incr(successKey);
        pipeline.expire(successKey, 3600);

        if (options.response_time_ms !== undefined) {
          const latencyKey = this.buildKey('metrics', 'gateway', options.gateway, 'latency', bucket);
          pipeline.hincrby(latencyKey, 'sum', Math.round(options.response_time_ms));
          pipeline.hincrby(latencyKey, 'count', 1);
          pipeline.expire(latencyKey, 3600);
        }
      } else if (type === 'error') {
        const errorKey = this.buildKey('metrics', 'gateway', options.gateway, 'errors', bucket);
        const errorField = options.error_type || 'error';
        pipeline.hincrby(errorKey, errorField, 1);
        pipeline.expire(errorKey, 3600);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('[RedisMetrics] Failed to record gateway fetch:', error);
    }
  }

  // ==========================================================================
  // Retrieval Methods
  // ==========================================================================

  /**
   * Get metrics for a specific model
   */
  async getModelMetrics(modelId: string, timeBucket?: string): Promise<ModelMetrics | null> {
    try {
      if (!(await isRedisAvailable())) {
        return null;
      }

      const bucket = timeBucket || this.getTimeBucket();

      // Get all metric keys for this model
      const requestKey = this.buildKey('metrics', 'model', modelId, 'requests', bucket);
      const latencyKey = this.buildKey('metrics', 'model', modelId, 'latency', bucket);
      const statusKey = this.buildKey('metrics', 'model', modelId, 'status', bucket);

      const [requests, latencyData, statusData] = await Promise.all([
        this.getRedis().get(requestKey),
        this.getRedis().hgetall(latencyKey),
        this.getRedis().hgetall(statusKey),
      ]);

      const requestCount = parseInt(requests || '0');
      const successCount = parseInt(statusData.success || '0');
      const errorTimeout = parseInt(statusData.error_timeout || '0');
      const errorRateLimit = parseInt(statusData.error_rate_limit || '0');
      const errorNetwork = parseInt(statusData.error_network || '0');
      const errorOther = parseInt(statusData.error_other || '0');

      const totalErrors = errorTimeout + errorRateLimit + errorNetwork + errorOther;
      const totalCalls = successCount + totalErrors;
      const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 0;

      const ttftSum = parseInt(latencyData.ttft_sum || '0');
      const ttftCount = parseInt(latencyData.ttft_count || '0');
      const totalSum = parseInt(latencyData.total_sum || '0');
      const totalCount = parseInt(latencyData.total_count || '0');

      return {
        model: modelId,
        time_bucket: bucket,
        requests: requestCount,
        success_count: successCount,
        error_count: totalErrors,
        success_rate: successRate,
        avg_ttft_ms: ttftCount > 0 ? ttftSum / ttftCount : null,
        avg_total_time_ms: totalCount > 0 ? totalSum / totalCount : null,
        error_breakdown: {
          timeout: errorTimeout,
          rate_limit: errorRateLimit,
          network: errorNetwork,
          other: errorOther,
        },
      };
    } catch (error) {
      console.error('[RedisMetrics] Failed to get model metrics:', error);
      return null;
    }
  }

  /**
   * Get health leaderboard (top or bottom models by health score)
   */
  async getHealthLeaderboard(
    limit: number = 10,
    order: 'asc' | 'desc' = 'desc',
    timeBucket?: string
  ): Promise<HealthScore[]> {
    try {
      if (!(await isRedisAvailable())) {
        return [];
      }

      const bucket = timeBucket || this.getTimeBucket();
      const healthKey = this.buildKey('metrics', 'health', 'models', bucket);

      // Get top or bottom models
      const results = order === 'desc'
        ? await this.getRedis().zrevrange(healthKey, 0, limit - 1, 'WITHSCORES')
        : await this.getRedis().zrange(healthKey, 0, limit - 1, 'WITHSCORES');

      const leaderboard: HealthScore[] = [];

      for (let i = 0; i < results.length; i += 2) {
        const modelId = results[i];
        const healthScore = parseFloat(results[i + 1]);

        // Get request count and TTFT for this model
        const metrics = await this.getModelMetrics(modelId, bucket);

        leaderboard.push({
          model_id: modelId,
          health_score: healthScore,
          requests: metrics?.requests || 0,
          avg_ttft_ms: metrics?.avg_ttft_ms || null,
        });
      }

      return leaderboard;
    } catch (error) {
      console.error('[RedisMetrics] Failed to get health leaderboard:', error);
      return [];
    }
  }

  /**
   * Get provider summary (aggregate metrics for all models of a provider)
   */
  async getProviderSummary(provider: string, timeBucket?: string): Promise<ProviderMetrics | null> {
    try {
      if (!(await isRedisAvailable())) {
        return null;
      }

      const bucket = timeBucket || this.getTimeBucket();

      // Get all model keys for this provider
      const pattern = this.buildKey('metrics', 'model', `${provider}/*`, 'requests', bucket);
      const keys = await this.getRedis().keys(pattern);

      if (keys.length === 0) {
        return null;
      }

      // Extract model IDs from keys
      const modelIds = keys.map((key) => {
        const parts = key.split(':');
        return parts[2]; // metrics:model:{model_id}:requests:{bucket}
      });

      // Get metrics for all models
      const modelMetrics = await Promise.all(
        modelIds.map((modelId) => this.getModelMetrics(modelId, bucket))
      );

      // Aggregate
      let totalRequests = 0;
      let totalSuccess = 0;
      let totalErrors = 0;
      let totalTtftSum = 0;
      let totalTtftCount = 0;
      const errorDist = { timeout: 0, rate_limit: 0, network: 0, other: 0 };
      const modelRequestMap: Array<{ model_id: string; requests: number }> = [];

      for (const metric of modelMetrics) {
        if (!metric) continue;

        totalRequests += metric.requests;
        totalSuccess += metric.success_count;
        totalErrors += metric.error_count;

        if (metric.avg_ttft_ms !== null) {
          totalTtftSum += metric.avg_ttft_ms * (metric.success_count || 1);
          totalTtftCount += metric.success_count || 1;
        }

        errorDist.timeout += metric.error_breakdown.timeout;
        errorDist.rate_limit += metric.error_breakdown.rate_limit;
        errorDist.network += metric.error_breakdown.network;
        errorDist.other += metric.error_breakdown.other;

        modelRequestMap.push({
          model_id: metric.model,
          requests: metric.requests,
        });
      }

      const avgSuccessRate =
        totalSuccess + totalErrors > 0
          ? (totalSuccess / (totalSuccess + totalErrors)) * 100
          : 0;

      const avgTtft = totalTtftCount > 0 ? totalTtftSum / totalTtftCount : null;

      // Sort models by requests
      const topModels = modelRequestMap
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 10);

      return {
        provider,
        time_bucket: bucket,
        total_requests: totalRequests,
        total_models: modelIds.length,
        avg_success_rate: avgSuccessRate,
        avg_ttft_ms: avgTtft,
        top_models: topModels,
        error_distribution: errorDist,
      };
    } catch (error) {
      console.error('[RedisMetrics] Failed to get provider summary:', error);
      return null;
    }
  }

  /**
   * Get trend data for a model (last N hours)
   */
  async getTrendData(
    modelId: string,
    metric: 'ttft' | 'requests' | 'success_rate',
    hours: number = 6
  ): Promise<TrendDataPoint[]> {
    try {
      if (!(await isRedisAvailable())) {
        return [];
      }

      const buckets = this.getLastNHourBuckets(hours);
      const dataPoints: TrendDataPoint[] = [];

      if (metric === 'ttft') {
        // Get TTFT from time-series data
        const seriesKey = this.buildKey('metrics', 'model', modelId, 'ttft_series');

        for (const bucket of buckets) {
          const bucketDate = this.parseBucket(bucket);
          const startTime = bucketDate.getTime();
          const endTime = startTime + 60 * 60 * 1000; // 1 hour

          const values = await this.getRedis().zrangebyscore(seriesKey, startTime, endTime);

          if (values.length > 0) {
            const avg = values.reduce((sum, v) => sum + parseFloat(v), 0) / values.length;
            dataPoints.push({ time_bucket: bucket, value: avg });
          } else {
            dataPoints.push({ time_bucket: bucket, value: 0 });
          }
        }
      } else {
        // Get from hourly buckets
        for (const bucket of buckets) {
          const metrics = await this.getModelMetrics(modelId, bucket);

          let value = 0;
          if (metrics) {
            if (metric === 'requests') {
              value = metrics.requests;
            } else if (metric === 'success_rate') {
              value = metrics.success_rate;
            }
          }

          dataPoints.push({ time_bucket: bucket, value });
        }
      }

      return dataPoints.reverse(); // Oldest to newest
    } catch (error) {
      console.error('[RedisMetrics] Failed to get trend data:', error);
      return [];
    }
  }

  /**
   * Parse time bucket string to Date
   */
  private parseBucket(bucket: string): Date {
    const [year, month, day, hour] = bucket.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour));
  }
}

// Singleton instance
export const metricsService = new RedisMetricsService();
