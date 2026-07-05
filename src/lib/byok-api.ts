/**
 * BYOK (bring-your-own-key) API client.
 *
 * Talks to the backend provider-key endpoints so users can register their own
 * upstream provider keys. Plaintext keys are sent on write and never returned —
 * the list endpoint yields only the last 4 digits.
 *
 * Backend contract (gatewayz-backend src/routes/user_provider_keys.py):
 *   GET    /user/provider-keys                 -> { success, data: ProviderKey[], count }
 *   POST   /user/provider-keys                 body { provider_slug, api_key } -> { success, data }
 *   DELETE /user/provider-keys/{provider_slug} -> { success, provider_slug }
 *   GET    /gateways                           -> gateway registry (valid provider slugs)
 */

import { API_BASE_URL } from "@/lib/config";
import { makeAuthenticatedRequest } from "@/lib/api";

export interface ProviderKey {
  provider_slug: string;
  key_last4: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Gateway {
  id: string; // gateway slug — the value accepted as provider_slug
  name: string;
  logo_url?: string | null;
  site_url?: string | null;
}

async function readDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.detail || body?.message || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetch the valid gateways/providers a BYOK key can be registered for. The
 * backend validates provider_slug against this same registry, so the UI must
 * only offer these slugs.
 */
export async function getGateways(): Promise<Gateway[]> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/gateways`);
  if (!response.ok) {
    throw new Error(await readDetail(response, "Failed to load providers"));
  }
  const json = await response.json();
  // The endpoint may return an array or a wrapped object ({ gateways } / { data }).
  const list: unknown = Array.isArray(json)
    ? json
    : json?.gateways ?? json?.data ?? [];
  if (!Array.isArray(list)) return [];
  return (list as Array<Record<string, unknown>>)
    .filter((g) => typeof g?.id === "string" && g.id !== "all")
    .map((g) => ({
      id: g.id as string,
      name: (g.name as string) || (g.id as string),
      logo_url: (g.logo_url as string) ?? null,
      site_url: (g.site_url as string) ?? null,
    }));
}

/** List the caller's stored provider keys (masked — last4 only). */
export async function listProviderKeys(): Promise<ProviderKey[]> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/provider-keys`);
  if (!response.ok) {
    throw new Error(await readDetail(response, "Failed to load your provider keys"));
  }
  const json = await response.json();
  return Array.isArray(json?.data) ? (json.data as ProviderKey[]) : [];
}

/** Register (or replace) the caller's key for a provider. */
export async function addProviderKey(providerSlug: string, apiKey: string): Promise<void> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/provider-keys`, {
    method: "POST",
    body: JSON.stringify({ provider_slug: providerSlug, api_key: apiKey }),
  });
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error("Key storage is temporarily unavailable. Please try again later.");
    }
    if (response.status === 400) {
      throw new Error(await readDetail(response, `Unknown provider '${providerSlug}'`));
    }
    throw new Error(await readDetail(response, "Failed to save your key"));
  }
}

/** Remove the caller's key for a provider. */
export async function deleteProviderKey(providerSlug: string): Promise<void> {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/user/provider-keys/${encodeURIComponent(providerSlug)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(await readDetail(response, "Failed to remove your key"));
  }
}
