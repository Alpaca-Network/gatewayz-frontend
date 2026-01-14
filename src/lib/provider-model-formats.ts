/**
 * Model ID format utilities for different providers.
 * These functions transform model IDs from the canonical format (developer/model)
 * to the format expected by each provider's API.
 */

/**
 * Strips the developer prefix from a model ID.
 * Used by providers that expect just the model name without the developer prefix.
 * e.g., 'openai/gpt-4o' → 'gpt-4o'
 */
export function stripDeveloperPrefix(modelId: string): string {
    const parts = modelId.split('/');
    return parts[parts.length - 1];
}

/**
 * Returns the model ID unchanged.
 * Used by providers that expect the full model ID with developer prefix.
 */
export function keepFullModelId(modelId: string): string {
    return modelId;
}

/**
 * Provider-specific model ID format functions.
 * Maps provider names to their model ID transformation functions.
 */
export const providerModelFormats: Record<string, (modelId: string) => string> = {
    // Providers that strip the developer prefix
    openai: stripDeveloperPrefix,
    anthropic: stripDeveloperPrefix,
    groq: stripDeveloperPrefix,
    cerebras: stripDeveloperPrefix,
    xai: stripDeveloperPrefix,
    nebius: stripDeveloperPrefix,
    novita: stripDeveloperPrefix,
    alibaba: stripDeveloperPrefix,

    // Providers that use the full model ID
    together: keepFullModelId,
    fireworks: keepFullModelId,
    deepinfra: keepFullModelId,
    featherless: keepFullModelId,
    chutes: keepFullModelId,
    huggingface: keepFullModelId,
    near: keepFullModelId,
    aimo: keepFullModelId,
};

/**
 * Get the formatted model ID for a specific provider.
 * Falls back to returning the original model ID if no format function is defined.
 */
export function getFormattedModelId(provider: string, modelId: string): string {
    const formatFn = providerModelFormats[provider];
    return formatFn ? formatFn(modelId) : modelId;
}
