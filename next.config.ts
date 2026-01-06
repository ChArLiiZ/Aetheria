import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Removed 'output: export' to support dynamic routes
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
