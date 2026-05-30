/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // We handle registration manually in service-worker-register.tsx
  skipWaiting: false, // We handle skipWaiting manually via SKIP_WAITING message
  disable: process.env.NODE_ENV === 'development',
  scope: '/',
  sw: 'sw.js',
  disableRuntimeCaching: false,
  disable: false,
  buildExcludes: [/app-build-manifest\.json$/], // Exclude problematic file from precaching
  runtimeCaching: [
    // JS/CSS
    {
      urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // Images
    {
      urlPattern: ({ request }) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Fonts (local and Google)
    {
      urlPattern: ({ url }) => url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 50, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ request }) => request.destination === 'font',
      handler: 'CacheFirst',
      options: {
        cacheName: 'local-fonts',
        expiration: { maxEntries: 50, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    // Next API routes that return mostly-static lists
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/api/items') || url.pathname.startsWith('/api/categories') || url.pathname.startsWith('/api/modifiers') || url.pathname.startsWith('/api/register') || url.pathname.startsWith('/api/taxes'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-static',
        expiration: { maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    // Supabase REST/storage endpoints
    {
      urlPattern: ({ url }) => /supabase\.co/.test(url.hostname),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase',
        networkTimeoutSeconds: 10,
        expiration: { maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    // Queue sales creation when offline
    {
      urlPattern: ({ url, request }) => url.pathname.startsWith('/api/receipts/create') && request.method === 'POST',
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'pos-receipts-create-queue',
          options: {
            maxRetentionTime: 24 * 60, // minutes (24h)
          },
        },
      },
    },
    // Queue refund operations when offline
    {
      urlPattern: ({ url, request }) => url.pathname.includes('/api/receipts/') && url.pathname.endsWith('/refund') && request.method === 'POST',
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'pos-receipts-refund-queue',
          options: {
            maxRetentionTime: 24 * 60, // minutes (24h)
          },
        },
      },
    },
  ],
  fallbacks: {
    document: '/offline.html',
  },
});

const path = require('path');

const nextConfig = {
  generateBuildId: async () => {
    // Force new build ID to bust cache
    return `build-${Date.now()}`;
  },
  webpack: (config, { isServer }) => {
    // Resolve @penkey/* packages directly from their local source (standalone app, no workspace)
    config.resolve.alias['@penkey/ui'] = path.resolve(__dirname, 'packages/ui/src/index.ts');
    config.resolve.alias['@penkey/database'] = path.resolve(__dirname, 'packages/database/src/index.ts');
    config.resolve.alias['@penkey/print-adapters'] = path.resolve(__dirname, 'packages/print-adapters/src/index.ts');
    config.resolve.alias['@penkey/sumup'] = path.resolve(__dirname, 'packages/sumup/src/index.ts');

    // Force all @radix-ui packages to resolve from penkey-pos/node_modules.
    // This prevents @penkey/ui's nested node_modules copies from being used,
    // which lack transitive dependencies like @radix-ui/primitive.
    const radixPackages = [
      '@radix-ui/primitive',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-slot',
      '@radix-ui/react-label',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-compose-refs',
      '@radix-ui/react-context',
      '@radix-ui/react-id',
      '@radix-ui/react-presence',
      '@radix-ui/react-primitive',
      '@radix-ui/react-use-controllable-state',
      '@radix-ui/react-use-previous',
      '@radix-ui/react-use-size',
      '@radix-ui/react-dismissable-layer',
      '@radix-ui/react-focus-scope',
      '@radix-ui/react-portal',
      '@radix-ui/react-popper',
      '@radix-ui/react-arrow',
      '@radix-ui/react-direction',
    ];

    radixPackages.forEach((pkg) => {
      try {
        config.resolve.alias[pkg] = require.resolve(pkg);
      } catch (e) {
        // Package not installed locally — skip alias
      }
    });

    return config;
  },
  reactStrictMode: true,
  transpilePackages: ["@penkey/ui", "@penkey/database", "@penkey/print-adapters", "@penkey/sumup"],
  images: {
    domains: ["localhost", "pub-2b39d98666004da3968c296f9fcf52d4.r2.dev"],
  },
  outputFileTracingRoot: __dirname,
  typescript: {
    // Skip type checking during build - types are checked in development
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during build
    ignoreDuringBuilds: true,
  },
  // ✅ SECURITY: Enforce HTTPS in production
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
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
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(self), payment=()',
          },
        ],
      },
    ];
  },
  // ✅ SECURITY: Redirect HTTP to HTTPS in production
  // NOTE: Disabled - Vercel handles HTTPS redirects automatically
  // The :host placeholder was causing ERR_INVALID_REDIRECT errors
  redirects: async () => {
    return [];
  },
};

module.exports = withPWA(nextConfig);
