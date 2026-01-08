import { useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { ModelOption } from '@/components/chat/model-select';
import { useChatUIStore } from '@/lib/store/chat-ui-store';
import { useToast } from '@/hooks/use-toast';

// Default model for image generation tasks
// The Gatewayz Router supports image generation via tools and routes to the best provider
export const DEFAULT_IMAGE_GENERATION_MODEL: ModelOption = {
  value: 'openrouter/auto',
  label: 'Gatewayz Router',
  category: 'Router',
  sourceGateway: 'openrouter',
  developer: 'Alpaca',
  modalities: ['Text', 'Image', 'File', 'Audio', 'Video']
};

// Get the default model for image generation
export const getImageGenerationModel = (): ModelOption => {
  return DEFAULT_IMAGE_GENERATION_MODEL;
};

// List of known multimodal models that support image input
// These are prioritized in order of preference
const MULTIMODAL_MODELS: ModelOption[] = [
  DEFAULT_IMAGE_GENERATION_MODEL,
  {
    value: 'google/gemini-2.0-flash-001',
    label: 'Gemini 2.0 Flash',
    category: 'Multimodal',
    sourceGateway: 'openrouter',
    developer: 'Google',
    modalities: ['Text', 'Image']
  },
  {
    value: 'anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet',
    category: 'Multimodal',
    sourceGateway: 'openrouter',
    developer: 'Anthropic',
    modalities: ['Text', 'Image']
  },
  {
    value: 'openai/gpt-4o',
    label: 'GPT-4o',
    category: 'Multimodal',
    sourceGateway: 'openrouter',
    developer: 'OpenAI',
    modalities: ['Text', 'Image']
  },
  {
    value: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    category: 'Multimodal',
    sourceGateway: 'openrouter',
    developer: 'OpenAI',
    modalities: ['Text', 'Image']
  },
];

// Helper to check if a model supports a specific modality
export const modelSupportsModality = (
  modelModalities: string[] | undefined | null,
  modality: string
): boolean => {
  try {
    if (!modelModalities || modelModalities.length === 0) {
      // If no modalities specified, assume text-only
      return modality.toLowerCase() === 'text';
    }
    return modelModalities.some(m => m.toLowerCase() === modality.toLowerCase());
  } catch (error) {
    // Fallback: if modality check fails, assume text-only
    Sentry.captureException(error, {
      tags: {
        function: 'modelSupportsModality',
        error_type: 'modality_check_failure',
      },
      contexts: {
        model: {
          modalities: modelModalities,
          requested_modality: modality,
        },
      },
      level: 'warning',
    });
    return modality.toLowerCase() === 'text';
  }
};

// Get the best multimodal model for a given media type
export const getMultimodalModel = (mediaType: 'image' | 'video' | 'audio' | 'file'): ModelOption => {
  try {
    // For now, return the first model that supports the media type
    // The Gatewayz Router is the default as it supports all modalities
    const model = MULTIMODAL_MODELS.find(m =>
      modelSupportsModality(m.modalities, mediaType)
    );

    if (!model) {
      // Fallback to router if no suitable model found
      console.warn(`[getMultimodalModel] No model found for ${mediaType}, using Gatewayz Router`);
      return MULTIMODAL_MODELS[0];
    }

    return model;
  } catch (error) {
    // Fallback: return Gatewayz Router on any error
    Sentry.captureException(error, {
      tags: {
        function: 'getMultimodalModel',
        error_type: 'model_selection_failure',
      },
      contexts: {
        media: {
          type: mediaType,
        },
      },
      level: 'error',
    });
    return MULTIMODAL_MODELS[0];
  }
};

export type MediaType = 'image' | 'video' | 'audio' | 'file';

export function useAutoModelSwitch() {
  const { toast } = useToast();
  const setSelectedModel = useChatUIStore(state => state.setSelectedModel);

  /**
   * Check if the current model supports the given media type.
   * If not, automatically switch to a multimodal model and show a toast notification.
   *
   * @param currentModel - The currently selected model
   * @param mediaType - The type of media being attached (image, video, audio, file)
   * @returns true if model was switched, false if no switch was needed
   */
  const checkAndSwitchModel = useCallback((
    currentModel: ModelOption | null,
    mediaType: MediaType
  ): boolean => {
    try {
      // If no model is selected, select a multimodal one
      if (!currentModel) {
        const newModel = getMultimodalModel(mediaType);
        setSelectedModel(newModel);
        toast({
          title: 'Model switched',
          description: `Switched to ${newModel.label} to support ${mediaType} input`,
        });
        return true;
      }

      // Check if current model supports the media type
      const supportsMedia = modelSupportsModality(currentModel.modalities, mediaType);

      if (!supportsMedia) {
        // Find a model that supports this media type
        const newModel = getMultimodalModel(mediaType);

        // Validate the new model has required fields
        if (!newModel.value || !newModel.label) {
          throw new Error('Invalid multimodal model configuration');
        }

        setSelectedModel(newModel);
        toast({
          title: 'Model switched',
          description: `Switched from ${currentModel.label} to ${newModel.label} to support ${mediaType} input`,
        });
        return true;
      }

      return false;
    } catch (error) {
      // Log error but don't crash - keep the current model
      Sentry.captureException(error, {
        tags: {
          function: 'checkAndSwitchModel',
          error_type: 'model_switch_failure',
        },
        contexts: {
          model: {
            current_model: currentModel?.value,
            media_type: mediaType,
          },
        },
        level: 'error',
      });

      toast({
        title: 'Model switch failed',
        description: `Could not switch to ${mediaType}-compatible model. Current model may not support this media type.`,
        variant: 'destructive',
      });

      return false;
    }
  }, [setSelectedModel, toast]);

  /**
   * Check if the current model supports image input
   */
  const checkImageSupport = useCallback((currentModel: ModelOption | null): boolean => {
    return checkAndSwitchModel(currentModel, 'image');
  }, [checkAndSwitchModel]);

  /**
   * Check if the current model supports video input
   */
  const checkVideoSupport = useCallback((currentModel: ModelOption | null): boolean => {
    return checkAndSwitchModel(currentModel, 'video');
  }, [checkAndSwitchModel]);

  /**
   * Check if the current model supports audio input
   */
  const checkAudioSupport = useCallback((currentModel: ModelOption | null): boolean => {
    return checkAndSwitchModel(currentModel, 'audio');
  }, [checkAndSwitchModel]);

  /**
   * Check if the current model supports file/document input
   */
  const checkFileSupport = useCallback((currentModel: ModelOption | null): boolean => {
    return checkAndSwitchModel(currentModel, 'file');
  }, [checkAndSwitchModel]);

  return {
    checkAndSwitchModel,
    checkImageSupport,
    checkVideoSupport,
    checkAudioSupport,
    checkFileSupport,
    modelSupportsModality,
  };
}
