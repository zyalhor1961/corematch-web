import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Enable standalone mode for Docker deployment
  async headers() {
    return [
      {
        // Apply security headers to all routes except static assets
        source: '/:path((?!_next/static).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  // Transpile react-pdf for proper CSS handling
  transpilePackages: ['react-pdf'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase body size limit for large PDF uploads (60-page PDFs)

  // Configure API routes
  serverRuntimeConfig: {
    bodySizeLimit: '50mb',
  },
};

export default nextConfig;

