import { cn, stringToColor, extractTokenValue, normalizeModelId } from '../utils'

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
})
