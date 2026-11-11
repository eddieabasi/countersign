import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source.
  transpilePackages: ['@countersign/shared', '@countersign/widget'],
};

export default nextConfig;
