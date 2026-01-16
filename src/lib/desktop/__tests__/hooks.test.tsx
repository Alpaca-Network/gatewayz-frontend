/**
 * Tests for React Hooks for Tauri Desktop Integration
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useIsTauri,
  useAppVersion,
  usePlatformInfo,
  useDesktopUpdates,
  useDesktopNotification,
} from "../hooks";

// Mock the Tauri modules
jest.mock("../tauri", () => ({
  isTauri: jest.fn(() => false),
  getAppVersion: jest.fn(),
  getPlatformInfo: jest.fn(),
  checkForUpdates: jest.fn(),
  installUpdate: jest.fn(),
  showNotification: jest.fn(),
  onNewChat: jest.fn(() => Promise.resolve(() => {})),
  onCheckUpdates: jest.fn(() => Promise.resolve(() => {})),
  onAuthCallback: jest.fn(() => Promise.resolve(() => {})),
  registerDesktopShortcuts: jest.fn(),
}));

const mockTauri = require("../tauri");

describe("Desktop Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useIsTauri", () => {
    it("returns false initially", () => {
      mockTauri.isTauri.mockReturnValue(false);
      const { result } = renderHook(() => useIsTauri());
      expect(result.current).toBe(false);
    });

    it("returns true when in Tauri environment", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      const { result } = renderHook(() => useIsTauri());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });
  });

  describe("useAppVersion", () => {
    it("returns null initially", () => {
      mockTauri.getAppVersion.mockResolvedValue({
        version: "1.0.0",
        name: "test",
        tauri_version: "2.0.0",
      });

      const { result } = renderHook(() => useAppVersion());
      expect(result.current).toBeNull();
    });

    it("returns version after loading", async () => {
      const mockVersion = {
        version: "1.0.0",
        name: "gatewayz-desktop",
        tauri_version: "2.0.0",
      };
      mockTauri.getAppVersion.mockResolvedValue(mockVersion);

      const { result } = renderHook(() => useAppVersion());

      await waitFor(() => {
        expect(result.current).toEqual(mockVersion);
      });
    });
  });

  describe("usePlatformInfo", () => {
    it("returns null initially", () => {
      mockTauri.getPlatformInfo.mockResolvedValue({
        os: "macos",
        arch: "arm64",
        version: "14.0",
        hostname: "test-machine",
      });

      const { result } = renderHook(() => usePlatformInfo());
      expect(result.current).toBeNull();
    });

    it("returns platform info after loading", async () => {
      const mockInfo = {
        os: "macos",
        arch: "arm64",
        version: "14.0",
        hostname: "test-machine",
      };
      mockTauri.getPlatformInfo.mockResolvedValue(mockInfo);

      const { result } = renderHook(() => usePlatformInfo());

      await waitFor(() => {
        expect(result.current).toEqual(mockInfo);
      });
    });
  });

  describe("useDesktopUpdates", () => {
    it("returns initial state", () => {
      mockTauri.isTauri.mockReturnValue(false);
      const { result } = renderHook(() => useDesktopUpdates());

      expect(result.current).toEqual({
        updateInfo: null,
        isChecking: false,
        isInstalling: false,
        checkForUpdates: expect.any(Function),
        installUpdate: expect.any(Function),
        error: null,
      });
    });

    it("checks for updates when in Tauri environment", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.checkForUpdates.mockResolvedValue({
        available: true,
        version: "2.0.0",
        notes: "New features",
        date: "2026-01-13",
      });

      const { result } = renderHook(() => useDesktopUpdates());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      await waitFor(() => {
        expect(result.current.updateInfo).toEqual({
          available: true,
          version: "2.0.0",
          notes: "New features",
          date: "2026-01-13",
        });
      });
    });

    it("handles update check errors", async () => {
      mockTauri.isTauri.mockReturnValue(true);
      mockTauri.checkForUpdates.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useDesktopUpdates());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Network error");
      });
    });
  });

  describe("useDesktopNotification", () => {
    it("returns notification function", () => {
      const { result } = renderHook(() => useDesktopNotification());

      expect(result.current).toEqual({
        show: expect.any(Function),
        isSupported: expect.any(Boolean),
      });
    });

    it("shows notification when called", async () => {
      mockTauri.showNotification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDesktopNotification());

      await act(async () => {
        await result.current.show("Test Title", "Test Body");
      });

      expect(mockTauri.showNotification).toHaveBeenCalledWith(
        "Test Title",
        "Test Body",
        undefined
      );
    });
  });
});
