import * as Sentry from "@sentry/nextjs";

const STORAGE_TEST_KEY = "__gatewayz_storage_test__";
const CACHE_TTL_MS = 60_000;

let lastLocalStorageCheckResult: boolean | null = null;
let lastLocalStorageCheckAt = 0;
let lastSessionStorageCheckResult: boolean | null = null;
let lastSessionStorageCheckAt = 0;

// In-memory fallback for when both localStorage and sessionStorage are unavailable
const memoryStorage = new Map<string, string>();
let hasLoggedMemoryFallback = false;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const hasWindow = () => typeof window !== "undefined";

/**
 * Check if localStorage is available and working
 */
export function canUseLocalStorage(): boolean {
  if (!hasWindow()) {
    return false;
  }

  const now = Date.now();
  if (lastLocalStorageCheckResult === true && now - lastLocalStorageCheckAt < CACHE_TTL_MS) {
    return true;
  }

  try {
    const storage = window.localStorage;
    storage.setItem(STORAGE_TEST_KEY, "1");
    storage.removeItem(STORAGE_TEST_KEY);
    lastLocalStorageCheckResult = true;
    lastLocalStorageCheckAt = now;
    return true;
  } catch (error) {
    // Log first occurrence to Sentry
    if (lastLocalStorageCheckResult !== false) {
      Sentry.captureMessage("localStorage unavailable - using fallback", {
        level: "warning",
        tags: {
          storage_error: "localstorage_unavailable",
        },
        extra: {
          error_message: error instanceof Error ? error.message : String(error),
        },
      });
    }
    lastLocalStorageCheckResult = false;
    lastLocalStorageCheckAt = now;
    return false;
  }
}

/**
 * Check if sessionStorage is available and working
 */
export function canUseSessionStorage(): boolean {
  if (!hasWindow()) {
    return false;
  }

  const now = Date.now();
  if (lastSessionStorageCheckResult === true && now - lastSessionStorageCheckAt < CACHE_TTL_MS) {
    return true;
  }

  try {
    const storage = window.sessionStorage;
    storage.setItem(STORAGE_TEST_KEY, "1");
    storage.removeItem(STORAGE_TEST_KEY);
    lastSessionStorageCheckResult = true;
    lastSessionStorageCheckAt = now;
    return true;
  } catch (error) {
    lastSessionStorageCheckResult = false;
    lastSessionStorageCheckAt = now;
    return false;
  }
}

export async function waitForLocalStorageAccess(options?: {
  attempts?: number;
  baseDelayMs?: number;
}): Promise<boolean> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 150;

  for (let i = 0; i < attempts; i++) {
    if (canUseLocalStorage()) {
      return true;
    }

    await wait(baseDelayMs * (i + 1));
  }

  // If localStorage isn't available after retries, check sessionStorage
  if (canUseSessionStorage()) {
    console.warn("[Storage] localStorage unavailable, sessionStorage available as fallback");
    return true; // We have some storage available
  }

  return false;
}

/**
 * Get the best available storage, with fallback chain:
 * 1. localStorage (preferred - persists across sessions)
 * 2. sessionStorage (fallback - persists for session only)
 * 3. null (no storage available - will use memory)
 */
function getBestAvailableStorage(): Storage | null {
  if (canUseLocalStorage()) {
    try {
      return window.localStorage;
    } catch {
      // Fall through to sessionStorage
    }
  }

  if (canUseSessionStorage()) {
    try {
      return window.sessionStorage;
    } catch {
      // Fall through to null
    }
  }

  return null;
}

/**
 * Log memory fallback usage once
 */
function logMemoryFallbackOnce(): void {
  if (hasLoggedMemoryFallback) {
    return;
  }
  hasLoggedMemoryFallback = true;
  console.warn("[Storage] Using in-memory storage fallback - data will not persist");
  Sentry.captureMessage("Using in-memory storage fallback", {
    level: "warning",
    tags: {
      storage_error: "memory_fallback",
    },
  });
}

/**
 * Safe storage get with fallback to sessionStorage and memory
 */
export function safeLocalStorageGet(key: string): string | null {
  const storage = getBestAvailableStorage();

  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to memory storage
    }
  }

  // Memory fallback
  return memoryStorage.get(key) ?? null;
}

/**
 * Safe storage set with fallback to sessionStorage and memory
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  const storage = getBestAvailableStorage();

  if (storage) {
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      // Fall through to memory storage
    }
  }

  // Memory fallback
  logMemoryFallbackOnce();
  memoryStorage.set(key, value);
  return true;
}

/**
 * Safe storage remove with fallback to sessionStorage and memory
 */
export function safeLocalStorageRemove(key: string): void {
  const storage = getBestAvailableStorage();

  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore errors
    }
  }

  // Also remove from memory storage in case it was set there
  memoryStorage.delete(key);
}

/**
 * Check what storage type is currently being used
 */
export function getStorageType(): "localStorage" | "sessionStorage" | "memory" | "none" {
  if (!hasWindow()) {
    return "none";
  }

  if (canUseLocalStorage()) {
    return "localStorage";
  }

  if (canUseSessionStorage()) {
    return "sessionStorage";
  }

  return "memory";
}

/**
 * Check if we're in a restricted storage environment (e.g., private browsing)
 */
export function isRestrictedStorageEnvironment(): boolean {
  if (!hasWindow()) {
    return false;
  }

  return !canUseLocalStorage() && !canUseSessionStorage();
}
