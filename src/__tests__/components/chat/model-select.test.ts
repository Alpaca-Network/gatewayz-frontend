/**
 * Tests for model-select utility functions
 *
 * Tests the checkModelToolSupport function that determines
 * if a model supports tool/function calling.
 */

import { checkModelToolSupport } from '@/components/chat/model-select';

describe('checkModelToolSupport', () => {
  describe('OpenAI models', () => {
    it('should return true for GPT-4 models', () => {
      expect(checkModelToolSupport('gpt-4')).toBe(true);
      expect(checkModelToolSupport('gpt-4-0613')).toBe(true);
      expect(checkModelToolSupport('gpt-4-turbo')).toBe(true);
      expect(checkModelToolSupport('gpt-4-turbo-preview')).toBe(true);
      expect(checkModelToolSupport('gpt-4o')).toBe(true);
      expect(checkModelToolSupport('gpt-4o-mini')).toBe(true);
    });

    it('should return true for GPT-3.5-turbo', () => {
      expect(checkModelToolSupport('gpt-3.5-turbo')).toBe(true);
      expect(checkModelToolSupport('gpt-3.5-turbo-0613')).toBe(true);
    });
  });

  describe('Anthropic Claude models', () => {
    it('should return true for Claude 3.x models', () => {
      expect(checkModelToolSupport('claude-3-opus-20240229')).toBe(true);
      expect(checkModelToolSupport('claude-3-sonnet-20240229')).toBe(true);
      expect(checkModelToolSupport('claude-3-haiku-20240307')).toBe(true);
      expect(checkModelToolSupport('claude-3-5-sonnet-20241022')).toBe(true);
    });

    it('should return false for Claude 2.x models', () => {
      expect(checkModelToolSupport('claude-2')).toBe(false);
      expect(checkModelToolSupport('claude-2.1')).toBe(false);
      expect(checkModelToolSupport('claude-instant-1.2')).toBe(false);
    });
  });

  describe('Google Gemini models', () => {
    it('should return true for Gemini models', () => {
      expect(checkModelToolSupport('gemini-pro')).toBe(true);
      expect(checkModelToolSupport('gemini-1.5-pro')).toBe(true);
      expect(checkModelToolSupport('gemini-1.5-flash')).toBe(true);
      expect(checkModelToolSupport('gemini-2.0-flash-exp')).toBe(true);
    });
  });

  describe('Meta Llama models', () => {
    it('should return true for Llama 3.x models', () => {
      expect(checkModelToolSupport('llama-3-8b')).toBe(true);
      expect(checkModelToolSupport('llama-3-70b')).toBe(true);
      expect(checkModelToolSupport('llama-3.1-8b')).toBe(true);
      expect(checkModelToolSupport('llama-3.1-70b-instruct')).toBe(true);
      expect(checkModelToolSupport('llama-3.2-1b')).toBe(true);
      expect(checkModelToolSupport('meta-llama/Llama-3.1-8B-Instruct')).toBe(true);
    });

    it('should return false for Llama 2.x models', () => {
      expect(checkModelToolSupport('llama-2-7b')).toBe(false);
      expect(checkModelToolSupport('llama-2-70b-chat')).toBe(false);
    });
  });

  describe('Qwen models', () => {
    it('should return true for Qwen 2.x models', () => {
      expect(checkModelToolSupport('qwen-2-7b')).toBe(true);
      expect(checkModelToolSupport('qwen-2.5-72b-instruct')).toBe(true);
      expect(checkModelToolSupport('Qwen/Qwen2.5-7B-Instruct')).toBe(true);
    });

    it('should return false for Qwen 1.x models', () => {
      expect(checkModelToolSupport('qwen-1.5-7b')).toBe(false);
    });
  });

  describe('Mistral models', () => {
    it('should return true for Mistral models', () => {
      expect(checkModelToolSupport('mistral-7b')).toBe(true);
      expect(checkModelToolSupport('mistral-large')).toBe(true);
      expect(checkModelToolSupport('mixtral-8x7b')).toBe(true);
    });
  });

  describe('With supportedParams', () => {
    it('should return true when tools is in supportedParams', () => {
      expect(checkModelToolSupport('custom-model', ['tools'])).toBe(true);
      expect(checkModelToolSupport('custom-model', ['temperature', 'tools', 'max_tokens'])).toBe(true);
    });

    it('should return true when functions is in supportedParams', () => {
      expect(checkModelToolSupport('custom-model', ['functions'])).toBe(true);
      expect(checkModelToolSupport('custom-model', ['temperature', 'functions'])).toBe(true);
    });

    it('should fall back to pattern matching when tools/functions not in supportedParams', () => {
      // Even without tools in supportedParams, gpt-4 should return true
      expect(checkModelToolSupport('gpt-4', ['temperature'])).toBe(true);
      // But unknown model without supportedParams should return false
      expect(checkModelToolSupport('unknown-model', ['temperature'])).toBe(false);
    });
  });

  describe('Unknown models', () => {
    it('should return false for unknown models', () => {
      expect(checkModelToolSupport('some-random-model')).toBe(false);
      expect(checkModelToolSupport('custom-finetuned-model')).toBe(false);
    });

    it('should return false for empty model ID', () => {
      expect(checkModelToolSupport('')).toBe(false);
    });
  });

  describe('Case insensitivity', () => {
    it('should handle different cases in model names', () => {
      expect(checkModelToolSupport('GPT-4')).toBe(true);
      expect(checkModelToolSupport('CLAUDE-3-OPUS-20240229')).toBe(true);
      expect(checkModelToolSupport('Gemini-Pro')).toBe(true);
    });
  });
});
