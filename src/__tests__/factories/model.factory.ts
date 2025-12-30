/**
 * Model Factory
 *
 * Factory for creating test AI model data.
 */

import { faker } from '@faker-js/faker'

export interface Model {
  name: string
  isFree: boolean
  tokens: string
  category: string
  description: string
  developer: string
  context: number
  inputCost: number
  outputCost: number
  modalities: string[]
  series: string
  supportedParameters: string[]
  requiredTier?: 'basic' | 'pro' | 'max'
}

/**
 * Create a model
 */
export function createModel(overrides?: Partial<Model>): Model {
  const developers = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Mistral', 'Cohere']
  const developer = overrides?.developer || faker.helpers.arrayElement(developers)
  const modelName = overrides?.name || generateModelName(developer)

  return {
    name: modelName,
    isFree: faker.datatype.boolean({ probability: 0.3 }),
    tokens: faker.helpers.arrayElement(['4k', '8k', '16k', '32k', '128k', '200k']),
    category: faker.helpers.arrayElement(['Chat', 'Code', 'Vision', 'Embedding']),
    description: faker.lorem.sentence(),
    developer,
    context: faker.helpers.arrayElement([4096, 8192, 16384, 32768, 128000, 200000]),
    inputCost: faker.number.int({ min: 1, max: 100 }),
    outputCost: faker.number.int({ min: 1, max: 200 }),
    modalities: ['text'],
    series: modelName.split('-')[0] || 'default',
    supportedParameters: ['temperature', 'top_p', 'max_tokens', 'frequency_penalty'],
    ...overrides,
  }
}

/**
 * Create a free model
 */
export function createFreeModel(overrides?: Partial<Model>): Model {
  return createModel({
    isFree: true,
    inputCost: 0,
    outputCost: 0,
    ...overrides,
  })
}

/**
 * Create a premium model
 */
export function createPremiumModel(overrides?: Partial<Model>): Model {
  return createModel({
    isFree: false,
    requiredTier: 'pro',
    inputCost: faker.number.int({ min: 50, max: 150 }),
    outputCost: faker.number.int({ min: 100, max: 300 }),
    ...overrides,
  })
}

/**
 * Create a vision model
 */
export function createVisionModel(overrides?: Partial<Model>): Model {
  return createModel({
    category: 'Vision',
    modalities: ['text', 'image'],
    ...overrides,
  })
}

/**
 * Create a code model
 */
export function createCodeModel(overrides?: Partial<Model>): Model {
  return createModel({
    category: 'Code',
    developer: 'OpenAI',
    name: 'gpt-4-code',
    ...overrides,
  })
}

/**
 * Create multiple models
 */
export function createModels(count: number, overrides?: Partial<Model>): Model[] {
  return Array.from({ length: count }, () => createModel(overrides))
}

/**
 * Create a model from each major developer
 */
export function createDiverseModels(): Model[] {
  return [
    createModel({ developer: 'OpenAI', name: 'gpt-4' }),
    createModel({ developer: 'Anthropic', name: 'claude-3-opus' }),
    createModel({ developer: 'Google', name: 'gemini-pro' }),
    createModel({ developer: 'Meta', name: 'llama-3-70b' }),
    createModel({ developer: 'Mistral', name: 'mixtral-8x7b' }),
  ]
}

/**
 * Helper to generate realistic model names based on developer
 */
function generateModelName(developer: string): string {
  const modelNames: Record<string, string[]> = {
    OpenAI: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    Anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    Google: ['gemini-pro', 'gemini-ultra', 'palm-2'],
    Meta: ['llama-3-70b', 'llama-3-8b', 'llama-2-70b'],
    Mistral: ['mixtral-8x7b', 'mistral-large', 'mistral-medium'],
    Cohere: ['command-r-plus', 'command-r', 'command'],
  }

  const names = modelNames[developer] || ['default-model']
  return faker.helpers.arrayElement(names)
}
