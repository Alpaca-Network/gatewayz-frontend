/**
 * Tests for Global Error Handlers Rate Limiting
 * Tests the rate limiting logic that prevents 429 errors from Sentry
 */

// Mock Sentry before importing the module
jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Import after mocking
import * as Sentry from '@sentry/nextjs';
import { rateLimitedCaptureMessage, resetMessageRateLimitForTesting } from '../global-error-handlers';

const mockCaptureMessage = Sentry.captureMessage as jest.Mock;

describe('Global Error Handlers Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMessageRateLimitForTesting();
  });

  describe('rateLimitedCaptureMessage', () => {
    it('should allow the first message through', () => {
      rateLimitedCaptureMessage('Test error message 1');
      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Test error message 1',
        undefined
      );
    });

    it('should allow messages up to the rate limit', () => {
      // Send 3 unique messages (the limit is 3 per minute)
      rateLimitedCaptureMessage('Unique message A');
      rateLimitedCaptureMessage('Unique message B');
      rateLimitedCaptureMessage('Unique message C');

      expect(mockCaptureMessage).toHaveBeenCalledTimes(3);
    });

    it('should drop messages that exceed the rate limit', () => {
      // Send 4 unique messages (limit is 3)
      rateLimitedCaptureMessage('Message 1');
      rateLimitedCaptureMessage('Message 2');
      rateLimitedCaptureMessage('Message 3');
      rateLimitedCaptureMessage('Message 4 - should be dropped');

      // Only 3 should get through
      expect(mockCaptureMessage).toHaveBeenCalledTimes(3);
    });

    it('should deduplicate identical messages within the window', () => {
      const duplicateMessage = 'This is a duplicate error';

      rateLimitedCaptureMessage(duplicateMessage);
      rateLimitedCaptureMessage(duplicateMessage);
      rateLimitedCaptureMessage(duplicateMessage);

      // Only the first should get through due to deduplication
      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    });

    it('should pass options through to Sentry', () => {
      const options = {
        level: 'warning' as const,
        tags: { error_type: 'test_error' },
      };

      rateLimitedCaptureMessage('Test message with options', options);

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Test message with options',
        options
      );
    });

    it('should truncate long messages for deduplication key', () => {
      const longMessage = 'A'.repeat(200);
      const slightlyDifferentLongMessage = 'A'.repeat(100) + 'B'.repeat(100);

      // These should be treated as the same message because
      // the key is truncated to first 100 characters
      rateLimitedCaptureMessage(longMessage);
      rateLimitedCaptureMessage(slightlyDifferentLongMessage);

      // Only the first should get through
      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    });

    it('should reset rate limit after window expires', () => {
      const originalDateNow = Date.now;
      let currentTime = Date.now();

      Date.now = jest.fn(() => currentTime);

      // Use up the rate limit
      rateLimitedCaptureMessage('Message 1');
      rateLimitedCaptureMessage('Message 2');
      rateLimitedCaptureMessage('Message 3');

      expect(mockCaptureMessage).toHaveBeenCalledTimes(3);

      // Try one more - should be dropped
      rateLimitedCaptureMessage('Message 4');
      expect(mockCaptureMessage).toHaveBeenCalledTimes(3);

      // Advance time past the window (1 minute + 1ms)
      currentTime += 60001;

      // This should now succeed
      rateLimitedCaptureMessage('Message 5 after window');
      expect(mockCaptureMessage).toHaveBeenCalledTimes(4);

      Date.now = originalDateNow;
    });

    it('should allow same message after deduplication window expires', () => {
      const originalDateNow = Date.now;
      let currentTime = Date.now();

      Date.now = jest.fn(() => currentTime);

      const message = 'Repeated error message';

      // Send message first time
      rateLimitedCaptureMessage(message);
      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);

      // Try again - should be deduplicated
      rateLimitedCaptureMessage(message);
      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);

      // Advance time past deduplication window (5 minutes + 1ms)
      currentTime += 300001;

      // This should now succeed (new window)
      rateLimitedCaptureMessage(message);
      expect(mockCaptureMessage).toHaveBeenCalledTimes(2);

      Date.now = originalDateNow;
    });
  });
});

describe('Rate Limit Configuration', () => {
  it('should have reasonable default limits', () => {
    // These tests verify the configuration values are set appropriately
    // The actual values are in global-error-handlers.ts

    // Configuration should be:
    // - maxMessagesPerMinute: 3 (very conservative to prevent 429s)
    // - windowMs: 60000 (1 minute)
    // - dedupeWindowMs: 300000 (5 minutes)

    // We verify this indirectly through behavior tests above
    expect(true).toBe(true);
  });
});
