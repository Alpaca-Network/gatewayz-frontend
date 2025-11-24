const STORAGE_TEST_KEY = "__gatewayz_storage_test__";
const CACHE_TTL_MS = 60_000;

let lastCheckResult: boolean | null = null;
let lastCheckAt = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const hasWindow = () => typeof window !== "undefined";

export function canUseLocalStorage(): boolean {
  if (!hasWindow()) {
    return false;
  }

  const now = Date.now();
  if (lastCheckResult === true && now - lastCheckAt < CACHE_TTL_MS) {
    return true;
  }

  try {
    const storage = window.localStorage;
    storage.setItem(STORAGE_TEST_KEY, "1");
    storage.removeItem(STORAGE_TEST_KEY);
    lastCheckResult = true;
    lastCheckAt = now;
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Storage] localStorage unavailable:", error);
    }
    lastCheckResult = false;
    lastCheckAt = now;
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

  return false;
}

function getSafeStorage(): Storage | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeLocalStorageGet(key: string): string | null {
  const storage = getSafeStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  const storage = getSafeStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(key: string): void {
  const storage = getSafeStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // noop
  }
}
