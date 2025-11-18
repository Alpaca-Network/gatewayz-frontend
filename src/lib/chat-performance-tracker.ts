/**
 * Chat Performance Tracker
 * Measures and tracks performance metrics for chat interactions
 */

export interface PerformanceMetrics {
  // Unique identifier for this measurement
  messageId: string;

  // Model information
  model: string;
  gateway?: string;

  // Timing metrics (all in milliseconds)
  userClickTime: number;           // When user clicked send
  requestStartTime: number;         // When API request started
  firstTokenTime?: number;          // When first token arrived (TTFT)
  streamCompleteTime?: number;      // When streaming completed
  totalResponseTime?: number;       // Total time from click to completion

  // Calculated metrics
  timeToFirstToken?: number;        // TTFT = firstTokenTime - requestStartTime
  networkLatency?: number;          // Network round-trip time
  backendProcessingTime?: number;   // Backend processing before first token
  streamingDuration?: number;       // Time spent streaming
  tokensPerSecond?: number;         // Streaming throughput

  // Content metrics
  messageLength: number;            // User message character count
  responseLength?: number;          // Assistant response character count
  hasImage: boolean;
  hasVideo: boolean;
  hasAudio: boolean;

  // Error tracking
  hadError: boolean;
  errorType?: string;
  retryCount: number;

  // Session info
  sessionId?: string;
  isFirstMessage: boolean;
}

export class ChatPerformanceTracker {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private currentMessageId: string | null = null;

  /**
   * Start tracking a new message
   */
  startTracking(params: {
    messageId: string;
    model: string;
    gateway?: string;
    messageLength: number;
    hasImage: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
    sessionId?: string;
    isFirstMessage: boolean;
  }): void {
    this.currentMessageId = params.messageId;

    const now = performance.now();

    this.metrics.set(params.messageId, {
      messageId: params.messageId,
      model: params.model,
      gateway: params.gateway,
      userClickTime: now,
      requestStartTime: now,
      messageLength: params.messageLength,
      hasImage: params.hasImage,
      hasVideo: params.hasVideo,
      hasAudio: params.hasAudio,
      sessionId: params.sessionId,
      isFirstMessage: params.isFirstMessage,
      hadError: false,
      retryCount: 0,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [Performance] Started tracking:', params.messageId);
    }
  }

  /**
   * Mark when API request actually started (after any pre-processing)
   */
  markRequestStart(messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    metric.requestStartTime = performance.now();
  }

  /**
   * Mark when first token arrived (most important metric!)
   */
  markFirstToken(messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    if (!metric.firstTokenTime) {
      const now = performance.now();
      metric.firstTokenTime = now;
      metric.timeToFirstToken = now - metric.requestStartTime;

      if (process.env.NODE_ENV === 'development') {
        console.log(`⚡ [Performance] TTFT: ${metric.timeToFirstToken.toFixed(0)}ms for ${metric.model}`);
      }
    }
  }

  /**
   * Mark when streaming completed
   */
  markStreamComplete(responseLength: number, messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    const now = performance.now();
    metric.streamCompleteTime = now;
    metric.responseLength = responseLength;
    metric.totalResponseTime = now - metric.userClickTime;

    if (metric.firstTokenTime) {
      metric.streamingDuration = now - metric.firstTokenTime;

      // Calculate tokens per second (rough estimate: 1 token ≈ 4 characters)
      const estimatedTokens = responseLength / 4;
      const streamingSeconds = metric.streamingDuration / 1000;
      metric.tokensPerSecond = estimatedTokens / streamingSeconds;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [Performance] Complete in ${metric.totalResponseTime?.toFixed(0)}ms`);
      this.logSummary(id);
    }
  }

  /**
   * Mark network latency (from API route timing headers)
   */
  markNetworkLatency(latencyMs: number, messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    metric.networkLatency = latencyMs;
  }

  /**
   * Mark backend processing time (from API route timing headers)
   */
  markBackendProcessing(processingMs: number, messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    metric.backendProcessingTime = processingMs;
  }

  /**
   * Record an error occurred
   */
  recordError(errorType: string, messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    metric.hadError = true;
    metric.errorType = errorType;

    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [Performance] Error:', errorType);
    }
  }

  /**
   * Increment retry count
   */
  incrementRetry(messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    metric.retryCount++;
  }

  /**
   * Get metrics for a specific message
   */
  getMetrics(messageId: string): PerformanceMetrics | undefined {
    return this.metrics.get(messageId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get average metrics across all messages
   */
  getAverageMetrics(): {
    avgTTFT: number;
    avgTotalTime: number;
    avgTokensPerSecond: number;
    totalMessages: number;
    errorRate: number;
  } {
    const allMetrics = this.getAllMetrics();

    if (allMetrics.length === 0) {
      return {
        avgTTFT: 0,
        avgTotalTime: 0,
        avgTokensPerSecond: 0,
        totalMessages: 0,
        errorRate: 0,
      };
    }

    const sum = allMetrics.reduce(
      (acc, m) => ({
        ttft: acc.ttft + (m.timeToFirstToken || 0),
        total: acc.total + (m.totalResponseTime || 0),
        tps: acc.tps + (m.tokensPerSecond || 0),
        errors: acc.errors + (m.hadError ? 1 : 0),
      }),
      { ttft: 0, total: 0, tps: 0, errors: 0 }
    );

    return {
      avgTTFT: sum.ttft / allMetrics.length,
      avgTotalTime: sum.total / allMetrics.length,
      avgTokensPerSecond: sum.tps / allMetrics.length,
      totalMessages: allMetrics.length,
      errorRate: sum.errors / allMetrics.length,
    };
  }

  /**
   * Get metrics grouped by model
   */
  getMetricsByModel(): Record<string, {
    avgTTFT: number;
    avgTotalTime: number;
    count: number;
  }> {
    const allMetrics = this.getAllMetrics();
    const byModel: Record<string, PerformanceMetrics[]> = {};

    // Group by model
    allMetrics.forEach(m => {
      if (!byModel[m.model]) {
        byModel[m.model] = [];
      }
      byModel[m.model].push(m);
    });

    // Calculate averages for each model
    const result: Record<string, { avgTTFT: number; avgTotalTime: number; count: number }> = {};

    Object.entries(byModel).forEach(([model, metrics]) => {
      const ttftSum = metrics.reduce((sum, m) => sum + (m.timeToFirstToken || 0), 0);
      const totalSum = metrics.reduce((sum, m) => sum + (m.totalResponseTime || 0), 0);

      result[model] = {
        avgTTFT: ttftSum / metrics.length,
        avgTotalTime: totalSum / metrics.length,
        count: metrics.length,
      };
    });

    return result;
  }

  /**
   * Log a detailed summary of metrics
   */
  logSummary(messageId?: string): void {
    const id = messageId || this.currentMessageId;
    if (!id) return;

    const metric = this.metrics.get(id);
    if (!metric) return;

    console.group('📊 Performance Summary');
    console.log('Model:', metric.model);
    console.log('Gateway:', metric.gateway || 'default');
    console.log('─────────────────────────────────');
    console.log('⏱️  Time to First Token:', metric.timeToFirstToken?.toFixed(0) + 'ms');
    console.log('🏁 Total Response Time:', metric.totalResponseTime?.toFixed(0) + 'ms');
    console.log('📡 Network Latency:', metric.networkLatency?.toFixed(0) + 'ms');
    console.log('⚙️  Backend Processing:', metric.backendProcessingTime?.toFixed(0) + 'ms');
    console.log('🌊 Streaming Duration:', metric.streamingDuration?.toFixed(0) + 'ms');
    console.log('🚀 Tokens/Second:', metric.tokensPerSecond?.toFixed(1));
    console.log('─────────────────────────────────');
    console.log('📝 Message Length:', metric.messageLength, 'chars');
    console.log('💬 Response Length:', metric.responseLength, 'chars');
    console.log('🔄 Retries:', metric.retryCount);
    if (metric.hadError) {
      console.log('❌ Error:', metric.errorType);
    }
    console.groupEnd();
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  clearOldMetrics(keepLastN: number = 50): void {
    const allMetrics = Array.from(this.metrics.entries());

    if (allMetrics.length > keepLastN) {
      // Sort by timestamp (userClickTime) and keep only the latest
      const sorted = allMetrics.sort((a, b) => b[1].userClickTime - a[1].userClickTime);
      const toKeep = sorted.slice(0, keepLastN);

      this.metrics.clear();
      toKeep.forEach(([id, metric]) => {
        this.metrics.set(id, metric);
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`🧹 [Performance] Cleared old metrics, kept ${keepLastN} most recent`);
      }
    }
  }

  /**
   * Export metrics as JSON for analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.getAllMetrics(),
      averages: this.getAverageMetrics(),
      byModel: this.getMetricsByModel(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
}

// Singleton instance
export const chatPerformanceTracker = new ChatPerformanceTracker();
