/**
 * Tests for provider model ID format utilities.
 */

import {
    stripDeveloperPrefix,
    keepFullModelId,
    providerModelFormats,
    getFormattedModelId,
} from '../provider-model-formats';

describe('provider-model-formats', () => {
    describe('stripDeveloperPrefix', () => {
        it('should strip the developer prefix from model ID', () => {
            expect(stripDeveloperPrefix('openai/gpt-4o')).toBe('gpt-4o');
            expect(stripDeveloperPrefix('anthropic/claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022');
            expect(stripDeveloperPrefix('meta/llama-3.3-70b')).toBe('llama-3.3-70b');
        });

        it('should handle model IDs without prefix', () => {
            expect(stripDeveloperPrefix('gpt-4o')).toBe('gpt-4o');
            expect(stripDeveloperPrefix('claude-3-5-sonnet')).toBe('claude-3-5-sonnet');
        });

        it('should handle nested paths', () => {
            expect(stripDeveloperPrefix('near/deepseek-ai/DeepSeek-V3.1')).toBe('DeepSeek-V3.1');
        });
    });

    describe('keepFullModelId', () => {
        it('should return the model ID unchanged', () => {
            expect(keepFullModelId('openai/gpt-4o')).toBe('openai/gpt-4o');
            expect(keepFullModelId('meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');
            expect(keepFullModelId('together/meta-llama/Llama-3.1-70B')).toBe('together/meta-llama/Llama-3.1-70B');
        });
    });

    describe('providerModelFormats', () => {
        it('should have openai configured to strip prefix', () => {
            expect(providerModelFormats.openai('openai/gpt-4o')).toBe('gpt-4o');
            expect(providerModelFormats.openai('openai/gpt-4-turbo')).toBe('gpt-4-turbo');
            expect(providerModelFormats.openai('openai/o1')).toBe('o1');
        });

        it('should have anthropic configured to strip prefix', () => {
            expect(providerModelFormats.anthropic('anthropic/claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022');
            expect(providerModelFormats.anthropic('anthropic/claude-3-opus-20240229')).toBe('claude-3-opus-20240229');
        });

        it('should have groq configured to strip prefix', () => {
            expect(providerModelFormats.groq('meta/llama-3.3-70b')).toBe('llama-3.3-70b');
        });

        it('should have together configured to keep full ID', () => {
            expect(providerModelFormats.together('meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');
        });

        it('should have fireworks configured to keep full ID', () => {
            expect(providerModelFormats.fireworks('meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');
        });
    });

    describe('getFormattedModelId', () => {
        it('should format model ID for known providers', () => {
            expect(getFormattedModelId('openai', 'openai/gpt-4o')).toBe('gpt-4o');
            expect(getFormattedModelId('anthropic', 'anthropic/claude-3-5-sonnet')).toBe('claude-3-5-sonnet');
            expect(getFormattedModelId('together', 'meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');
        });

        it('should return original model ID for unknown providers', () => {
            expect(getFormattedModelId('unknown-provider', 'openai/gpt-4o')).toBe('openai/gpt-4o');
            expect(getFormattedModelId('new-provider', 'meta/llama-3.3-70b')).toBe('meta/llama-3.3-70b');
        });
    });
});
