/**
 * Tests for network-utils
 * Network connectivity monitoring and handling
 */

import {
  networkMonitor,
  getNetworkStatus,
  waitForOnline,
  executeWithOfflineRetry,
} from '../network-utils';

describe('network-utils', () => {
  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
      configurable: true,
    });

    // Mock global fetch
    global.fetch = jest.fn();

    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should export a network monitor instance', () => {
      expect(networkMonitor).toBeDefined();
      expect(typeof networkMonitor.isOnline).toBe('boolean');
    });

    it('should initialize with online status', () => {
      expect(networkMonitor.isOnline).toBe(true);
    });
  });

  describe('getNetworkStatus', () => {
    it('should return current network status', () => {
      const status = getNetworkStatus();
      expect(typeof status).toBe('boolean');
    });
  });

  describe('Connection Events', () => {
    it('should detect when browser goes offline', () => {
      const callback = jest.fn();
      networkMonitor.subscribe(callback);

      // Simulate offline event
      window.dispatchEvent(new Event('offline'));

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should detect when browser comes online', () => {
      const callback = jest.fn();
      networkMonitor.subscribe(callback);

      // Simulate online event
      window.dispatchEvent(new Event('online'));

      expect(callback).toHaveBeenCalledWith(true);
    });
  });

  describe('Subscription Management', () => {
    it('should allow subscribing to connection changes', () => {
      const callback = jest.fn();
      const unsubscribe = networkMonitor.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop notifying after unsubscribe', () => {
      const callback = jest.fn();

      const unsubscribe = networkMonitor.subscribe(callback);
      unsubscribe();

      window.dispatchEvent(new Event('offline'));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('waitForOnline', () => {
    it('should resolve immediately if already online', async () => {
      const result = await waitForOnline(1000);
      expect(result).toBe(true);
    });
  });

  describe('executeWithOfflineRetry', () => {
    it('should execute function successfully when online', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await executeWithOfflineRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
