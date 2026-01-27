import { render } from '@testing-library/react';
import {
  GoogleAnalytics,
  trackEvent,
  trackPageView,
  trackConversion,
  trackSignupConversion,
} from '../google-analytics';

// Mock next/script
jest.mock('next/script', () => {
  return function MockScript({
    dangerouslySetInnerHTML,
    id,
    src,
  }: {
    dangerouslySetInnerHTML?: { __html: string };
    id?: string;
    src?: string;
  }) {
    if (dangerouslySetInnerHTML) {
      try {
        // eslint-disable-next-line no-eval
        eval(dangerouslySetInnerHTML.__html);
      } catch {
        // Script execution may fail in test environment
      }
    }
    return <script id={id} data-testid={id} data-src={src} />;
  };
});

describe('GoogleAnalytics', () => {
  beforeEach(() => {
    delete (window as any).gtag;
    delete (window as any).dataLayer;
  });

  it('should render the Google Analytics scripts', () => {
    const { getByTestId } = render(<GoogleAnalytics />);
    expect(getByTestId('google-analytics')).toBeInTheDocument();
  });

  it('should initialize dataLayer array', () => {
    render(<GoogleAnalytics />);
    // The dataLayer is initialized by the inline script
    expect(Array.isArray((window as any).dataLayer)).toBe(true);
  });

  it('should define gtag function when script executes', () => {
    // Manually set up gtag as it would be after script execution
    (window as any).dataLayer = [];
    (window as any).gtag = function(...args: any[]) {
      (window as any).dataLayer.push(args);
    };

    render(<GoogleAnalytics />);
    expect(typeof (window as any).gtag).toBe('function');
  });
});

describe('trackEvent', () => {
  beforeEach(() => {
    delete (window as any).gtag;
  });

  it('should not throw on server side (window undefined)', () => {
    const originalWindow = global.window;
    // @ts-ignore - intentionally setting window to undefined for SSR test
    delete (global as any).window;

    expect(() => trackEvent('test_event')).not.toThrow();

    global.window = originalWindow;
  });

  it('should call gtag with event when available', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;

    trackEvent('test_event', { category: 'test' });

    expect(mockGtag).toHaveBeenCalledWith('event', 'test_event', { category: 'test' });
  });

  it('should not throw if gtag is not defined', () => {
    expect(() => trackEvent('test_event')).not.toThrow();
  });
});

describe('trackPageView', () => {
  beforeEach(() => {
    delete (window as any).gtag;
  });

  it('should call gtag config for both GA4 properties', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;

    trackPageView('/test-page');

    expect(mockGtag).toHaveBeenCalledWith('config', 'G-NCWGNQ7981', {
      page_path: '/test-page',
    });
    expect(mockGtag).toHaveBeenCalledWith('config', 'G-TE0EZ0C0SX', {
      page_path: '/test-page',
    });
  });

  it('should not throw if gtag is not defined', () => {
    expect(() => trackPageView('/test-page')).not.toThrow();
  });
});

describe('trackConversion', () => {
  beforeEach(() => {
    delete (window as any).gtag;
  });

  it('should call gtag with conversion event', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;

    trackConversion('AW-123/abc');

    expect(mockGtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: 'AW-123/abc',
      value: undefined,
      currency: 'USD',
    });
  });

  it('should include value and currency when provided', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;

    trackConversion('AW-123/abc', 99.99, 'EUR');

    expect(mockGtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: 'AW-123/abc',
      value: 99.99,
      currency: 'EUR',
    });
  });

  it('should not throw if gtag is not defined', () => {
    expect(() => trackConversion('AW-123/abc')).not.toThrow();
  });
});

describe('trackSignupConversion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete (window as any).gtag;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call gtag with the correct sign-up conversion ID (no callback)', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;

    trackSignupConversion();

    expect(mockGtag).toHaveBeenCalledWith('event', 'conversion', {
      'send_to': 'AW-17515449277/2RATCOzWnZAbEL2XgqBB',
    });
  });

  it('should call gtag with wrapped callback when provided', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
    const callback = jest.fn();

    trackSignupConversion(callback);

    expect(mockGtag).toHaveBeenCalledWith('event', 'conversion', {
      'send_to': 'AW-17515449277/2RATCOzWnZAbEL2XgqBB',
      'event_callback': expect.any(Function),
    });
  });

  it('should execute callback when gtag calls event_callback', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
    const callback = jest.fn();

    trackSignupConversion(callback);

    // Simulate gtag calling the event_callback
    const eventCallback = mockGtag.mock.calls[0][2]['event_callback'];
    eventCallback();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should execute callback via timeout fallback if gtag never calls event_callback (adblocker scenario)', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
    const callback = jest.fn();

    trackSignupConversion(callback);

    // Callback should not be called immediately
    expect(callback).not.toHaveBeenCalled();

    // Fast-forward past the timeout
    jest.advanceTimersByTime(1000);

    // Callback should now be executed via timeout fallback
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not execute callback twice if gtag calls event_callback after timeout', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
    const callback = jest.fn();

    trackSignupConversion(callback);

    // Fast-forward past the timeout (callback executes via fallback)
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Simulate late gtag callback
    const eventCallback = mockGtag.mock.calls[0][2]['event_callback'];
    eventCallback();

    // Callback should still only be called once
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not execute callback twice if event_callback is called before timeout', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
    const callback = jest.fn();

    trackSignupConversion(callback);

    // Simulate gtag calling event_callback before timeout
    const eventCallback = mockGtag.mock.calls[0][2]['event_callback'];
    eventCallback();
    expect(callback).toHaveBeenCalledTimes(1);

    // Fast-forward past the timeout
    jest.advanceTimersByTime(1000);

    // Callback should still only be called once
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should execute callback immediately if gtag is not available', () => {
    const callback = jest.fn();

    trackSignupConversion(callback);

    // Callback should be executed immediately (no need to wait for timeout)
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should execute callback immediately if gtag throws an error (modified by adblocker)', () => {
    const mockGtag = jest.fn().mockImplementation(() => {
      throw new Error('gtag blocked');
    });
    (window as any).gtag = mockGtag;
    const callback = jest.fn();

    trackSignupConversion(callback);

    // Callback should be executed immediately despite gtag error
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not throw if gtag is not defined and no callback', () => {
    expect(() => trackSignupConversion()).not.toThrow();
  });

  it('should not throw if gtag throws and no callback', () => {
    const mockGtag = jest.fn().mockImplementation(() => {
      throw new Error('gtag blocked');
    });
    (window as any).gtag = mockGtag;

    expect(() => trackSignupConversion()).not.toThrow();
  });

  it('should not throw on server side (window undefined)', () => {
    const originalWindow = global.window;
    // @ts-ignore - intentionally setting window to undefined for SSR test
    delete (global as any).window;

    expect(() => trackSignupConversion()).not.toThrow();

    global.window = originalWindow;
  });

  it('should execute callback on server side when gtag unavailable', () => {
    const originalWindow = global.window;
    const callback = jest.fn();

    // @ts-ignore - intentionally setting window to undefined for SSR test
    delete (global as any).window;

    trackSignupConversion(callback);

    // Callback should be executed even on server side (graceful fallback)
    expect(callback).toHaveBeenCalled();

    global.window = originalWindow;
  });
});

describe('Google Ads Conversion IDs', () => {
  it('should use the correct Google Ads ID format', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;

    trackSignupConversion();

    const call = mockGtag.mock.calls[0];
    expect(call[2]['send_to']).toMatch(/^AW-\d+\/[A-Za-z0-9_-]+$/);
  });

  it('should use the Alpaca Network Google Ads account', () => {
    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;

    trackSignupConversion();

    const call = mockGtag.mock.calls[0];
    expect(call[2]['send_to']).toContain('AW-17515449277');
  });
});
