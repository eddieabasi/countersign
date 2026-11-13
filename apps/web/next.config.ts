import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Single .env at the repo root for every app. Next only reads apps/web/.env* by itself, so load
// the root file here (before compilation, so NEXT_PUBLIC_* values are inlined).
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source.
  transpilePackages: ['@countersign/shared', '@countersign/widget'],
};

export default nextConfig;
