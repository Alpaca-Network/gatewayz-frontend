type BasicStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

const FALLBACK_WARNING_PREFIX = "[Gatewayz] sessionStorage unavailable - using in-memory fallback.";
const fallbackStore = new Map<string, string>();
let hasWarned = false;

function warnOnce(error?: unknown) {
  if (hasWarned || typeof console === "undefined") {
    return;
  }
  hasWarned = true;
  console.warn(FALLBACK_WARNING_PREFIX, error);
}

function getNativeSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch (error) {
    warnOnce(error);
    return null;
  }
}

function setFallbackValue(key: string, value: string) {
  fallbackStore.set(key, value);
}

export const safeSessionStorage: BasicStorage = {
  getItem(key: string) {
    const nativeStorage = getNativeSessionStorage();

    if (nativeStorage) {
      try {
        return nativeStorage.getItem(key);
      } catch (error) {
        warnOnce(error);
      }
    }

    return fallbackStore.get(key) ?? null;
  },

  setItem(key: string, value: string) {
    const nativeStorage = getNativeSessionStorage();

    if (nativeStorage) {
      try {
        nativeStorage.setItem(key, value);
      } catch (error) {
        warnOnce(error);
      }
    }

    setFallbackValue(key, value);
  },

  removeItem(key: string) {
    const nativeStorage = getNativeSessionStorage();

    if (nativeStorage) {
      try {
        nativeStorage.removeItem(key);
      } catch (error) {
        warnOnce(error);
      }
    }

    fallbackStore.delete(key);
  },

  clear() {
    const nativeStorage = getNativeSessionStorage();

    if (nativeStorage) {
      try {
        nativeStorage.clear();
      } catch (error) {
        warnOnce(error);
      }
    }

    fallbackStore.clear();
  },
};
