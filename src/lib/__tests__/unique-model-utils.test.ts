import {
  getModelProviderNames,
  getModelProviderSlugs,
  getNormalizedPricingForFilter,
  getPrimaryProvider,
  isFreeUniqueModel,
  normalizeGatewaySlug,
  normalizeProviderSlug,
} from '@/lib/unique-model-utils';
import type { UniqueModel } from '@/types/models';

const buildModel = (overrides: Partial<UniqueModel> = {}): UniqueModel => ({
  id: 'openrouter/test:free',
  name: 'Test Model',
  description: null,
  context_length: 8192,
  architecture: null,
  supported_parameters: [],
  provider_count: 2,
  providers: [
    {
      slug: 'openrouter',
      name: 'OpenRouter',
      pricing: { prompt: '0.05', completion: '0.1' },
      health_status: 'healthy',
      average_response_time_ms: 250,
    },
    {
      slug: '@groq',
      name: 'Groq',
      pricing: { prompt: '0.02', completion: '0.04' },
      health_status: 'healthy',
      average_response_time_ms: 180,
    },
  ],
  cheapest_provider: 'openrouter',
  fastest_provider: 'groq',
  cheapest_prompt_price: 0,
  fastest_response_time: 180,
  ...overrides,
});

describe('unique-model-utils', () => {
  test('normalizeProviderSlug strips @ and lowercases', () => {
    expect(normalizeProviderSlug('@Groq')).toBe('groq');
  });

  test('normalizeGatewaySlug maps hug to huggingface', () => {
    expect(normalizeGatewaySlug('hug')).toBe('huggingface');
    expect(normalizeGatewaySlug('openrouter')).toBe('openrouter');
  });

  test('getPrimaryProvider selects cheapest provider when available', () => {
    const model = buildModel({ cheapest_provider: 'openrouter' });
    expect(getPrimaryProvider(model)?.slug).toBe('openrouter');
  });

  test('getModelProviderSlugs and names derive from providers', () => {
    const model = buildModel();
    expect(getModelProviderSlugs(model)).toEqual(['openrouter', 'groq']);
    expect(getModelProviderNames(model)).toEqual(['OpenRouter', 'Groq']);
  });

  test('isFreeUniqueModel respects cheapest_prompt_price and openrouter :free suffix', () => {
    const freeModel = buildModel();
    expect(isFreeUniqueModel(freeModel)).toBe(true);

    const paidModel = buildModel({
      id: 'openrouter/test',
      cheapest_prompt_price: 0.02,
    });
    expect(isFreeUniqueModel(paidModel)).toBe(false);
  });

  test('getNormalizedPricingForFilter returns normalized pricing', () => {
    const model = buildModel({
      cheapest_provider: '@groq',
    });
    const pricing = getNormalizedPricingForFilter(model);
    expect(pricing.slug).toBe('groq');
    expect(pricing.prompt).toBeGreaterThan(0);
    expect(pricing.completion).toBeGreaterThan(0);
  });
});
