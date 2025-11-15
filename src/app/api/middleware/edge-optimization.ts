/**
 * Edge Runtime Optimizations
 * Configurations and helpers for running on Vercel Edge Runtime
 *
 * IMPORTANT: These optimizations apply to Edge Runtime routes
 * Edge Runtime has different constraints than Node.js runtime
 */

/**
 * Request/Response options optimized for Edge Runtime
 * Enables connection pooling and reduces cold start impact
 */
export const EDGE_RUNTIME_CONFIG = {
  // Connection options for better pooling
  keepAlive: true,
  keepAliveMsecs: 1000,

  // HTTP/2 Server Push for faster initial load (if supported)
  serverPushSupported: true,

  // Compression settings
  compressResponse: true,
  compressionThreshold: 1024, // Only compress > 1KB
};

/**
 * Optimized fetch options for Edge Runtime
 * Reduces cold starts and improves performance
 */
export function getOptimizedFetchOptions(): RequestInit {
  return {
    headers: {
      'Connection': 'keep-alive',
      'Cache-Control': 'public, max-age=300', // 5 minute cache
    },
  };
}

/**
 * Response caching strategies for Edge Runtime
 * Reduces backend load and speeds up responses
 */
export function getCacheHeaders(resource: 'model' | 'session' | 'config' | 'temporary') {
  const cacheStrategies = {
    model: 'public, max-age=3600', // 1 hour - models don't change often
    session: 'private, max-age=300', // 5 min - user specific
    config: 'public, max-age=1800', // 30 min - config relatively stable
    temporary: 'no-cache, no-store', // Immediate - dynamic content
  };

  return cacheStrategies[resource] || cacheStrategies.temporary;
}

/**
 * Lightweight response wrapper for Edge Runtime
 * Optimizes serialization and transmission size
 */
export function createEdgeOptimizedResponse<T>(
  data: T,
  options: {
    status?: number;
    cached?: boolean;
    ttl?: number; // Time to live in seconds
  } = {}
): Response {
  const { status = 200, cached = false, ttl = 300 } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Connection': 'keep-alive',
  };

  if (cached) {
    headers['Cache-Control'] = `public, max-age=${ttl}`;
    headers['X-Edge-Cache'] = 'HIT'; // Indicate cache was used
  } else {
    headers['Cache-Control'] = 'no-cache, no-store';
  }

  // Minimize JSON payload
  const json = JSON.stringify(data);

  return new Response(json, {
    status,
    headers,
  });
}

/**
 * Check if running on Edge Runtime
 */
export function isEdgeRuntime(): boolean {
  // Edge Runtime doesn't have Node.js APIs like fs, process, etc.
  return typeof process === 'undefined' ||
         typeof process.platform === 'undefined' ||
         process.platform === 'browser';
}

/**
 * Edge Runtime performance hints
 * Things to remember when writing Edge Runtime routes:
 *
 * 1. No file system access (no fs module)
 * 2. No Node.js-specific modules
 * 3. Keep bundle size small
 * 4. Use native Web APIs (fetch, crypto, etc.)
 * 5. Avoid heavy computations
 * 6. Cache responses when possible
 * 7. Use keep-alive for connections
 * 8. Minimize JSON payload size
 */

/**
 * Connection pool defaults for Edge Runtime
 * Improves performance on high-throughput endpoints
 */
export const CONNECTION_POOL_CONFIG = {
  // Maximum concurrent connections
  maxConnections: 100,

  // Connection timeout (Edge Runtime has limits)
  connectionTimeout: 30000, // 30 seconds max

  // Socket timeout
  socketTimeout: 25000, // 25 seconds (under Edge limit)

  // Enable TCP keep-alive
  keepAliveEnabled: true,

  // Keep-alive interval
  keepAliveInterval: 60000, // 60 seconds
};

/**
 * Get optimized streaming options for Edge Runtime
 * Edge Runtime has special requirements for streaming
 */
export function getStreamingOptions() {
  return {
    // Chunk size for streaming (smaller = faster first byte)
    chunkSize: 8192,

    // High water mark (buffer size)
    highWaterMark: 16384,

    // Enable chunked transfer encoding
    chunkedEncoding: true,

    // Flush frequency (ms) - more frequent = more responsive UI
    flushInterval: 100,
  };
}
