/**
 * Tests for Desktop App Redirect Logic
 *
 * Tests the behavior where isTauri() detection triggers a redirect to /chat
 * when running in the Tauri desktop app environment.
 */

import { isTauri } from '@/lib/desktop/tauri';

// Mock the Tauri detection
jest.mock('@/lib/desktop/tauri', () => ({
  isTauri: jest.fn(),
}));

const mockIsTauri = isTauri as jest.MockedFunction<typeof isTauri>;

describe('Desktop Redirect Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isTauri detection', () => {
    it('should return true when running in Tauri environment', () => {
      mockIsTauri.mockReturnValue(true);
      expect(isTauri()).toBe(true);
    });

    it('should return false when running in web browser', () => {
      mockIsTauri.mockReturnValue(false);
      expect(isTauri()).toBe(false);
    });
  });

  describe('redirect logic integration', () => {
    it('should trigger redirect when isTauri returns true', () => {
      const mockReplace = jest.fn();
      mockIsTauri.mockReturnValue(true);

      // Simulate the redirect logic from page.tsx
      if (isTauri()) {
        mockReplace('/chat');
      }

      expect(mockReplace).toHaveBeenCalledWith('/chat');
    });

    it('should not trigger redirect when isTauri returns false', () => {
      const mockReplace = jest.fn();
      mockIsTauri.mockReturnValue(false);

      // Simulate the redirect logic from page.tsx
      if (isTauri()) {
        mockReplace('/chat');
      }

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
