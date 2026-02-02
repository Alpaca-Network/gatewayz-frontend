import type {NextConfig} from 'next';
import {withSentryConfig} from '@sentry/nextjs';

// Bundle analyzer for identifying heavy dependencies (optional)
// Install with: npm install --save-dev @next/bundle-analyzer
// Run with: ANALYZE=true npm run build
let withBundleAnalyzer = (config: NextConfig) => config;
try {
  if (process.env.ANALYZE === 'true') {
    withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: true,
      openAnalyzer: true,
    });
  }
} catch (e) {
  console.log('Bundle analyzer not installed. Install with: npm install --save-dev @next/bundle-analyzer');
}

// Check if we're building for static export (desktop app)
const isStaticExport = process.env.NEXT_STATIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  /* config options here */
  // Enable static export for desktop builds
  ...(isStaticExport && { output: 'export' }),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Disable image optimization for static export (desktop builds)
    unoptimized: isStaticExport,
  },
  // Enable compression
  compress: true,
  // Optimize production builds
  productionBrowserSourceMaps: false,
  // React optimization - disabled due to layout router mounting issues with providers
  reactStrictMode: false,
  // Optimize power preference
  poweredByHeader: false,
  experimental: {
    // Enable server-side chunking
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Fix for layout router mounting errors in Next.js 15
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  allowedDevOrigins: ["*.cloudworkstations.dev"],
  // Redirects and headers are not supported with static export (output: 'export')
  // Only include them when not building for desktop/static export
  ...(isStaticExport ? {} : {
    async redirects() {
      return [
        {
          source: '/deck',
          destination: 'https://www.canva.com/design/DAG2Dc4lQvI/P2ws7cdUnYAjdFxXpsKvUw/view?utm_content=DAG2Dc4lQvI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h20484be5f9',
          permanent: false,
        },
        {
          source: '/inbox',
          destination: 'https://terragon-www-production.up.railway.app/dashboard',
          permanent: false,
          has: [
            {
              type: 'host',
              value: 'beta.gatewayz.ai',
            },
          ],
        },
        {
          source: '/code',
          destination: 'https://terragon-www-production.up.railway.app/dashboard',
          permanent: false,
          has: [
            {
              type: 'host',
              value: 'beta.gatewayz.ai',
            },
          ],
        },
        {
          source: '/terragon',
          destination: 'https://terragon-www-production.up.railway.app/dashboard',
          permanent: false,
          has: [
            {
              type: 'host',
              value: 'beta.gatewayz.ai',
            },
          ],
        },
      ];
    },
    async headers() {
      // Common security headers (excluding frame-related headers which vary by route)
      const commonSecurityHeaders = [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          // Allow microphone for speech recognition on /chat, block geolocation and camera
          // microphone=(self) allows same-origin access needed for Web Speech API
          key: 'Permissions-Policy',
          value: 'geolocation=(), camera=(), microphone=(self)',
        },
      ];

      // Frame protection headers for routes that should NOT be embedded
      // Uses both X-Frame-Options (legacy) and CSP frame-ancestors (modern)
      const frameProtectionHeaders = [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          // CSP frame-ancestors is the modern replacement for X-Frame-Options
          // 'none' prevents this page from being embedded in any iframe
          key: 'Content-Security-Policy',
          value: "frame-ancestors 'none'",
        },
      ];

      return [
        {
          // Root path: Apply strict security headers including frame protection
          // Note: /:path patterns don't match root, so we need an explicit rule
          source: '/',
          headers: [
            ...commonSecurityHeaders,
            ...frameProtectionHeaders,
          ],
        },
        {
          // All other routes (except /agent): Apply strict security headers including X-Frame-Options: DENY
          // Using /:path* to match all paths including multi-segment paths like /api/health, /settings/account
          // IMPORTANT: Must come BEFORE /agent rule so /agent can override it
          source: '/:path*',
          headers: [
            ...commonSecurityHeaders,
            ...frameProtectionHeaders,
          ],
        },
        {
          // Agent page: Allow iframe embedding from any origin (page embeds external coding agent)
          // The agent page needs to embed external content and may receive postMessage from it
          // IMPORTANT: Must come LAST to override the /:path* rule above
          // In Next.js, when multiple rules match, the last one in the array wins
          source: '/agent',
          headers: [
            ...commonSecurityHeaders,
            // No X-Frame-Options or frame-ancestors CSP - allow embedding
          ],
        },
        {
          // Inbox page: Allow iframe embedding from trusted GatewayZ origins only
          // GatewayZ embeds this inbox page in an iframe and uses postMessage for SSO with terragon-oss
          // IMPORTANT: Must come LAST to override the /:path* rule above
          source: '/inbox',
          headers: [
            ...commonSecurityHeaders,
            {
              // Allow embedding only from trusted GatewayZ origins
              // Note: X-Frame-Options doesn't support multiple origins, so we use CSP frame-ancestors
              key: 'Content-Security-Policy',
              value: "frame-ancestors 'self' https://beta.gatewayz.ai https://gatewayz.ai https://www.gatewayz.ai https://inbox.gatewayz.ai",
            },
          ],
        },
      ];
    },
  }),
  webpack: (config, { isServer }) => {
    // Fix for Handlebars require.extensions issue
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      child_process: false,
      net: false,
      tls: false,
      dns: false,
    };

    // Handle module resolution for client-side
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        handlebars: false,
      };

      // Completely ignore node: protocol modules
      config.plugins = config.plugins || [];
      config.plugins.push(
        new (require('webpack')).NormalModuleReplacementPlugin(
          /^node:/,
          (resource: any) => {
            resource.request = resource.request.replace(/^node:/, '');
          }
        )
      );
    }

    // Ignore warnings about require.extensions, module casing, and sourcemaps
    config.ignoreWarnings = [
      /require\.extensions is not supported by webpack/,
      /There are multiple modules with names that only differ in casing/,
      /could not determine a source map reference/,
      /Could not auto-detect referenced sourcemap/,
    ];

    // Fix module casing issues on Windows
    config.snapshot = {
      ...config.snapshot,
      managedPaths: [],
    };

    // Suppress webpack "big strings" cache serialization warnings in build output
    // These warnings are informational and don't affect functionality
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: 'error',
    };

    return config;
  },
};

// Get release name for Sentry
const getReleaseName = () => {
  // In production/CI environments, use git commit as release identifier
  if (process.env.SENTRY_RELEASE) {
    return process.env.SENTRY_RELEASE;
  }

  // Try to use git commit SHA if available
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }

  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA;
  }

  // Fallback to package version
  try {
    const packageJson = require('./package.json');
    return `${packageJson.name}@${packageJson.version}`;
  } catch (e) {
    return undefined;
  }
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "alpaca-network",
  project: "javascript-nextjs",

  // Suppress all Sentry plugin logs during build (reduces noise in Vercel logs)
  silent: true,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,

  // Suppress source map upload warnings for client bundles where source maps are intentionally hidden
  sourcemaps: {
    // Don't fail the build if source maps can't be uploaded
    ignore: ['node_modules/**'],
    // Delete source maps after upload to clean up build artifacts
    filesToDeleteAfterUpload: ['**/*.js.map'],
  },

  // Release tracking
  // Automatically associates source maps with the release they were built for
  ...(getReleaseName() && { release: { name: getReleaseName() } }),
};

export default withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions
);
