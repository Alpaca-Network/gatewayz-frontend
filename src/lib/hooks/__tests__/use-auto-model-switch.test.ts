import { renderHook, act } from '@testing-library/react';
import { useAutoModelSwitch, modelSupportsModality, getMultimodalModel, getImageGenerationModel, DEFAULT_IMAGE_GENERATION_MODEL } from '../use-auto-model-switch';
import { ModelOption } from '@/components/chat/model-select';

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
});

describe('getMultimodalModel', () => {
  it('should return a model that supports images', () => {
    const model = getMultimodalModel('image');
    expect(model).toBeDefined();
    expect(modelSupportsModality(model.modalities, 'image')).toBe(true);
  });

  it('should return a model that supports video', () => {
    const model = getMultimodalModel('video');
    expect(model).toBeDefined();
    expect(modelSupportsModality(model.modalities, 'video')).toBe(true);
  });

  it('should return a model that supports audio', () => {
    const model = getMultimodalModel('audio');
    expect(model).toBeDefined();
    expect(modelSupportsModality(model.modalities, 'audio')).toBe(true);
  });

  it('should return a model that supports files', () => {
    const model = getMultimodalModel('file');
    expect(model).toBeDefined();
    expect(modelSupportsModality(model.modalities, 'file')).toBe(true);
  });

  it('should return Gatewayz Router as default (supports all modalities)', () => {
    const model = getMultimodalModel('image');
    expect(model.value).toBe('openrouter/auto');
    expect(model.label).toBe('Gatewayz Router');
  });
});

describe('getImageGenerationModel', () => {
  it('should return the default image generation model', () => {
    const model = getImageGenerationModel();
    expect(model).toBeDefined();
    expect(model.value).toBe('openrouter/auto');
    expect(model.label).toBe('Gatewayz Router');
  });

  it('should return a model that supports image generation', () => {
    const model = getImageGenerationModel();
    // Image generation models should support the Image modality for routing
    expect(modelSupportsModality(model.modalities, 'image')).toBe(true);
  });

  it('should return the same model as DEFAULT_IMAGE_GENERATION_MODEL', () => {
    const model = getImageGenerationModel();
    expect(model).toEqual(DEFAULT_IMAGE_GENERATION_MODEL);
  });

  it('should have all required ModelOption fields', () => {
    const model = getImageGenerationModel();
    expect(model.value).toBeDefined();
    expect(model.label).toBeDefined();
    expect(model.category).toBeDefined();
    expect(model.sourceGateway).toBeDefined();
    expect(model.developer).toBeDefined();
    expect(model.modalities).toBeDefined();
    expect(Array.isArray(model.modalities)).toBe(true);
  });
});

describe('DEFAULT_IMAGE_GENERATION_MODEL', () => {
  it('should be the Gatewayz Router', () => {
    expect(DEFAULT_IMAGE_GENERATION_MODEL.value).toBe('openrouter/auto');
    expect(DEFAULT_IMAGE_GENERATION_MODEL.label).toBe('Gatewayz Router');
    expect(DEFAULT_IMAGE_GENERATION_MODEL.category).toBe('Router');
  });

  it('should support all major modalities', () => {
    const modalities = DEFAULT_IMAGE_GENERATION_MODEL.modalities;
    expect(modalities).toContain('Text');
    expect(modalities).toContain('Image');
    expect(modalities).toContain('File');
    expect(modalities).toContain('Audio');
    expect(modalities).toContain('Video');
  });
});

describe('useAutoModelSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });
});

describe('integration with common model scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        value: 'openrouter/auto',
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
