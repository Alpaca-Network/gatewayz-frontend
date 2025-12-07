import { render, waitFor, act } from '@testing-library/react';
import { PostHogProvider } from '../posthog-provider';
import posthog from 'posthog-js';

// Mock posthog
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  startSessionRecording: jest.fn(),
  capture: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/test'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

describe('PostHogProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset posthog mocks to default implementations
    (posthog.init as jest.Mock).mockImplementation(() => {});
    (posthog.startSessionRecording as jest.Mock).mockImplementation(() => {});
    (posthog.capture as jest.Mock).mockImplementation(() => {});

    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_POSTHOG_KEY: 'test-key',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://test-host.com',
    };

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop
    });

    // Mock requestIdleCallback
    (global as any).requestIdleCallback = jest.fn((cb) => setTimeout(cb, 0));
  });

  afterEach(() => {
    process.env = originalEnv;
    delete (global as any).requestIdleCallback;
  });

  it('should render children', () => {
    const { getByText } = render(
      <PostHogProvider>
        <div>Test Child</div>
      </PostHogProvider>
    );

    expect(getByText('Test Child')).toBeInTheDocument();
  });

  it('should initialize PostHog with correct config on desktop', async () => {
    render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledWith('test-key', expect.objectContaining({
        api_host: 'https://test-host.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
        disable_session_recording: false, // Desktop should enable recording
      }));
    });
  });

  it('should disable session recording on mobile', async () => {
    // Set mobile width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // Mobile
    });

    render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledWith('test-key', expect.objectContaining({
        disable_session_recording: true, // Mobile should disable recording
      }));
    });
  });

  it('should not initialize PostHog if env vars missing', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = '';

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    expect(posthog.init).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('PostHog environment variables not set');

    consoleWarnSpy.mockRestore();
  });

  it('should handle PostHog init errors gracefully', async () => {
    (posthog.init as jest.Mock).mockImplementation(() => {
      throw new Error('Init failed');
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to initialize PostHog:',
        expect.any(Error)
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('should start session recording on desktop with requestIdleCallback', async () => {
    jest.useFakeTimers();

    render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    // Fast-forward to trigger initialization (100ms delay in provider)
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Verify PostHog was initialized
    expect(posthog.init).toHaveBeenCalled();

    // Fast-forward all pending timers (requestIdleCallback setTimeout)
    act(() => {
      jest.runAllTimers();
    });

    // Session recording should be started
    expect(posthog.startSessionRecording).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should fallback to setTimeout if requestIdleCallback unavailable', async () => {
    delete (global as any).requestIdleCallback;

    jest.useFakeTimers();

    render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalled();
    });

    // Fast-forward timers
    jest.advanceTimersByTime(3000);

    jest.useRealTimers();
  });

  it('should not throw hydration errors', () => {
    // This test verifies the fix for the hydration error
    // by ensuring window.innerWidth is only accessed in useEffect (client-side)
    const { container } = render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    expect(container.innerHTML).toContain('Test');
    expect(posthog.init).not.toHaveBeenCalled(); // Should not be called during SSR
  });

  it('should handle session recording start errors gracefully', async () => {
    // Reset the init mock to succeed
    (posthog.init as jest.Mock).mockImplementation(() => {
      // Init succeeds without throwing
    });

    // Mock startSessionRecording to throw
    (posthog.startSessionRecording as jest.Mock).mockImplementation(() => {
      throw new Error('Recording failed');
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    jest.useFakeTimers();

    render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    // Fast-forward to trigger initialization (100ms delay in provider)
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(posthog.init).toHaveBeenCalled();

    // Fast-forward requestIdleCallback setTimeout(cb, 0)
    act(() => {
      jest.advanceTimersByTime(1);
    });

    // Verify the error was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to start PostHog session recording',
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should cleanup timeout on unmount', () => {
    jest.useFakeTimers();

    const { unmount } = render(
      <PostHogProvider>
        <div>Test</div>
      </PostHogProvider>
    );

    unmount();

    // Verify timeout is cleared by checking that init is not called
    jest.runAllTimers();
    expect(posthog.init).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
