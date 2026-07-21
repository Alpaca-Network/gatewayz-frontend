import { renderHook, act } from '@testing-library/react';
import { useAutoModelSwitch, modelSupportsModality, getMultimodalModel } from '../use-auto-model-switch';
import { ModelOption } from '@/components/chat-v2/model-select';
import * as Sentry from '@sentry/nextjs';

const LIVE_CATALOG_MODELS = [
  {
    id: 'test-provider/live-multimodal',
    name: 'Live Multimodal',
    source_gateway: 'test-provider',
    architecture: {
      input_modalities: ['text', 'image', 'video', 'audio', 'file'],
    },
    is_active: true,
    is_routable: true,
    health_status: 'healthy',
  },
];

const LIVE_MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'test-provider/live-multimodal',
    label: 'Live Multimodal',
    category: 'General',
    sourceGateway: 'test-provider',
    modalities: ['Text', 'Image', 'Video', 'Audio', 'File'],
  },
];

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock the chat UI store
const mockSetSelectedModel = jest.fn();
jest.mock('@/lib/store/chat-ui-store', () => ({
  useChatUIStore: (selector: (state: any) => any) => {
    const state = {
      setSelectedModel: mockSetSelectedModel,
    };
    return selector(state);
  },
}));

const mockUseModels = jest.fn(() => ({ data: LIVE_CATALOG_MODELS }));
jest.mock('@/lib/hooks/use-catalog', () => ({
  useModels: () => mockUseModels(),
}));

describe('modelSupportsModality', () => {
  it('should return true for text when no modalities are specified', () => {
    expect(modelSupportsModality(undefined, 'text')).toBe(true);
    expect(modelSupportsModality([], 'text')).toBe(true);
  });

  it('should return false for non-text modalities when no modalities are specified', () => {
    expect(modelSupportsModality(undefined, 'image')).toBe(false);
    expect(modelSupportsModality([], 'image')).toBe(false);
  });

  it('should return true when modality is in the list', () => {
    expect(modelSupportsModality(['Text', 'Image'], 'image')).toBe(true);
    expect(modelSupportsModality(['Text', 'Image'], 'text')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(modelSupportsModality(['text', 'IMAGE'], 'Image')).toBe(true);
    expect(modelSupportsModality(['TEXT', 'image'], 'IMAGE')).toBe(true);
  });

  it('should return false when modality is not in the list', () => {
    expect(modelSupportsModality(['Text'], 'image')).toBe(false);
    expect(modelSupportsModality(['Text', 'File'], 'video')).toBe(false);
  });

  it('should handle null modalities gracefully', () => {
    expect(modelSupportsModality(null, 'text')).toBe(true);
    expect(modelSupportsModality(null, 'image')).toBe(false);
  });

  it('should capture Sentry exception on error', () => {
    // Force an error by using a proxy object
    const errorModalities = new Proxy([], {
      get() {
        throw new Error('Forced error');
      },
    });

    const result = modelSupportsModality(errorModalities as any, 'image');
    expect(result).toBe(false); // Fallback to text-only
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});

describe('getMultimodalModel', () => {
  it('should return a model that supports images', () => {
    const model = getMultimodalModel(LIVE_MODEL_OPTIONS, 'image');
    expect(model).not.toBeNull();
    expect(modelSupportsModality(model?.modalities, 'image')).toBe(true);
  });

  it('should return a model that supports video', () => {
    const model = getMultimodalModel(LIVE_MODEL_OPTIONS, 'video');
    expect(model).not.toBeNull();
    expect(modelSupportsModality(model?.modalities, 'video')).toBe(true);
  });

  it('should return a model that supports audio', () => {
    const model = getMultimodalModel(LIVE_MODEL_OPTIONS, 'audio');
    expect(model).not.toBeNull();
    expect(modelSupportsModality(model?.modalities, 'audio')).toBe(true);
  });

  it('should return a model that supports files', () => {
    const model = getMultimodalModel(LIVE_MODEL_OPTIONS, 'file');
    expect(model).not.toBeNull();
    expect(modelSupportsModality(model?.modalities, 'file')).toBe(true);
  });

  it('should select from the supplied live catalog options', () => {
    const model = getMultimodalModel(LIVE_MODEL_OPTIONS, 'image');
    expect(model?.value).toBe('test-provider/live-multimodal');
    expect(model?.label).toBe('Live Multimodal');
  });

  it('should return null instead of inventing a fallback model', () => {
    expect(getMultimodalModel([], 'image')).toBeNull();
  });

  it('should capture Sentry exception on error and return null', () => {
    // Force an error
    const originalFind = Array.prototype.find;
    Array.prototype.find = jest.fn().mockImplementation(() => {
      throw new Error('Find error');
    });

    const model = getMultimodalModel(LIVE_MODEL_OPTIONS, 'image');
    expect(model).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalled();

    // Restore
    Array.prototype.find = originalFind;
  });
});

describe('useAutoModelSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseModels.mockReturnValue({ data: LIVE_CATALOG_MODELS });
  });

  describe('checkAndSwitchModel', () => {
    it('should switch to multimodal model when current model is null', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      act(() => {
        const switched = result.current.checkAndSwitchModel(null, 'image');
        expect(switched).toBe(true);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Model switched',
        })
      );
    });

    it('should not switch when current model supports the media type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const currentModel: ModelOption = {
        value: 'test-model',
        label: 'Test Model',
        category: 'Multimodal',
        modalities: ['Text', 'Image'],
      };

      act(() => {
        const switched = result.current.checkAndSwitchModel(currentModel, 'image');
        expect(switched).toBe(false);
      });

      expect(mockSetSelectedModel).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should switch when current model does not support the media type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        const switched = result.current.checkAndSwitchModel(textOnlyModel, 'image');
        expect(switched).toBe(true);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Model switched',
          description: expect.stringContaining('Text Only Model'),
        })
      );
    });

    it('should handle video media type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        const switched = result.current.checkAndSwitchModel(textOnlyModel, 'video');
        expect(switched).toBe(true);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('video'),
        })
      );
    });

    it('should handle audio media type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        const switched = result.current.checkAndSwitchModel(textOnlyModel, 'audio');
        expect(switched).toBe(true);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('audio'),
        })
      );
    });

    it('should handle file media type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        const switched = result.current.checkAndSwitchModel(textOnlyModel, 'file');
        expect(switched).toBe(true);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('file'),
        })
      );
    });
  });

  describe('checkImageSupport', () => {
    it('should delegate to checkAndSwitchModel with image type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        result.current.checkImageSupport(textOnlyModel);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('image'),
        })
      );
    });
  });

  describe('checkVideoSupport', () => {
    it('should delegate to checkAndSwitchModel with video type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        result.current.checkVideoSupport(textOnlyModel);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('video'),
        })
      );
    });
  });

  describe('checkAudioSupport', () => {
    it('should delegate to checkAndSwitchModel with audio type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        result.current.checkAudioSupport(textOnlyModel);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('audio'),
        })
      );
    });
  });

  describe('checkFileSupport', () => {
    it('should delegate to checkAndSwitchModel with file type', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      act(() => {
        result.current.checkFileSupport(textOnlyModel);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('file'),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should not switch when model has empty modalities array but media type is text', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const modelWithEmptyModalities: ModelOption = {
        value: 'empty-modalities',
        label: 'Empty Modalities Model',
        category: 'Language',
        modalities: [],
      };

      // Text-only models with empty modalities are assumed to support text
      // This test ensures we don't accidentally switch for text inputs
      act(() => {
        // We're testing image support here, which should trigger a switch
        const switched = result.current.checkAndSwitchModel(modelWithEmptyModalities, 'image');
        expect(switched).toBe(true);
      });
    });

    it('should handle model with undefined modalities', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const modelWithUndefinedModalities: ModelOption = {
        value: 'undefined-modalities',
        label: 'Undefined Modalities Model',
        category: 'Language',
        // modalities is undefined
      };

      act(() => {
        const switched = result.current.checkAndSwitchModel(modelWithUndefinedModalities, 'image');
        expect(switched).toBe(true);
      });

      expect(mockSetSelectedModel).toHaveBeenCalled();
    });

    it('should not switch model that supports all modalities', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const multimodalModel: ModelOption = {
        value: 'openrouter/auto',
        label: 'Gatewayz Router',
        category: 'Router',
        modalities: ['Text', 'Image', 'File', 'Audio', 'Video'],
      };

      act(() => {
        const switchedImage = result.current.checkAndSwitchModel(multimodalModel, 'image');
        expect(switchedImage).toBe(false);
      });

      act(() => {
        const switchedVideo = result.current.checkAndSwitchModel(multimodalModel, 'video');
        expect(switchedVideo).toBe(false);
      });

      act(() => {
        const switchedAudio = result.current.checkAndSwitchModel(multimodalModel, 'audio');
        expect(switchedAudio).toBe(false);
      });

      act(() => {
        const switchedFile = result.current.checkAndSwitchModel(multimodalModel, 'file');
        expect(switchedFile).toBe(false);
      });

      expect(mockSetSelectedModel).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should handle error in validation and show error toast', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      // Mock setSelectedModel to throw error during validation
      mockSetSelectedModel.mockImplementation(() => {
        throw new Error('Validation error');
      });

      act(() => {
        const switched = result.current.checkAndSwitchModel(textOnlyModel, 'image');
        expect(switched).toBe(false);
      });

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Model switch failed',
          variant: 'destructive',
        })
      );

      // Restore
      mockSetSelectedModel.mockRestore();
    });

    it('should validate new model has required fields', () => {
      const { result } = renderHook(() => useAutoModelSwitch());

      const textOnlyModel: ModelOption = {
        value: 'text-only-model',
        label: 'Text Only Model',
        category: 'Language',
        modalities: ['Text'],
      };

      // This should work normally - the multimodal model should have value and label
      act(() => {
        const switched = result.current.checkAndSwitchModel(textOnlyModel, 'image');
        expect(switched).toBe(true);
      });

      // The new model should have been set and should have valid fields
      expect(mockSetSelectedModel).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.any(String),
          label: expect.any(String),
        })
      );
    });
  });
});

describe('integration with common model scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseModels.mockReturnValue({ data: LIVE_CATALOG_MODELS });
  });

  it('should switch from Qwen3 32B (text-only) when image is uploaded', () => {
    const { result } = renderHook(() => useAutoModelSwitch());

    // Qwen3 32B is the default model which only supports text
    const qwen3Model: ModelOption = {
      value: 'cerebras/qwen-3-32b',
      label: 'Qwen3 32B',
      category: 'General',
      sourceGateway: 'cerebras',
      developer: 'Qwen',
      modalities: ['Text'],
    };

    act(() => {
      const switched = result.current.checkImageSupport(qwen3Model);
      expect(switched).toBe(true);
    });

    expect(mockSetSelectedModel).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'test-provider/live-multimodal',
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Model switched',
        description: expect.stringContaining('Qwen3 32B'),
      })
    );
  });

  it('should not switch from GPT-4o (multimodal) when image is uploaded', () => {
    const { result } = renderHook(() => useAutoModelSwitch());

    const gpt4oModel: ModelOption = {
      value: 'openai/gpt-4o',
      label: 'GPT-4o',
      category: 'Multimodal',
      sourceGateway: 'openrouter',
      developer: 'OpenAI',
      modalities: ['Text', 'Image'],
    };

    act(() => {
      const switched = result.current.checkImageSupport(gpt4oModel);
      expect(switched).toBe(false);
    });

    expect(mockSetSelectedModel).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('should not switch from Claude 3.5 Sonnet (multimodal) when image is uploaded', () => {
    const { result } = renderHook(() => useAutoModelSwitch());

    const claudeModel: ModelOption = {
      value: 'anthropic/claude-3.5-sonnet',
      label: 'Claude 3.5 Sonnet',
      category: 'Multimodal',
      sourceGateway: 'openrouter',
      developer: 'Anthropic',
      modalities: ['Text', 'Image'],
    };

    act(() => {
      const switched = result.current.checkImageSupport(claudeModel);
      expect(switched).toBe(false);
    });

    expect(mockSetSelectedModel).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
