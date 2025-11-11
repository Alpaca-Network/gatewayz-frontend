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

const nextConfig: NextConfig = {
  /* config options here */
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
    unoptimized: false,
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
      bodySizeLimit: '2mb',
    },
    // Fix for layout router mounting errors in Next.js 15
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  allowedDevOrigins: ["*.cloudworkstations.dev"],
  async redirects() {
    return [
      {
        source: '/deck',
        destination: 'https://www.canva.com/design/DAG2Dc4lQvI/P2ws7cdUnYAjdFxXpsKvUw/view?utm_content=DAG2Dc4lQvI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h20484be5f9',
        permanent: false,
      },
    ];
  },
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

    // Ignore warnings about require.extensions and module casing
    config.ignoreWarnings = [
      /require\.extensions is not supported by webpack/,
      /There are multiple modules with names that only differ in casing/,
    ];

    // Fix module casing issues on Windows
    config.snapshot = {
      ...config.snapshot,
      managedPaths: [],
    };

    return config;
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "alpaca-network",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

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
};

export default withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions
);
