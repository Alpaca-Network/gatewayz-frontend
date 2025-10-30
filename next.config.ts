import type {NextConfig} from 'next';

// Bundle analyzer for identifying heavy dependencies
// Run with: ANALYZE=true npm run build
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

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
          (resource) => {
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

export default withBundleAnalyzer(nextConfig);
