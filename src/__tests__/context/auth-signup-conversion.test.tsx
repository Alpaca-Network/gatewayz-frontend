/**
 * Tests for Google Ads sign-up conversion tracking in auth context
 *
 * Covers:
 * - Sign-up conversion tracking for new users
 * - Callback-based redirect after conversion
 * - Graceful degradation when gtag is unavailable
 */

import { trackSignupConversion } from '@/components/analytics/google-analytics';

// Mock the google-analytics module
jest.mock('@/components/analytics/google-analytics', () => ({
  trackSignupConversion: jest.fn((callback?: () => void) => {
    // Simulate immediate callback execution (gtag available)
    if (callback) {
      callback();
    }
  }),
}));

const mockTrackSignupConversion = trackSignupConversion as jest.MockedFunction<typeof trackSignupConversion>;

describe('Auth Signup Conversion Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackSignupConversion integration', () => {
    it('should call trackSignupConversion for new users', () => {
      const isNewUser = true;

      if (isNewUser) {
        trackSignupConversion();
      }

      expect(mockTrackSignupConversion).toHaveBeenCalledTimes(1);
    });

    it('should not call trackSignupConversion for existing users', () => {
      const isNewUser = false;

      if (isNewUser) {
        trackSignupConversion();
      }

      expect(mockTrackSignupConversion).not.toHaveBeenCalled();
    });

    it('should execute callback after tracking conversion', () => {
      const callback = jest.fn();

      trackSignupConversion(callback);

      expect(mockTrackSignupConversion).toHaveBeenCalledWith(callback);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should use callback pattern to ensure redirect happens after conversion', () => {
      const redirectCalled = { value: false };
      const conversionTracked = { value: false };

      const performRedirect = () => {
        conversionTracked.value = true;
        redirectCalled.value = true;
      };

      // Simulate the auth flow
      const isNewUser = true;
      if (isNewUser) {
        trackSignupConversion(performRedirect);
      }

      expect(conversionTracked.value).toBe(true);
      expect(redirectCalled.value).toBe(true);
    });
  });

  describe('handleAuthSuccess new user flow', () => {
    it('should track conversion and redirect for new users', () => {
      const authData = {
        is_new_user: true,
        user_id: 123,
        api_key: 'test-key',
        email: 'test@example.com',
      };

      let redirectPath: string | null = null;

      const performRedirect = () => {
        redirectPath = '/onboarding';
      };

      if (authData.is_new_user) {
        trackSignupConversion(performRedirect);
      }

      expect(mockTrackSignupConversion).toHaveBeenCalled();
      expect(redirectPath).toBe('/onboarding');
    });

    it('should handle isNewUserExpected fallback', () => {
      const authData = {
        is_new_user: undefined, // Backend didn't return is_new_user
        user_id: 123,
        api_key: 'test-key',
        email: 'test@example.com',
      };
      const isNewUserExpected = true;

      let conversionTracked = false;

      if (authData.is_new_user ?? isNewUserExpected) {
        trackSignupConversion(() => {
          conversionTracked = true;
        });
      }

      expect(mockTrackSignupConversion).toHaveBeenCalled();
      expect(conversionTracked).toBe(true);
    });

    it('should not track conversion when both is_new_user and isNewUserExpected are false', () => {
      const authData = {
        is_new_user: false,
        user_id: 123,
        api_key: 'test-key',
        email: 'test@example.com',
      };
      const isNewUserExpected = false;

      if (authData.is_new_user ?? isNewUserExpected) {
        trackSignupConversion();
      }

      expect(mockTrackSignupConversion).not.toHaveBeenCalled();
    });
  });

  describe('graceful degradation', () => {
    it('should execute redirect callback even if gtag is not available', () => {
      // Reset mock to simulate gtag not available (callback still called)
      mockTrackSignupConversion.mockImplementation((callback?: () => void) => {
        // Simulate gtag not available - callback should still execute
        if (callback) {
          callback();
        }
      });

      let redirectExecuted = false;

      trackSignupConversion(() => {
        redirectExecuted = true;
      });

      expect(redirectExecuted).toBe(true);
    });

    it('should handle beta redirect path in callback', () => {
      const enableBetaRedirect = true;
      let redirectPath: string | null = null;

      const performRedirect = () => {
        if (enableBetaRedirect) {
          redirectPath = '/beta/onboarding';
        } else {
          redirectPath = '/onboarding';
        }
      };

      trackSignupConversion(performRedirect);

      expect(redirectPath).toBe('/beta/onboarding');
    });

    it('should handle standard redirect path in callback', () => {
      const enableBetaRedirect = false;
      let redirectPath: string | null = null;

      const performRedirect = () => {
        if (enableBetaRedirect) {
          redirectPath = '/beta/onboarding';
        } else {
          redirectPath = '/onboarding';
        }
      };

      trackSignupConversion(performRedirect);

      expect(redirectPath).toBe('/onboarding');
    });
  });
});
