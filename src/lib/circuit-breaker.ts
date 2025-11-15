/**
 * Circuit Breaker Pattern Implementation
 * Prevents repeated requests to failing models/providers
 * Reduces unnecessary API calls and improves recovery time
 */

export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold?: number;    // Failed requests before opening (default: 5)
  recoveryTimeout?: number;      // Time before trying again in ms (default: 30s)
  monitoringWindow?: number;    // Time window for counting failures in ms (default: 60s)
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime?: number;
  lastStateChangeTime?: number;
  successCount: number;
}

/**
 * Circuit Breaker for model/provider requests
 * Prevents cascading failures when models are unavailable
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: Required<CircuitBreakerConfig>;
  private failureTimestamps: number[] = [];

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      recoveryTimeout: config.recoveryTimeout ?? 30000, // 30 seconds
      monitoringWindow: config.monitoringWindow ?? 60000 // 60 seconds
    };

    this.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0
    };
  }

  /**
   * Check if request should be allowed
   */
  canExecute(): boolean {
    // Clean up old failure timestamps outside monitoring window
    const now = Date.now();
    this.failureTimestamps = this.failureTimestamps.filter(
      ts => now - ts < this.config.monitoringWindow
    );

    // If closed, always allow
    if (this.state.state === CircuitState.CLOSED) {
      return true;
    }

    // If open, check if we should try half-open
    if (this.state.state === CircuitState.OPEN) {
      const timeSinceFailure = this.state.lastFailureTime
        ? now - this.state.lastFailureTime
        : 0;

      if (timeSinceFailure >= this.config.recoveryTimeout) {
        // Time to test recovery
        this.state.state = CircuitState.HALF_OPEN;
        this.state.successCount = 0;
        this.state.failureCount = 0;
        return true;
      }

      return false; // Still in cooldown
    }

    // Half-open: allow single request to test
    return true;
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    this.state.successCount++;
    this.failureTimestamps = []; // Clear failures on success

    if (this.state.state === CircuitState.HALF_OPEN) {
      // Recovered! Close the circuit
      this.state.state = CircuitState.CLOSED;
      this.state.failureCount = 0;
      this.state.lastStateChangeTime = Date.now();
    } else if (this.state.state === CircuitState.CLOSED) {
      this.state.failureCount = Math.max(0, this.state.failureCount - 1);
    }
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    const now = Date.now();
    this.failureTimestamps.push(now);
    this.state.failureCount++;
    this.state.lastFailureTime = now;
    this.state.successCount = 0;

    // Check if we should open the circuit
    if (this.failureTimestamps.length >= this.config.failureThreshold) {
      if (this.state.state !== CircuitState.OPEN) {
        this.state.state = CircuitState.OPEN;
        this.state.lastStateChangeTime = now;
      }
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state.state;
  }

  /**
   * Get detailed state info
   */
  getStateInfo() {
    return {
      state: this.state.state,
      failureCount: this.state.failureCount,
      successCount: this.state.successCount,
      recentFailures: this.failureTimestamps.length,
      timeSinceLastFailure: this.state.lastFailureTime
        ? Date.now() - this.state.lastFailureTime
        : null
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0
    };
    this.failureTimestamps = [];
  }
}

/**
 * Circuit Breaker Registry for managing multiple models/providers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = config;
  }

  /**
   * Get or create circuit breaker for a model
   */
  getBreaker(modelId: string): CircuitBreaker {
    if (!this.breakers.has(modelId)) {
      this.breakers.set(modelId, new CircuitBreaker(this.config));
    }
    return this.breakers.get(modelId)!;
  }

  /**
   * Check if model can be used
   */
  canUseModel(modelId: string): boolean {
    return this.getBreaker(modelId).canExecute();
  }

  /**
   * Record model success
   */
  recordSuccess(modelId: string): void {
    this.getBreaker(modelId).recordSuccess();
  }

  /**
   * Record model failure
   */
  recordFailure(modelId: string): void {
    this.getBreaker(modelId).recordFailure();
  }

  /**
   * Get status of all models
   */
  getStatus() {
    const status: Record<string, any> = {};
    for (const [modelId, breaker] of this.breakers) {
      status[modelId] = breaker.getStateInfo();
    }
    return status;
  }

  /**
   * Get available models (not open/unavailable)
   */
  getAvailableModels(modelIds: string[]): string[] {
    return modelIds.filter(id => this.canUseModel(id));
  }

  /**
   * Clear all circuit breakers
   */
  reset(): void {
    this.breakers.clear();
  }
}

// Global circuit breaker registry (singleton)
let globalRegistry: CircuitBreakerRegistry | null = null;

export function getGlobalCircuitBreakerRegistry(): CircuitBreakerRegistry {
  if (!globalRegistry) {
    globalRegistry = new CircuitBreakerRegistry({
      failureThreshold: 3,        // Open after 3 failures
      recoveryTimeout: 30000,     // Try recovery after 30 seconds
      monitoringWindow: 120000    // Track last 2 minutes of failures
    });
  }
  return globalRegistry;
}
