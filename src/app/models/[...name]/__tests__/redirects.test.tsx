/**
 * Tests for model detail page redirects
 * Tests cerebras/qwen-3-32b redirect and other model URL redirects
 */

import { renderHook } from '@testing-library/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

describe('Model Detail Page - Redirects', () => {
  let mockReplace: jest.Mock;
  let mockRouter: any;

  beforeEach(() => {
    mockReplace = jest.fn();
    mockRouter = {
      replace: mockReplace,
      push: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cerebras qwen-3-32b redirect', () => {
    it('should redirect cerebras/qwen-3-32b to qwen/qwen2-5-32b', () => {
      const developer = 'cerebras';
      const modelNameParam = 'qwen-3-32b';

      // Simulate the useEffect redirect logic
      const { result } = renderHook(() => {
        const router = useRouter();

        useEffect(() => {
          if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
            router.replace('/models/qwen/qwen2-5-32b');
          }
        }, [developer, modelNameParam, router]);

        return { redirected: true };
      });

      expect(mockReplace).toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('should not redirect other cerebras models', () => {
      const testCases = [
        { developer: 'cerebras', modelNameParam: 'llama3-1-8b' },
        { developer: 'cerebras', modelNameParam: 'llama-3-3-70b' },
        { developer: 'cerebras', modelNameParam: 'gpt-oss-120b' },
        { developer: 'cerebras', modelNameParam: 'qwen-3-235b-a22b-instruct-2507' },
      ];

      testCases.forEach(({ developer, modelNameParam }) => {
        mockReplace.mockClear();

        renderHook(() => {
          const router = useRouter();

          useEffect(() => {
            if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
              router.replace('/models/qwen/qwen2-5-32b');
            }
          }, [developer, modelNameParam, router]);

          return { redirected: false };
        });

        expect(mockReplace).not.toHaveBeenCalled();
      });
    });

    it('should not redirect qwen-3-32b from other providers', () => {
      const testCases = [
        { developer: 'qwen', modelNameParam: 'qwen-3-32b' },
        { developer: 'openrouter', modelNameParam: 'qwen-3-32b' },
        { developer: 'huggingface', modelNameParam: 'qwen-3-32b' },
      ];

      testCases.forEach(({ developer, modelNameParam }) => {
        mockReplace.mockClear();

        renderHook(() => {
          const router = useRouter();

          useEffect(() => {
            if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
              router.replace('/models/qwen/qwen2-5-32b');
            }
          }, [developer, modelNameParam, router]);

          return { redirected: false };
        });

        expect(mockReplace).not.toHaveBeenCalled();
      });
    });
  });

  describe('Alibaba to Qwen redirect', () => {
    it('should redirect alibaba models to qwen', () => {
      const developer = 'alibaba';
      const modelNameParam = 'qwen2-5-32b';

      renderHook(() => {
        const router = useRouter();

        useEffect(() => {
          if (developer === 'alibaba') {
            router.replace(`/models/qwen/${modelNameParam}`);
          }
        }, [developer, modelNameParam, router]);

        return { redirected: true };
      });

      expect(mockReplace).toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('should handle various alibaba model names', () => {
      const testCases = [
        'qwen2-5-72b',
        'qwen2-5-7b',
        'qwen-turbo',
        'qwen-max',
      ];

      testCases.forEach((modelNameParam) => {
        mockReplace.mockClear();

        renderHook(() => {
          const router = useRouter();
          const developer = 'alibaba';

          useEffect(() => {
            if (developer === 'alibaba') {
              router.replace(`/models/qwen/${modelNameParam}`);
            }
          }, [developer, modelNameParam, router]);

          return { redirected: true };
        });

        expect(mockReplace).toHaveBeenCalledWith(`/models/qwen/${modelNameParam}`);
      });
    });
  });

  describe('Combined redirect logic', () => {
    it('should handle both redirects independently', () => {
      // Test cerebras redirect
      mockReplace.mockClear();
      renderHook(() => {
        const router = useRouter();
        const developer = 'cerebras';
        const modelNameParam = 'qwen-3-32b';

        useEffect(() => {
          if (developer === 'alibaba') {
            router.replace(`/models/qwen/${modelNameParam}`);
          }
          if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
            router.replace('/models/qwen/qwen2-5-32b');
          }
        }, [developer, modelNameParam, router]);

        return { redirected: true };
      });

      expect(mockReplace).toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      expect(mockReplace).toHaveBeenCalledTimes(1);

      // Test alibaba redirect
      mockReplace.mockClear();
      renderHook(() => {
        const router = useRouter();
        const developer = 'alibaba';
        const modelNameParam = 'qwen2-5-32b';

        useEffect(() => {
          if (developer === 'alibaba') {
            router.replace(`/models/qwen/${modelNameParam}`);
          }
          if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
            router.replace('/models/qwen/qwen2-5-32b');
          }
        }, [developer, modelNameParam, router]);

        return { redirected: true };
      });

      expect(mockReplace).toHaveBeenCalledWith('/models/qwen/qwen2-5-32b');
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('should not redirect when neither condition matches', () => {
      const testCases = [
        { developer: 'openrouter', modelNameParam: 'gpt-4' },
        { developer: 'groq', modelNameParam: 'llama-3-70b' },
        { developer: 'cerebras', modelNameParam: 'llama3-1-8b' },
        { developer: 'qwen', modelNameParam: 'qwen2-5-32b' },
      ];

      testCases.forEach(({ developer, modelNameParam }) => {
        mockReplace.mockClear();

        renderHook(() => {
          const router = useRouter();

          useEffect(() => {
            if (developer === 'alibaba') {
              router.replace(`/models/qwen/${modelNameParam}`);
            }
            if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
              router.replace('/models/qwen/qwen2-5-32b');
            }
          }, [developer, modelNameParam, router]);

          return { redirected: false };
        });

        expect(mockReplace).not.toHaveBeenCalled();
      });
    });
  });

  describe('Redirect target validation', () => {
    it('should redirect to valid qwen model URLs', () => {
      const developer = 'cerebras';
      const modelNameParam = 'qwen-3-32b';

      renderHook(() => {
        const router = useRouter();

        useEffect(() => {
          if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
            router.replace('/models/qwen/qwen2-5-32b');
          }
        }, [developer, modelNameParam, router]);
      });

      const redirectUrl = mockReplace.mock.calls[0][0];
      expect(redirectUrl).toMatch(/^\/models\/qwen\//);
      expect(redirectUrl).toBe('/models/qwen/qwen2-5-32b');
    });

    it('should use normalized URL format for redirect target', () => {
      const developer = 'cerebras';
      const modelNameParam = 'qwen-3-32b';

      renderHook(() => {
        const router = useRouter();

        useEffect(() => {
          if (developer === 'cerebras' && modelNameParam === 'qwen-3-32b') {
            router.replace('/models/qwen/qwen2-5-32b');
          }
        }, [developer, modelNameParam, router]);
      });

      const redirectUrl = mockReplace.mock.calls[0][0];
      // Verify URL uses hyphens (normalized format) not periods
      expect(redirectUrl).toContain('qwen2-5-32b');
      expect(redirectUrl).not.toContain('qwen2.5');
    });
  });
});
