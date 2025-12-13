import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { GATEWAYS, ACTIVE_GATEWAYS, GatewayConfig } from '@/lib/gateway-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// Cache for discovered gateways
let discoveredGatewaysCache: {
  gateways: string[];
  timestamp: number;
} | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Discover available gateways by probing the backend API
 * This fetches a small batch of models from each known gateway to verify availability
 */
async function discoverAvailableGateways(): Promise<string[]> {
  // Check cache first
  if (discoveredGatewaysCache && Date.now() - discoveredGatewaysCache.timestamp < CACHE_DURATION) {
    return discoveredGatewaysCache.gateways;
  }

  const availableGateways: string[] = [];
  const gatewayIds = ACTIVE_GATEWAYS.map(g => g.id);

  // Test each gateway in parallel with short timeout
  const results = await Promise.allSettled(
    gatewayIds.map(async (gatewayId) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(
          `${API_BASE_URL}/v1/models?gateway=${gatewayId}&limit=1`,
          {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            return { gatewayId, available: true };
          }
        }
        return { gatewayId, available: false };
      } catch {
        return { gatewayId, available: false };
      }
    })
  );

  // Collect available gateways
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.available) {
      availableGateways.push(result.value.gatewayId);
    }
  }

  // Update cache
  discoveredGatewaysCache = {
    gateways: availableGateways,
    timestamp: Date.now(),
  };

  return availableGateways;
}

/**
 * GET /api/gateways - List all available gateways
 *
 * Query params:
 * - discover=true: Probe backend to verify which gateways are actually available
 * - includeDeprecated=true: Include deprecated gateways in response
 *
 * Response includes:
 * - Full gateway configuration from registry
 * - Availability status (if discover=true)
 */
export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'GET /api/gateways',
    },
    async (span) => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const shouldDiscover = searchParams.get('discover') === 'true';
        const includeDeprecated = searchParams.get('includeDeprecated') === 'true';

        // Get base gateway list
        const baseGateways = includeDeprecated ? GATEWAYS : ACTIVE_GATEWAYS;

        // Optionally discover which gateways are actually available
        let availableGatewayIds: string[] | null = null;
        if (shouldDiscover) {
          availableGatewayIds = await discoverAvailableGateways();
        }

        // Build response with availability info
        const gatewaysWithStatus = baseGateways.map((gateway) => ({
          id: gateway.id,
          name: gateway.name,
          color: gateway.color,
          priority: gateway.priority,
          deprecated: gateway.deprecated || false,
          requiresApiKey: gateway.requiresApiKey || false,
          icon: gateway.icon,
          // Only include availability if discovery was requested
          ...(shouldDiscover && {
            available: availableGatewayIds?.includes(gateway.id) || false,
          }),
        }));

        // Sort: available first, then by priority (fast before slow)
        if (shouldDiscover) {
          gatewaysWithStatus.sort((a, b) => {
            // Available gateways first
            if (a.available !== b.available) {
              return a.available ? -1 : 1;
            }
            // Then by priority
            if (a.priority !== b.priority) {
              return a.priority === 'fast' ? -1 : 1;
            }
            return 0;
          });
        }

        span.setAttribute('gateway_count', gatewaysWithStatus.length);
        span.setAttribute('discovered', shouldDiscover);

        return NextResponse.json({
          gateways: gatewaysWithStatus,
          total: gatewaysWithStatus.length,
          availableCount: availableGatewayIds?.length,
          cached: discoveredGatewaysCache !== null && Date.now() - (discoveredGatewaysCache?.timestamp || 0) < CACHE_DURATION,
          source: 'registry', // Always from registry, discovery just adds availability
        });
      } catch (error) {
        console.error('[Gateways API] Error:', error);

        Sentry.captureException(error, {
          tags: {
            api_route: '/api/gateways',
          },
        });

        span.setAttribute('error', true);

        return NextResponse.json(
          { error: 'Failed to fetch gateways' },
          { status: 500 }
        );
      }
    }
  );
}

/**
 * POST /api/gateways/refresh - Force refresh gateway discovery cache
 *
 * Auth: Requires secret token (same as cache warming)
 */
export async function POST(request: NextRequest) {
  return Sentry.startSpan(
    {
      op: 'http.server',
      name: 'POST /api/gateways/refresh',
    },
    async (span) => {
      try {
        // Simple auth check
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.CACHE_WARMING_SECRET || 'default-secret-change-me';

        if (authHeader !== `Bearer ${expectedToken}`) {
          span.setAttribute('error', 'unauthorized');
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Clear cache and rediscover
        discoveredGatewaysCache = null;
        const availableGateways = await discoverAvailableGateways();

        span.setAttribute('discovered_count', availableGateways.length);

        return NextResponse.json({
          success: true,
          availableGateways,
          total: availableGateways.length,
          refreshedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[Gateways API] Refresh error:', error);

        Sentry.captureException(error);
        span.setAttribute('error', true);

        return NextResponse.json(
          { error: 'Failed to refresh gateways' },
          { status: 500 }
        );
      }
    }
  );
}
