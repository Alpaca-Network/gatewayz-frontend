/**
 * Tests for Guest Rate Limiter
 * Server-side rate limiting for guest (unauthenticated) chat requests
 */

import {
  getClientIP,
  checkGuestRateLimit,
  incrementGuestRateLimit,
  formatResetTime,
  getGuestDailyLimit,
  resetRateLimitForTesting,
  clearAllRateLimitsForTesting,
} from '../guest-rate-limiter';

// Mock Request object for testing getClientIP
function createMockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

describe('Guest Rate Limiter', () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    clearAllRateLimitsForTesting();
  });

  afterAll(() => {
    clearAllRateLimitsForTesting();
  });

  describe('getGuestDailyLimit', () => {
    it('should return the daily limit constant', () => {
      expect(getGuestDailyLimit()).toBe(3);
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      });
      expect(getClientIP(request)).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = createMockRequest({
        'x-real-ip': '10.20.30.40',
      });
      expect(getClientIP(request)).toBe('10.20.30.40');
    });

    it('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      const request = createMockRequest({
        'cf-connecting-ip': '203.0.113.50',
      });
      expect(getClientIP(request)).toBe('203.0.113.50');
    });

    it('should prioritize x-forwarded-for over other headers', () => {
      const request = createMockRequest({
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
        'cf-connecting-ip': '3.3.3.3',
      });
      expect(getClientIP(request)).toBe('1.1.1.1');
    });

    it('should return unknown-client when no IP headers present', () => {
      const request = createMockRequest({});
      expect(getClientIP(request)).toBe('unknown-client');
    });

    it('should handle empty header values', () => {
      const request = createMockRequest({
        'x-forwarded-for': '',
        'x-real-ip': '5.5.5.5',
      });
      expect(getClientIP(request)).toBe('5.5.5.5');
    });

    it('should extract IP from x-client-ip header', () => {
      const request = createMockRequest({
        'x-client-ip': '172.16.0.1',
      });
      expect(getClientIP(request)).toBe('172.16.0.1');
    });

    it('should extract IP from x-cluster-client-ip header', () => {
      const request = createMockRequest({
        'x-cluster-client-ip': '172.16.0.2',
      });
      expect(getClientIP(request)).toBe('172.16.0.2');
    });

    it('should extract IP from true-client-ip header', () => {
      const request = createMockRequest({
        'true-client-ip': '172.16.0.3',
      });
      expect(getClientIP(request)).toBe('172.16.0.3');
    });

    it('should skip "unknown" IP value and check next header', () => {
      const request = createMockRequest({
        'x-forwarded-for': 'unknown',
        'x-real-ip': '8.8.8.8',
      });
      expect(getClientIP(request)).toBe('8.8.8.8');
    });

    it('should handle whitespace in IP addresses', () => {
      const request = createMockRequest({
        'x-forwarded-for': '  192.168.1.1  ,  10.0.0.1  ',
      });
      expect(getClientIP(request)).toBe('192.168.1.1');
    });
  });

  describe('checkGuestRateLimit', () => {
    it('should allow requests when no previous requests made', () => {
      const result = checkGuestRateLimit('192.168.1.100');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.limit).toBe(3);
    });

    it('should return correct remaining count after some requests', () => {
      const ip = '192.168.1.101';

      // Make 2 requests
      for (let i = 0; i < 2; i++) {
        incrementGuestRateLimit(ip);
      }

      const result = checkGuestRateLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should not allow requests when limit exceeded', () => {
      const ip = '192.168.1.102';

      // Use all 3 requests
      for (let i = 0; i < 3; i++) {
        incrementGuestRateLimit(ip);
      }

      const result = checkGuestRateLimit(ip);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different IPs independently', () => {
      const ip1 = '192.168.1.103';
      const ip2 = '192.168.1.104';

      // Use 1 request for ip1
      incrementGuestRateLimit(ip1);

      // Use 2 requests for ip2
      for (let i = 0; i < 2; i++) {
        incrementGuestRateLimit(ip2);
      }

      expect(checkGuestRateLimit(ip1).remaining).toBe(2);
      expect(checkGuestRateLimit(ip2).remaining).toBe(1);
    });
  });

  describe('incrementGuestRateLimit', () => {
    it('should increment count and return success', () => {
      const ip = '192.168.1.105';

      const result = incrementGuestRateLimit(ip);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should return failure when limit exceeded', () => {
      const ip = '192.168.1.106';

      // Use all 3 requests
      for (let i = 0; i < 3; i++) {
        incrementGuestRateLimit(ip);
      }

      // 4th request should fail
      const result = incrementGuestRateLimit(ip);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should correctly track remaining count', () => {
      const ip = '192.168.1.107';

      for (let i = 2; i >= 0; i--) {
        const result = incrementGuestRateLimit(ip);
        expect(result.remaining).toBe(i);
      }
    });
  });

  describe('formatResetTime', () => {
    it('should format hours and minutes correctly', () => {
      const twoHours = 2 * 60 * 60 * 1000;
      expect(formatResetTime(twoHours)).toBe('2 hours and 0 minutes');
    });

    it('should format minutes only when less than an hour', () => {
      const thirtyMinutes = 30 * 60 * 1000;
      expect(formatResetTime(thirtyMinutes)).toBe('30 minutes');
    });

    it('should handle singular hour correctly', () => {
      const oneHourThirty = (1 * 60 + 30) * 60 * 1000;
      expect(formatResetTime(oneHourThirty)).toBe('1 hour and 30 minutes');
    });

    it('should handle singular minute correctly', () => {
      const oneMinute = 1 * 60 * 1000;
      expect(formatResetTime(oneMinute)).toBe('1 minute');
    });

    it('should handle zero minutes', () => {
      const zeroMinutes = 0;
      expect(formatResetTime(zeroMinutes)).toBe('0 minutes');
    });
  });

  describe('resetRateLimitForTesting', () => {
    it('should reset rate limit for a specific IP', () => {
      const ip = '192.168.1.108';

      // Use 2 requests
      for (let i = 0; i < 2; i++) {
        incrementGuestRateLimit(ip);
      }

      expect(checkGuestRateLimit(ip).remaining).toBe(1);

      // Reset the rate limit
      resetRateLimitForTesting(ip);

      expect(checkGuestRateLimit(ip).remaining).toBe(3);
    });

    it('should not affect other IPs', () => {
      const ip1 = '192.168.1.109';
      const ip2 = '192.168.1.110';

      // Use some requests for both IPs
      incrementGuestRateLimit(ip1);
      incrementGuestRateLimit(ip2);

      // Reset only ip1
      resetRateLimitForTesting(ip1);

      expect(checkGuestRateLimit(ip1).remaining).toBe(3);
      expect(checkGuestRateLimit(ip2).remaining).toBe(2);
    });
  });

  describe('clearAllRateLimitsForTesting', () => {
    it('should clear all rate limits', () => {
      const ips = ['10.0.0.1', '10.0.0.2', '10.0.0.3'];

      // Use requests for multiple IPs
      ips.forEach(ip => {
        for (let i = 0; i < 2; i++) {
          incrementGuestRateLimit(ip);
        }
      });

      // Verify they all have reduced limits
      ips.forEach(ip => {
        expect(checkGuestRateLimit(ip).remaining).toBe(1);
      });

      // Clear all
      clearAllRateLimitsForTesting();

      // Verify they all have full limits
      ips.forEach(ip => {
        expect(checkGuestRateLimit(ip).remaining).toBe(3);
      });
    });
  });

  describe('Window expiration', () => {
    it('should reset limit when window expires in checkGuestRateLimit', () => {
      const ip = '192.168.1.200';

      // Make 2 requests
      incrementGuestRateLimit(ip);
      incrementGuestRateLimit(ip);

      // Verify limit is reduced
      expect(checkGuestRateLimit(ip).remaining).toBe(1);

      // Mock time to simulate window expiration (24 hours later)
      const originalDateNow = Date.now;
      const startTime = Date.now();
      Date.now = jest.fn(() => startTime + 24 * 60 * 60 * 1000 + 1000); // 24 hours + 1 second

      // Check rate limit should show full limit again
      const result = checkGuestRateLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.resetInMs).toBe(24 * 60 * 60 * 1000); // Full 24 hours

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should reset limit when window expires in incrementGuestRateLimit', () => {
      const ip = '192.168.1.201';

      // Use all 3 requests
      for (let i = 0; i < 3; i++) {
        incrementGuestRateLimit(ip);
      }

      // Verify limit is exhausted
      expect(checkGuestRateLimit(ip).remaining).toBe(0);
      expect(checkGuestRateLimit(ip).allowed).toBe(false);

      // Mock time to simulate window expiration
      const originalDateNow = Date.now;
      const startTime = Date.now();
      Date.now = jest.fn(() => startTime + 24 * 60 * 60 * 1000 + 1000);

      // Increment should succeed with new window
      const result = incrementGuestRateLimit(ip);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2); // 3 - 1 = 2

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid sequential requests', () => {
      const ip = '192.168.1.111';

      // Make 3 rapid requests (the limit)
      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(incrementGuestRateLimit(ip));
      }

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(2 - index);
      });

      // 4th should fail
      const lastResult = incrementGuestRateLimit(ip);
      expect(lastResult.success).toBe(false);
    });

    it('should handle IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';

      const result = incrementGuestRateLimit(ipv6);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);

      expect(checkGuestRateLimit(ipv6).remaining).toBe(2);
    });

    it('should handle unknown-client identifier', () => {
      const unknownClient = 'unknown-client';

      const result = incrementGuestRateLimit(unknownClient);
      expect(result.success).toBe(true);

      // This effectively means all requests without IP share a limit
      // which is a fail-safe behavior
      expect(checkGuestRateLimit(unknownClient).remaining).toBe(2);
    });
  });
});
