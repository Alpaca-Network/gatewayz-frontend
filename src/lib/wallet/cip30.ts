// CIP-30 wallet discovery. Cardano browser wallets inject themselves under
// `window.cardano.<key>` with `{ name, icon, apiVersion, enable() }`; some
// inject one wallet under several keys (Eternl also as `ccvault`), so entries
// are de-duplicated by display name.
export interface Cip30WalletInfo {
  /** The window.cardano key passed to enable(). */
  key: string;
  name: string;
  icon: string | null;
}

/** Keys that are not wallets (CIP-95 helpers and similar). */
const NOT_WALLETS = new Set(['cip95', 'cip30', 'isBrowser']);

/** Preferred order for well-known wallets; the rest follow alphabetically. */
const PREFERRED = ['eternl', 'lace', 'nami', 'vespr', 'yoroi', 'typhoncip30', 'flint', 'gerowallet', 'nufi', 'begin'];

export function detectCip30Wallets(win: unknown = typeof window === 'undefined' ? undefined : window): Cip30WalletInfo[] {
  const cardano = (win as { cardano?: Record<string, unknown> } | undefined)?.cardano;
  if (!cardano || typeof cardano !== 'object') return [];
  const byName = new Map<string, Cip30WalletInfo>();
  for (const [key, value] of Object.entries(cardano)) {
    if (NOT_WALLETS.has(key) || !value || typeof value !== 'object') continue;
    const entry = value as { enable?: unknown; name?: unknown; icon?: unknown };
    if (typeof entry.enable !== 'function') continue;
    const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : key;
    const id = name.toLowerCase();
    // Keep the key that matches the wallet's own name when aliases collide.
    if (byName.has(id) && byName.get(id)?.key.toLowerCase() === id.replace(/\s+/g, '')) continue;
    byName.set(id, { key, name, icon: typeof entry.icon === 'string' ? entry.icon : null });
  }
  const rank = (w: Cip30WalletInfo) => {
    const i = PREFERRED.indexOf(w.key.toLowerCase());
    return i === -1 ? PREFERRED.length : i;
  };
  return [...byName.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** CIP-30 APIError code -3 / TxSignError code 2 / DataSignError code 3 mean "the user said no". */
export function isCip30Rejection(error: unknown): boolean {
  const e = error as { code?: unknown; info?: unknown; message?: unknown } | null;
  if (!e) return false;
  if (e.code === -3 || e.code === 2 || e.code === 3) return true;
  const text = `${typeof e.info === 'string' ? e.info : ''} ${typeof e.message === 'string' ? e.message : ''}`;
  return /reject|declin|denied|cancel/i.test(text);
}
