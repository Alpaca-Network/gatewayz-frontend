/**
 * Device Fingerprinting & Trust Management
 * Generates device fingerprints for device recognition and trust
 */

import * as Sentry from '@sentry/nextjs';

const DEVICE_ID_STORAGE_KEY = 'gatewayz_device_id';
const DEVICE_TRUST_STORAGE_KEY = 'gatewayz_device_trust';

export interface DeviceTrust {
  device_id: string;
  device_name: string;
  is_trusted: boolean;
  last_seen: number; // Unix timestamp
  fingerprint: string;
  metadata?: {
    os?: string;
    browser?: string;
    screen_resolution?: string;
    timezone?: string;
    language?: string;
  };
}

/**
 * Get browser fingerprinting data
 */
function getBrowserFingerprint(): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return {};
  }

  const screen = globalThis.screen;
  const navigator = globalThis.navigator;

  return {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen_width: screen.width,
    screen_height: screen.height,
    screen_color_depth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    available_cores: navigator.hardwareConcurrency,
  };
}

/**
 * Simple hash function for fingerprint
 * Not cryptographically secure - for device identification only
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = (hash << 5) - hash + char;
    // eslint-disable-next-line no-bitwise
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate device fingerprint
 */
export function generateDeviceFingerprint(): string {
  const fingerprint = getBrowserFingerprint();
  const fingerprintStr = JSON.stringify(fingerprint);
  const hash = simpleHash(fingerprintStr);

  // Combine hash with timestamp for uniqueness
  const timestamp = Date.now().toString(16);
  return `${hash}-${timestamp}`;
}

/**
 * Get or create device ID
 * Device ID persists across sessions for device recognition
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server-' + Date.now();
  }

  try {
    const storage = window.localStorage;
    let deviceId = storage.getItem(DEVICE_ID_STORAGE_KEY);

    if (!deviceId) {
      // Generate new device ID if not present
      const fingerprint = generateDeviceFingerprint();
      const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      deviceId = `device-${uuid}`;

      storage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
      console.log('[device-fingerprint] Created new device ID');
    }

    return deviceId;
  } catch (error) {
    console.warn('[device-fingerprint] Failed to get/create device ID:', error);
    // Fallback to runtime-only ID
    return `temp-${Date.now()}`;
  }
}

/**
 * Validate device fingerprint consistency
 * Returns true if fingerprint matches; false if changed (possible hijacking)
 */
export function validateDeviceFingerprint(previousFingerprint: string): boolean {
  const currentFingerprint = generateDeviceFingerprint();
  const fingerprintMatch = currentFingerprint === previousFingerprint;

  if (!fingerprintMatch) {
    console.warn('[device-fingerprint] Device fingerprint mismatch detected');
    Sentry.captureMessage('Device fingerprint mismatch', {
      level: 'warning',
      contexts: {
        device: {
          previous: previousFingerprint,
          current: currentFingerprint,
        },
      },
    });
  }

  return fingerprintMatch;
}

/**
 * Get device metadata for display/storage
 */
export function getDeviceMetadata() {
  const fingerprint = getBrowserFingerprint();

  return {
    os: identifyOS(fingerprint.user_agent as string),
    browser: identifyBrowser(fingerprint.user_agent as string),
    screen_resolution: `${fingerprint.screen_width}x${fingerprint.screen_height}`,
    timezone: fingerprint.timezone,
    language: fingerprint.language,
    is_mobile: identifyMobile(fingerprint.user_agent as string),
  };
}

/**
 * Generate human-readable device name
 */
export function generateDeviceName(): string {
  const metadata = getDeviceMetadata();
  const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `${metadata.browser} on ${metadata.os} (${timestamp})`;
}

/**
 * Save device trust information
 */
export function saveDeviceTrust(trust: DeviceTrust): void {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    storage.setItem(DEVICE_TRUST_STORAGE_KEY, JSON.stringify(trust));
  } catch (error) {
    console.warn('[device-fingerprint] Failed to save device trust:', error);
  }
}

/**
 * Get saved device trust information
 */
export function getDeviceTrust(): DeviceTrust | null {
  if (typeof window === 'undefined') return null;

  try {
    const storage = window.localStorage;
    const data = storage.getItem(DEVICE_TRUST_STORAGE_KEY);

    if (!data) return null;

    return JSON.parse(data) as DeviceTrust;
  } catch (error) {
    console.warn('[device-fingerprint] Failed to parse device trust:', error);
    return null;
  }
}

/**
 * Clear device trust information
 */
export function clearDeviceTrust(): void {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    storage.removeItem(DEVICE_TRUST_STORAGE_KEY);
  } catch (error) {
    console.warn('[device-fingerprint] Failed to clear device trust:', error);
  }
}

/**
 * Identify OS from user agent
 */
function identifyOS(userAgent: string): string {
  if (userAgent.indexOf('Windows') > -1) return 'Windows';
  if (userAgent.indexOf('Mac') > -1) return 'macOS';
  if (userAgent.indexOf('Linux') > -1) return 'Linux';
  if (userAgent.indexOf('Android') > -1) return 'Android';
  if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1) return 'iOS';
  return 'Unknown OS';
}

/**
 * Identify browser from user agent
 */
function identifyBrowser(userAgent: string): string {
  if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Chromium') < 0) return 'Chrome';
  if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') < 0) return 'Safari';
  if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
  if (userAgent.indexOf('Edge') > -1) return 'Edge';
  if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) return 'Opera';
  return 'Unknown Browser';
}

/**
 * Detect if device is mobile
 */
function identifyMobile(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

/**
 * Format device name for display
 * Example: "Chrome on macOS (Nov 25)"
 */
export function formatDeviceDisplay(): string {
  return generateDeviceName();
}
