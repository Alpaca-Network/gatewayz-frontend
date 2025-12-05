import { cn, stringToColor, extractTokenValue, normalizeModelId, getModelUrl, shortenModelName } from '../utils'

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })

    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })
  })

  describe('stringToColor', () => {
    it('should return default gray for null', () => {
      expect(stringToColor(null)).toBe('hsl(0, 0%, 85%)')
    })

    it('should return default gray for undefined', () => {
      expect(stringToColor(undefined)).toBe('hsl(0, 0%, 85%)')
    })

    it('should return consistent color for same string', () => {
      const color1 = stringToColor('test')
      const color2 = stringToColor('test')
      expect(color1).toBe(color2)
    })

    it('should return HSL color format', () => {
      const color = stringToColor('test')
      expect(color).toMatch(/^hsl\(\d+, 60%, 85%\)$/)
    })

    it('should return different colors for different strings', () => {
      const color1 = stringToColor('test1')
      const color2 = stringToColor('test2')
      expect(color1).not.toBe(color2)
    })
  })

  describe('extractTokenValue', () => {
    it('should extract token value with B suffix', () => {
      expect(extractTokenValue('123B tokens')).toBe('123B')
    })

    it('should extract token value with T suffix', () => {
      expect(extractTokenValue('1.5T tokens')).toBe('1.5T')
    })

    it('should extract token value with M suffix', () => {
      expect(extractTokenValue('256M tokens')).toBe('256M')
    })

    it('should extract token value with K suffix', () => {
      expect(extractTokenValue('8K tokens')).toBe('8K')
    })

    it('should handle decimal values', () => {
      expect(extractTokenValue('1.25M tokens')).toBe('1.25M')
    })

    it('should be case insensitive', () => {
      expect(extractTokenValue('128k TOKENS')).toBe('128k')
    })

    it('should return null for invalid format', () => {
      expect(extractTokenValue('invalid')).toBeNull()
    })

    it('should return null for missing suffix', () => {
      expect(extractTokenValue('123 tokens')).toBeNull()
    })

    it('should return null for missing tokens word', () => {
      expect(extractTokenValue('123K')).toBeNull()
    })
  })

  describe('normalizeModelId', () => {
    it('should leave standard gateway/model format as-is', () => {
      expect(normalizeModelId('near/zai-org/GLM-4.6')).toBe('near/zai-org/GLM-4.6')
    })

    it('should handle @provider/models/model-name format', () => {
      expect(normalizeModelId('@google/models/gemini-pro')).toBe('google/gemini-pro')
    })

    it('should handle provider/models/model-name format', () => {
      expect(normalizeModelId('google/models/gemini-pro')).toBe('google/gemini-pro')
    })

    it('should handle accounts/provider/models/model-name format', () => {
      expect(normalizeModelId('accounts/fireworks/models/deepseek-r1')).toBe('fireworks/deepseek-r1')
    })

    it('should handle simple model names', () => {
      expect(normalizeModelId('gpt-4')).toBe('gpt-4')
    })

    it('should handle provider/model format', () => {
      expect(normalizeModelId('openai/gpt-4')).toBe('openai/gpt-4')
    })

    it('should return empty string as-is', () => {
      expect(normalizeModelId('')).toBe('')
    })

    it('should handle models with multiple slashes', () => {
      expect(normalizeModelId('near/zai-org/GLM-4.6')).toBe('near/zai-org/GLM-4.6')
    })

    it('should extract gateway prefix correctly for routing', () => {
      const modelId = 'near/zai-org/GLM-4.6'
      const normalized = normalizeModelId(modelId)
      const gateway = normalized.split('/')[0]
      expect(gateway).toBe('near')
    })
  })

  describe('getModelUrl', () => {
    it('should handle simple provider/model format', () => {
      expect(getModelUrl('openai/gpt-4')).toBe('/models/openai/gpt-4')
    })

    it('should normalize special characters in model names', () => {
      expect(getModelUrl('openai/gpt-4o')).toBe('/models/openai/gpt-4o')
    })

    it('should preserve nested paths for NEAR models', () => {
      expect(getModelUrl('near/deepseek-ai/deepseek-v3-1')).toBe('/models/near/deepseek-ai/deepseek-v3-1')
    })

    it('should handle NEAR models with multiple path segments', () => {
      expect(getModelUrl('near/zai-org/GLM-4.6')).toBe('/models/near/zai-org/glm-4-6')
    })

    it('should handle provider:model format', () => {
      expect(getModelUrl('aimo:model-name')).toBe('/models/aimo/model-name')
    })

    it('should handle provider slug fallback', () => {
      expect(getModelUrl('gpt-4o mini', 'openai')).toBe('/models/openai/gpt-4o-mini')
    })

    it('should return /models for empty input', () => {
      expect(getModelUrl('')).toBe('/models')
    })

    it('should handle FAL models with complex paths', () => {
      expect(getModelUrl('fal-ai/flux-pro/v1-1-ultra')).toBe('/models/fal-ai/flux-pro/v1-1-ultra')
    })

    it('should convert provider to lowercase', () => {
      expect(getModelUrl('OpenAI/GPT-4')).toBe('/models/openai/gpt-4')
    })
  })

  describe('shortenModelName', () => {
    it('should remove gateway prefix from 3-part model names and lowercase', () => {
      expect(shortenModelName('OpenRouter/deepseek/Deepseek-r1')).toBe('deepseek/deepseek-r1')
    })

    it('should remove gateway prefix and lowercase', () => {
      expect(shortenModelName('openrouter/openai/gpt-4o')).toBe('openai/gpt-4o')
    })

    it('should handle fireworks gateway prefix', () => {
      expect(shortenModelName('fireworks/meta-llama/llama-3')).toBe('meta-llama/llama-3')
    })

    it('should lowercase 2-part model names', () => {
      expect(shortenModelName('deepseek/Deepseek-R1')).toBe('deepseek/deepseek-r1')
    })

    it('should lowercase single part model names', () => {
      expect(shortenModelName('GPT-4o')).toBe('gpt-4o')
    })

    it('should handle 4+ part paths by removing only first part and lowercase', () => {
      expect(shortenModelName('openrouter/near/deepseek-ai/DeepSeek-V3')).toBe('near/deepseek-ai/deepseek-v3')
    })

    it('should return empty string as-is', () => {
      expect(shortenModelName('')).toBe('')
    })

    it('should handle null/undefined gracefully', () => {
      expect(shortenModelName(null as unknown as string)).toBe(null)
      expect(shortenModelName(undefined as unknown as string)).toBe(undefined)
    })
  })
})
