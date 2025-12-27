import { render } from '@testing-library/react';
import {
  TwitterPixel,
  trackTwitterConversion,
  trackTwitterSignupClick,
  TWITTER_CONVERSION_EVENT_ID,
} from '../twitter-pixel';

// Mock next/script to capture the inline script
jest.mock('next/script', () => {
  return function MockScript({ dangerouslySetInnerHTML, id }: { dangerouslySetInnerHTML?: { __html: string }; id?: string }) {
    if (dangerouslySetInnerHTML) {
      // Execute the script content in our test environment
      try {
        // eslint-disable-next-line no-eval
        eval(dangerouslySetInnerHTML.__html);
      } catch {
        // Script execution may fail in test environment, that's ok
      }
    }
    return <script id={id} data-testid={id} />;
  };
});

describe('TwitterPixel', () => {
  beforeEach(() => {
    // Reset window.twq before each test
    delete (window as any).twq;
  });

  it('should render the Twitter pixel script', () => {
    const { getByTestId } = render(<TwitterPixel />);
    expect(getByTestId('twitter-pixel')).toBeInTheDocument();
  });

  it('should initialize twq function from inline script', () => {
    render(<TwitterPixel />);
    // The twq function should be created by the inline script
    expect(typeof (window as any).twq).toBe('function');
  });

  it('should have a queue array for early event calls', () => {
    render(<TwitterPixel />);
    const twq = (window as any).twq;
    expect(twq).toBeDefined();
    expect(Array.isArray(twq.queue)).toBe(true);
  });
});

describe('trackTwitterConversion', () => {
  beforeEach(() => {
    // Reset window.twq before each test
    delete (window as any).twq;
  });

  it('should not throw on server side (window undefined)', () => {
    const originalWindow = global.window;
    // @ts-ignore - intentionally setting window to undefined for SSR test
    delete (global as any).window;

    expect(() => trackTwitterConversion()).not.toThrow();

    // Restore window
    global.window = originalWindow;
  });

  it('should call twq with event when twq is available', () => {
    const mockTwq = jest.fn();
    (window as any).twq = mockTwq;

    trackTwitterConversion('test-event-id');

    expect(mockTwq).toHaveBeenCalledWith('event', 'test-event-id', {});
  });

  it('should use default event ID when none provided', () => {
    const mockTwq = jest.fn();
    (window as any).twq = mockTwq;

    trackTwitterConversion();

    expect(mockTwq).toHaveBeenCalledWith('event', TWITTER_CONVERSION_EVENT_ID, {});
  });

  it('should not throw if twq is not defined', () => {
    // twq is not defined
    expect(() => trackTwitterConversion()).not.toThrow();
  });

  it('should not throw if twq is not a function', () => {
    (window as any).twq = 'not a function';
    expect(() => trackTwitterConversion()).not.toThrow();
  });
});

describe('trackTwitterSignupClick', () => {
  beforeEach(() => {
    delete (window as any).twq;
  });

  it('should call trackTwitterConversion with signup event ID', () => {
    const mockTwq = jest.fn();
    (window as any).twq = mockTwq;

    trackTwitterSignupClick();

    expect(mockTwq).toHaveBeenCalledWith('event', TWITTER_CONVERSION_EVENT_ID, {});
  });

  it('should use the correct event ID for signups', () => {
    const mockTwq = jest.fn();
    (window as any).twq = mockTwq;

    trackTwitterSignupClick();

    expect(mockTwq).toHaveBeenCalledWith('event', 'tw-pwpwh-qxzjl', {});
  });
});

describe('TWITTER_CONVERSION_EVENT_ID', () => {
  it('should have the correct event ID format', () => {
    expect(TWITTER_CONVERSION_EVENT_ID).toBe('tw-pwpwh-qxzjl');
  });

  it('should start with tw- prefix', () => {
    expect(TWITTER_CONVERSION_EVENT_ID.startsWith('tw-')).toBe(true);
  });
});
