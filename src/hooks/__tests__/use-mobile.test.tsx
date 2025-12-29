import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  let mockMatchMedia: jest.Mock;
  let listeners: Array<(e: MediaQueryListEvent) => void> = [];

  beforeEach(() => {
    listeners = [];
    mockMatchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      }),
      removeEventListener: jest.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }),
      dispatchEvent: jest.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return false for desktop width', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should return true for mobile width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should update when window resizes', () => {
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      // Trigger the media query listener
      listeners.forEach((listener) => {
        listener({} as MediaQueryListEvent);
      });
    });

    expect(result.current).toBe(true);
  });

  it('should safely cleanup event listener even if mediaQuery is undefined', () => {
    // Mock a scenario where removeEventListener might be undefined
    const mockMQLWithoutRemove = {
      matches: false,
      media: '(max-width: 767px)',
      addEventListener: jest.fn(),
      removeEventListener: undefined, // Simulate missing method
    };

    mockMatchMedia.mockImplementation(() => mockMQLWithoutRemove);

    const { unmount } = renderHook(() => useIsMobile());

    // Should not throw when unmounting
    expect(() => unmount()).not.toThrow();
  });

  it('should safely cleanup even if mediaQuery becomes null', () => {
    let mql: any = {
      matches: false,
      media: '(max-width: 767px)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    mockMatchMedia.mockImplementation(() => mql);

    const { unmount } = renderHook(() => useIsMobile());

    // Simulate mediaQuery becoming null (edge case)
    mql = null;

    // Should not throw when unmounting
    expect(() => unmount()).not.toThrow();
  });

  it('should handle boundary case at exactly 768px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false); // 768 is desktop
  });

  it('should handle boundary case at 767px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 767,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true); // 767 is mobile
  });
});
