/**
 * Tests for Desktop Authentication Utilities
 */

import {
  isDesktopAuthenticated,
  signOutDesktop,
  getDesktopAuthHeaders,
  createInitialDesktopAuthState,
} from "../auth";

// Mock the Tauri module
jest.mock("../tauri", () => ({
  isTauri: jest.fn(() => false),
  getAuthToken: jest.fn(),
  setAuthToken: jest.fn(),
  clearAuthToken: jest.fn(),
}));

const mockTauri = require("../tauri");

// Mock fetch
global.fetch = jest.fn();

// Mock crypto.getRandomValues
Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: jest.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

describe("Desktop Authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe("isDesktopAuthenticated", () => {
    it("returns false when not in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(false);
      const result = await isDesktopAuthenticated();
      expect(result).toBe(false);
    });

    it("returns false when no token is stored", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue(null);
      const result = await isDesktopAuthenticated();
      expect(result).toBe(false);
    });

    it("returns true when token is stored", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue("valid_token");
      const result = await isDesktopAuthenticated();
      expect(result).toBe(true);
    });
  });

  describe("signOutDesktop", () => {
    it("does nothing when not in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(false);
      await signOutDesktop();
      expect(mockTauri.clearAuthToken).not.toHaveBeenCalled();
    });

    it("clears token and notifies backend when in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.clearAuthToken.mockResolvedValue(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await signOutDesktop();

      expect(mockTauri.clearAuthToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/signout", {
        method: "POST",
      });
    });
  });

  describe("getDesktopAuthHeaders", () => {
    it("returns empty object when not in Tauri", async () => {
      mockTauri.isTauri.mockReturnValue(false);
      const headers = await getDesktopAuthHeaders();
      expect(headers).toEqual({});
    });

    it("returns empty object when no token", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue(null);
      const headers = await getDesktopAuthHeaders();
      expect(headers).toEqual({});
    });

    it("returns auth headers when token exists", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.getAuthToken.mockResolvedValue("bearer_token_123");
      const headers = await getDesktopAuthHeaders();
      expect(headers).toEqual({
        Authorization: "Bearer bearer_token_123",
        "X-Desktop-Client": "true",
      });
    });
  });

  describe("createInitialDesktopAuthState", () => {
    it("returns correct initial state", () => {
      const state = createInitialDesktopAuthState();
      expect(state).toEqual({
        isAuthenticated: false,
        isLoading: true,
        error: null,
        user: null,
      });
    });
  });
});
