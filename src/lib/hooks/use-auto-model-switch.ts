import { useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/nextjs';
import {
  type ModelOption,
  isCatalogModelSelectable,
  mapCatalogModelToOption,
} from '@/components/chat-v2/model-select';
import { useChatUIStore } from '@/lib/store/chat-ui-store';
import { useToast } from '@/hooks/use-toast';
import { useModels } from '@/lib/hooks/use-catalog';

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

export type MediaType = 'image' | 'video' | 'audio' | 'file';

// Choose only from models that the live backend catalog currently advertises.
export const getMultimodalModel = (
  models: ModelOption[],
  mediaType: MediaType
): ModelOption | null => {
  try {
    return models.find(m =>
      modelSupportsModality(m.modalities, mediaType)
    ) ?? null;
  } catch (error) {
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
    return null;
  }
};

export function useAutoModelSwitch() {
  const { toast } = useToast();
  const setSelectedModel = useChatUIStore(state => state.setSelectedModel);
  const { data: catalogModels } = useModels({ gateway: 'all' });
  const availableModels = useMemo(
    () => (catalogModels ?? [])
      .filter(isCatalogModelSelectable)
      .map(mapCatalogModelToOption),
    [catalogModels]
  );

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
        const newModel = getMultimodalModel(availableModels, mediaType);
        if (!newModel) {
          toast({
            title: 'No compatible model available',
            description: `No live model currently advertises ${mediaType} input support.`,
            variant: 'destructive',
          });
          return false;
        }
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
        // Find a live catalog model that supports this media type.
        const newModel = getMultimodalModel(availableModels, mediaType);
        if (!newModel) {
          toast({
            title: 'No compatible model available',
            description: `No live model currently advertises ${mediaType} input support.`,
            variant: 'destructive',
          });
          return false;
        }

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
  }, [availableModels, setSelectedModel, toast]);

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
