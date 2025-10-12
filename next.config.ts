import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase body size limit for large PDF uploads (60-page PDFs)
  experimental: {
    // Vercel has a 4.5MB limit by default, increase to 50MB
    isrMemoryCacheSize: 0,
  },
  // Configure API routes
  serverRuntimeConfig: {
    bodySizeLimit: '50mb',
  },
};

export default nextConfig;

