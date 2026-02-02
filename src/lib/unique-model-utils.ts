import { getNormalizedPerTokenPrice } from '@/lib/model-pricing-utils';
import type { Provider, UniqueModel } from '@/types/models';

export const normalizeProviderSlug = (slug: string) => slug.replace(/^@/, '').toLowerCase();

export const normalizeGatewaySlug = (slug: string) => (slug === 'hug' ? 'huggingface' : slug);

export const getModelProviders = (model: UniqueModel): Provider[] => model.providers || [];

export const getPrimaryProvider = (model: UniqueModel): Provider | undefined => {
  const providers = getModelProviders(model);
  return providers.find(provider => provider.slug === model.cheapest_provider) || providers[0];
};

export const getModelProviderSlugs = (model: UniqueModel): string[] =>
  getModelProviders(model).map(provider => normalizeProviderSlug(provider.slug));

export const getModelProviderNames = (model: UniqueModel): string[] =>
  getModelProviders(model).map(provider => provider.name);

export const isFreeUniqueModel = (model: UniqueModel): boolean => (
  model.cheapest_prompt_price === 0 ||
  (model.id?.endsWith(':free') && getModelProviderSlugs(model).includes('openrouter'))
);

export const getNormalizedPricingForFilter = (model: UniqueModel) => {
  const provider = getPrimaryProvider(model);
  if (!provider) {
    return { prompt: 0, completion: 0, slug: '' };
  }
  const normalizedSlug = normalizeProviderSlug(provider.slug);
  return {
    prompt: getNormalizedPerTokenPrice(provider.pricing?.prompt, normalizedSlug),
    completion: getNormalizedPerTokenPrice(provider.pricing?.completion, normalizedSlug),
    slug: normalizedSlug,
  };
};
