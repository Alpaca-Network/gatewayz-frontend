import { ProxyAgent } from 'undici';

/**
 * Creates a fetch function that respects HTTP_PROXY and HTTPS_PROXY environment variables
 * This is needed because Node.js's native fetch doesn't respect proxy environment variables
 */
export function createProxyFetch() {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;

  // If no proxy is configured, use native fetch
  if (!httpsProxy && !httpProxy) {
    return fetch;
  }

  // Create a proxy agent
  const proxyUrl = httpsProxy || httpProxy;
  if (!proxyUrl) {
    return fetch;
  }

  const dispatcher = new ProxyAgent({
    uri: proxyUrl,
  });

  // Return a wrapped fetch that uses the proxy agent
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    // Check if URL should bypass proxy (NO_PROXY)
    if (noProxy && typeof url === 'string') {
      const urlObj = new URL(url);
      const noProxyList = noProxy.split(',').map(h => h.trim().toLowerCase());

      for (const host of noProxyList) {
        if (host.startsWith('*.')) {
          // Wildcard domain matching
          const domain = host.substring(2);
          if (urlObj.hostname.endsWith(domain)) {
            return fetch(url, init);
          }
        } else if (urlObj.hostname === host) {
          return fetch(url, init);
        }
      }
    }

    // Use the proxy agent for the fetch
    return fetch(url, {
      ...init,
      // @ts-ignore - dispatcher is a valid option in undici
      dispatcher,
    });
  };
}

/**
 * Default proxy-aware fetch instance
 */
export const proxyFetch = createProxyFetch();
