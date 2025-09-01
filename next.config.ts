import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    turbo: {
      rules: {
        "*.ts": ["ignore"],
        "*.tsx": ["ignore"]
      }
    }
  }
};

export default nextConfig;
