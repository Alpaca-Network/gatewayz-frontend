import type { Model as StaticModelDefinition } from '@/lib/models-data';
import { normalizeToUrlSafe } from '@/lib/utils';
import { validateGateways, ensureValidGateways } from '@/lib/gateway-validation';
import * as Sentry from '@sentry/nextjs';

export interface ModelDetailRecord {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string | number | null;
    completion?: string | number | null;
  } | null;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
  provider_slug?: string;
  provider_slugs?: string[];
  canonical_slug?: string;
  source_gateway?: string;
  source_gateways?: string[];
  is_private?: boolean;
  [key: string]: any;
}

export interface ModelLookupParams {
  modelId?: string;
  developer?: string;
  modelNameParam?: string;
}

const decodeAndNormalizeId = (value?: string | null): string => {
  if (!value) return '';
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    return value.toLowerCase();
  }
};

const collapseIdentifier = (value: string): string => {
  return value.replace(/[^a-z0-9]/gi, '');
};

const providerCandidatesFromModel = (model: ModelDetailRecord): Set<string> => {
  const candidates = new Set<string>();

  const addCandidate = (val?: string | null) => {
    if (val) {
      candidates.add(val.toLowerCase());
    }
  };

  addCandidate(model.provider_slug);
  if (Array.isArray(model.provider_slugs)) {
    model.provider_slugs.forEach(addCandidate);
  }

  if (model.id) {
    if (model.id.includes(':')) {
      addCandidate(model.id.split(':')[0]);
    } else if (model.id.includes('/')) {
      addCandidate(model.id.split('/')[0]);
    } else {
      addCandidate(model.id);
    }
  }

  return candidates;
};

const gatherNameCandidates = (model: ModelDetailRecord): Set<string> => {
  const candidates = new Set<string>();

  const addCandidate = (val?: string | null) => {
    if (!val) return;
    const normalized = normalizeToUrlSafe(val);
    if (normalized) {
      candidates.add(normalized);
    }
  };

  addCandidate(extractModelNameFromId(model.id));
  addCandidate(model.name);
  addCandidate(model.canonical_slug);

  if (model.canonical_slug && model.canonical_slug.includes('/')) {
    const parts = model.canonical_slug.split('/');
    addCandidate(parts[parts.length - 1]);
  }

  if (typeof model.model_id === 'string') {
    addCandidate(model.model_id);
  }

  if (typeof model.provider_model_id === 'string') {
    addCandidate(model.provider_model_id);
  }

  return candidates;
};

export const extractModelNameFromId = (modelId?: string): string => {
  if (!modelId) return '';
  if (modelId.includes(':')) {
    return modelId.split(':').slice(1).join(':');
  }
  const parts = modelId.split('/');
  if (parts.length <= 1) {
    return modelId;
  }
  return parts.slice(1).join('/');
};

export const findModelByRouteParams = <T extends ModelDetailRecord>(
  models: T[],
  params: ModelLookupParams
): T | undefined => {
  const normalizedModelId = decodeAndNormalizeId(params.modelId);
  const collapsedModelId = normalizedModelId ? collapseIdentifier(normalizedModelId) : '';
  const normalizedSearchName = params.modelNameParam
    ? normalizeToUrlSafe(params.modelNameParam)
    : params.modelId
      ? normalizeToUrlSafe(extractModelNameFromId(params.modelId))
      : '';
  const developer = params.developer?.toLowerCase();

  return models.find((model) => {
    if (!model?.id) return false;
    const idLower = model.id.toLowerCase();

    if (normalizedModelId && idLower === normalizedModelId) {
      return true;
    }

    if (collapsedModelId && collapseIdentifier(idLower) === collapsedModelId) {
      return true;
    }

    const providerMatches = !developer || providerCandidatesFromModel(model).has(developer);
    if (!normalizedSearchName) {
      return providerMatches && Boolean(normalizedModelId);
    }

    const nameCandidates = gatherNameCandidates(model);
    if (nameCandidates.has(normalizedSearchName)) {
      return providerMatches;
    }

    return false;
  });
};

export const getModelGateways = (model: ModelDetailRecord): string[] => {
  try {
    const gateways = new Set<string>();
    const addGateway = (val?: string | null) => {
      if (val) {
        gateways.add(val.toLowerCase());
      }
    };

    if (Array.isArray(model.source_gateways)) {
      model.source_gateways.forEach(addGateway);
    }

    addGateway(model.source_gateway);

    if (Array.isArray(model.gateways)) {
      model.gateways.forEach(addGateway);
    }

    addGateway(model.gateway);

    const gatewayArray = Array.from(gateways);

    // Validate gateways and ensure at least one valid gateway
    const validatedGateways = ensureValidGateways(gatewayArray);

    if (validatedGateways.length === 0) {
      console.warn(`[getModelGateways] No valid gateways found for model ${model.id}, using fallback`);
      Sentry.captureMessage('Model has no valid gateways', {
        level: 'warning',
        tags: {
          function: 'getModelGateways',
          model_id: model.id,
        },
        contexts: {
          model: {
            id: model.id,
            name: model.name,
            raw_gateways: gatewayArray,
          },
        },
      });
    }

    return validatedGateways;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        function: 'getModelGateways',
        error_type: 'gateway_extraction_failure',
      },
      contexts: {
        model: {
          id: model?.id,
          name: model?.name,
        },
      },
      level: 'error',
    });
    // Return fallback gateway on error
    return ['gatewayz'];
  }
};

export const getRelatedModels = <T extends ModelDetailRecord>(
  models: T[],
  target: T,
  limit: number = 6
): T[] => {
  if (!target) return [];

  const targetProviders = providerCandidatesFromModel(target);
  if (targetProviders.size === 0) return [];

  const related: T[] = [];
  const seen = new Set<string>();

  for (const model of models) {
    if (!model?.id || model.id === target.id) continue;
    if (seen.has(model.id)) continue;

    const modelProviders = providerCandidatesFromModel(model);
    const sharesProvider = Array.from(modelProviders).some((provider) =>
      targetProviders.has(provider)
    );

    if (!sharesProvider) continue;

    related.push(model);
    seen.add(model.id);

    if (related.length >= limit) {
      break;
    }
  }

  return related;
};

export const transformStaticModel = (staticModel: StaticModelDefinition): ModelDetailRecord => {
  const nameParts = staticModel.name.split(':');
  const modelNamePart = nameParts.length > 1 ? nameParts[1].trim() : staticModel.name;
  const normalizedName = normalizeToUrlSafe(modelNamePart);

  return {
    id: `${staticModel.developer}/${normalizedName}`,
    name: staticModel.name,
    description: staticModel.description,
    context_length: staticModel.context * 1000,
    pricing: {
      prompt: staticModel.inputCost.toString(),
      completion: staticModel.outputCost.toString(),
    },
    architecture: {
      input_modalities: staticModel.modalities.map((m) => m.toLowerCase()),
    },
    supported_parameters: staticModel.supportedParameters,
    provider_slug: staticModel.developer,
    provider_slugs: [staticModel.developer],
    is_private: staticModel.is_private,
  };
};
