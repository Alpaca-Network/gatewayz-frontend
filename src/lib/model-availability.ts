/**
 * Model Availability Manager
 * Uses circuit breaker pattern to track model reliability
 * Helps with smart fallback selection
 */

import { getGlobalCircuitBreakerRegistry } from './circuit-breaker';

/**
 * Check if a model is currently available
 */
export function isModelAvailable(modelId: string): boolean {
  return getGlobalCircuitBreakerRegistry().canUseModel(modelId);
}

/**
 * Record successful model usage
 */
export function recordModelSuccess(modelId: string): void {
  getGlobalCircuitBreakerRegistry().recordSuccess(modelId);
}

/**
 * Record failed model usage
 */
export function recordModelFailure(modelId: string): void {
  getGlobalCircuitBreakerRegistry().recordFailure(modelId);
}

/**
 * Get available models from a list, sorted by reliability
 */
export function getAvailableModels(modelIds: string[]): string[] {
  return getGlobalCircuitBreakerRegistry().getAvailableModels(modelIds);
}

/**
 * Select best fallback model
 * Prioritizes: available → free tier → fastest
 */
export function selectBestFallback(
  fallbackModels: Array<{ value: string; label: string; category?: string }>,
  currentModelId?: string
): { value: string; label: string; category?: string } | undefined {
  // Filter out current model
  let candidates = fallbackModels.filter(
    m => !currentModelId || m.value !== currentModelId
  );

  if (candidates.length === 0) {
    return undefined;
  }

  // Prioritize available models
  const availableModels = candidates.filter(m => isModelAvailable(m.value));

  // Prefer free models if available
  const preferredModels = availableModels.length > 0 ? availableModels : candidates;
  const freeModels = preferredModels.filter(
    m => m.value.includes(':free') || m.category === 'Free'
  );

  // Return first available free model, or first available model, or first candidate
  return freeModels[0] || preferredModels[0] || candidates[0];
}

/**
 * Get model availability status for debugging/monitoring
 */
export function getModelStatus() {
  return getGlobalCircuitBreakerRegistry().getStatus();
}

/**
 * Reset model availability tracking (for testing)
 */
export function resetModelAvailability(): void {
  getGlobalCircuitBreakerRegistry().reset();
}
