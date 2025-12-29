/**
 * Performance Profiler for Chat Flow
 * Tracks timing metrics at each stage of the request lifecycle
 */

export interface PerformanceMetrics {
  requestId: string;
  stage: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface RequestTiming {
  requestId: string;
  startTime: number;
  stages: Map<string, number>;
  metadata: Record<string, any>;
}

class PerformanceProfiler {
  private timings: Map<string, RequestTiming> = new Map();
  
  // Use performance.now() if available (browser/Node.js 16.5+), otherwise Date.now()
  private getNow(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  /**
   * Start tracking a request
   */
  startRequest(requestId: string, metadata?: Record<string, any>): void {
    const timing: RequestTiming = {
      requestId,
      startTime: this.getNow(),
      stages: new Map(),
      metadata: metadata || {},
    };
    this.timings.set(requestId, timing);
    this.markStage(requestId, 'request_start', metadata);
  }

  /**
   * Mark a stage in the request lifecycle
   */
  markStage(
    requestId: string,
    stageName: string,
    metadata?: Record<string, any>
  ): void {
    const timing = this.timings.get(requestId);
    if (!timing) {
      console.warn(`[Profiler] No timing found for request ${requestId}`);
      return;
    }

    const now = this.getNow();
    const previousStage = Array.from(timing.stages.keys()).pop();
    const previousTime = previousStage
      ? timing.stages.get(previousStage) || timing.startTime
      : timing.startTime;
    const duration = now - previousTime;

    timing.stages.set(stageName, now);
    if (metadata) {
      Object.assign(timing.metadata, metadata);
    }

    // Log stage timing
    console.log(
      `[Profiler] ${requestId} | Stage: ${stageName} | Duration: ${duration.toFixed(2)}ms | Total: ${(now - timing.startTime).toFixed(2)}ms`
    );
  }

  /**
   * End tracking and get final metrics
   */
  endRequest(requestId: string): PerformanceMetrics[] {
    const timing = this.timings.get(requestId);
    if (!timing) {
      console.warn(`[Profiler] No timing found for request ${requestId}`);
      return [];
    }

    const now = this.getNow();
    const totalDuration = now - timing.startTime;
    const metrics: PerformanceMetrics[] = [];

    // Convert stages to metrics
    let previousTime = timing.startTime;
    for (const [stageName, stageTime] of timing.stages.entries()) {
      const duration = stageTime - previousTime;
      metrics.push({
        requestId,
        stage: stageName,
        timestamp: stageTime,
        duration,
        metadata: timing.metadata,
      });
      previousTime = stageTime;
    }

    // Add total duration
    metrics.push({
      requestId,
      stage: 'request_complete',
      timestamp: now,
      duration: totalDuration,
      metadata: {
        ...timing.metadata,
        totalDuration,
        stageCount: timing.stages.size,
      },
    });

    // Log summary
    console.log(
      `[Profiler] ${requestId} | COMPLETE | Total Duration: ${totalDuration.toFixed(2)}ms | Stages: ${timing.stages.size}`
    );
    console.log(
      `[Profiler] ${requestId} | Stage Breakdown:`,
      Array.from(timing.stages.entries())
        .map(([name, time]) => {
          const prev = Array.from(timing.stages.entries())
            .filter(([n, t]) => t < time)
            .sort((a, b) => b[1] - a[1])[0];
          const duration = prev ? time - prev[1] : time - timing.startTime;
          return `${name}: ${duration.toFixed(2)}ms`;
        })
        .join(' | ')
    );

    this.timings.delete(requestId);
    return metrics;
  }

  /**
   * Get current timing for a request
   */
  getTiming(requestId: string): RequestTiming | undefined {
    return this.timings.get(requestId);
  }
}

// Singleton instance
export const profiler = new PerformanceProfiler();

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to measure async function execution time
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  requestId?: string
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`[Profiler] ${label} took ${duration.toFixed(2)}ms`);
    if (requestId) {
      profiler.markStage(requestId, label, { duration });
    }
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Profiler] ${label} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

