/**
 * Tests for Tauri Desktop Integration Utilities
 */

import {
  isTauri,
  isMacOS,
  isWindows,
  getAppVersion,
  getPlatformInfo,
  showNotification,
  openExternalUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getWindowState,
  toggleAlwaysOnTop,
  minimizeToTray,
} from "../tauri";

// Mock the Tauri API modules
jest.mock("@tauri-apps/api/core", () => ({
  invoke: jest.fn(),
}));

jest.mock("@tauri-apps/api/event", () => ({
  listen: jest.fn(() => Promise.resolve(() => {})),
  emit: jest.fn(() => Promise.resolve()),
}));

jest.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: jest.fn(() => ({
    show: jest.fn(() => Promise.resolve()),
    setFocus: jest.fn(() => Promise.resolve()),
    setTitle: jest.fn(() => Promise.resolve()),
  })),
}));

describe("Tauri Desktop Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isTauri", () => {
    it("returns false when __TAURI__ is not present", () => {
      expect(isTauri()).toBe(false);
    });

    it("returns true when __TAURI__ is present", () => {
      (global as any).__TAURI__ = {};
      expect(isTauri()).toBe(true);
      delete (global as any).__TAURI__;
    });
  });

  describe("isMacOS", () => {
    it("returns true when user agent contains Mac", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    it("returns false when user agent does not contain Mac", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        configurable: true,
      });
      expect(isMacOS()).toBe(false);
    });
  });

  describe("isWindows", () => {
    it("returns true when user agent contains Win", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        configurable: true,
      });
      expect(isWindows()).toBe(true);
    });

    it("returns false when user agent does not contain Win", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        configurable: true,
      });
      expect(isWindows()).toBe(false);
    });
  });

  describe("getAppVersion", () => {
    it("returns web version when not in Tauri", async () => {
      const version = await getAppVersion();
      expect(version).toEqual({
        version: expect.any(String),
        name: "gatewayz-web",
        tauri_version: "N/A",
      });
    });

    it("invokes Tauri command when in Tauri environment", async () => {
      (global as any).__TAURI__ = {};
      const { invoke } = require("@tauri-apps/api/core");
      invoke.mockResolvedValue({
        version: "1.0.0",
        name: "gatewayz-desktop",
        tauri_version: "2.0.0",
      });

      const version = await getAppVersion();
      expect(invoke).toHaveBeenCalledWith("get_app_version");
      expect(version).toEqual({
        version: "1.0.0",
        name: "gatewayz-desktop",
        tauri_version: "2.0.0",
      });

      delete (global as any).__TAURI__;
    });
  });

  describe("getPlatformInfo", () => {
    it("returns browser platform when not in Tauri", async () => {
      const info = await getPlatformInfo();
      expect(info).toEqual({
        os: expect.any(String),
        arch: "unknown",
        version: "unknown",
        hostname: "unknown",
      });
    });
  });

  describe("showNotification", () => {
    it("uses browser Notification API when not in Tauri", async () => {
      const mockNotification = jest.fn();
      (global as any).Notification = mockNotification;
      (global as any).Notification.permission = "granted";

      await showNotification("Test Title", "Test Body");

      expect(mockNotification).toHaveBeenCalledWith("Test Title", {
        body: "Test Body",
        icon: undefined,
      });
    });

    it("requests permission when not granted", async () => {
      const mockNotification = jest.fn();
      (global as any).Notification = mockNotification;
      (global as any).Notification.permission = "default";
      (global as any).Notification.requestPermission = jest
        .fn()
        .mockResolvedValue("granted");

      await showNotification("Test Title", "Test Body");

      expect(Notification.requestPermission).toHaveBeenCalled();
    });
  });

  describe("Auth Token Management (web fallback)", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("stores token in localStorage when not in Tauri", async () => {
      await setAuthToken("test-token");
      expect(localStorage.getItem("gatewayz_auth_token")).toBe("test-token");
    });

    it("retrieves token from localStorage when not in Tauri", async () => {
      localStorage.setItem("gatewayz_auth_token", "stored-token");
      const token = await getAuthToken();
      expect(token).toBe("stored-token");
    });

    it("clears token from localStorage when not in Tauri", async () => {
      localStorage.setItem("gatewayz_auth_token", "token-to-clear");
      await clearAuthToken();
      expect(localStorage.getItem("gatewayz_auth_token")).toBeNull();
    });
  });

  describe("Window State (web fallback)", () => {
    it("returns browser window dimensions when not in Tauri", async () => {
      Object.defineProperty(window, "innerWidth", {
        value: 1920,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 1080,
        configurable: true,
      });

      const state = await getWindowState();
      expect(state).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        maximized: false,
        fullscreen: false,
      });
    });
  });

  describe("toggleAlwaysOnTop", () => {
    it("logs warning when not in Tauri", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const result = await toggleAlwaysOnTop();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Always on top is only available in the desktop app"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("minimizeToTray", () => {
    it("blurs window when not in Tauri", async () => {
      const blurSpy = jest.spyOn(window, "blur").mockImplementation();
      await minimizeToTray();
      expect(blurSpy).toHaveBeenCalled();
      blurSpy.mockRestore();
    });
  });

  describe("openExternalUrl", () => {
    it("opens URL in new window when not in Tauri", async () => {
      const openSpy = jest.spyOn(window, "open").mockImplementation();
      await openExternalUrl("https://example.com");
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com",
        "_blank",
        "noopener,noreferrer"
      );
      openSpy.mockRestore();
    });
  });
});
