import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

const boolish = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const ConfigSchema = z.object({
  // Countersign is testnet-only until after the hackathon. Anything else is refused.
  CONCORDIUM_NETWORK: z
    .literal('testnet', { error: 'CONCORDIUM_NETWORK must be "testnet" (mainnet is not allowed)' })
    .default('testnet'),
  CONCORDIUM_GRPC_HOST: z.string().min(1).default('grpc.testnet.concordium.com'),
  CONCORDIUM_GRPC_PORT: z.coerce.number().int().positive().default(20000),
  CONCORDIUM_GRPC_TLS: boolish.default(true),

  CIS8004_CONTRACT_INDEX: z.coerce.number().int().nonnegative().default(12802),
  CIS8004_CONTRACT_SUBINDEX: z.coerce.number().int().nonnegative().default(0),
  CIS8_CONTRACT_INDEX: z.coerce.number().int().nonnegative().default(12801),
  CIS8_CONTRACT_SUBINDEX: z.coerce.number().int().nonnegative().default(0),

  AGENT_REGISTRY_API_URL: z.url().default('https://agent-registry-mcp.concordium.com'),
  ANCHOR_WALLET_EXPORT_PATH: z.string().min(1).optional(),
  /** Hosted deploys (Railway): the wallet export file's JSON content, stored as a secret variable. */
  ANCHOR_WALLET_EXPORT_JSON: z.string().min(1).optional(),

  TRUST_SERVICE_PORT: z.coerce.number().int().positive().default(4000),
  /** Public base URL of this service (Agent Card URLs, verify links). */
  TRUST_SERVICE_PUBLIC_URL: z.url().default('http://localhost:4000'),
  /** Public URL of the web app: CORS origin and the proof request's ResourceID. */
  WEB_PUBLIC_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  VERDICT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Nearest ancestor of `start` that holds `pnpm-workspace.yaml` (the repo root), else `start`. */
export function findRepoRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

/**
 * Parse config from env. Empty strings are treated as unset so `.env.example` copies work.
 * Relative file paths are resolved against the repo root (where `.env` lives), not the cwd —
 * pnpm runs package scripts from the package directory.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): Config {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  // Railway (and most hosts) inject PORT; it wins unless TRUST_SERVICE_PORT is set explicitly.
  if (cleaned.PORT && !cleaned.TRUST_SERVICE_PORT) cleaned.TRUST_SERVICE_PORT = cleaned.PORT;
  const parsed = ConfigSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const cfg = parsed.data;
  if (cfg.ANCHOR_WALLET_EXPORT_PATH && !isAbsolute(cfg.ANCHOR_WALLET_EXPORT_PATH)) {
    cfg.ANCHOR_WALLET_EXPORT_PATH = resolve(findRepoRoot(cwd), cfg.ANCHOR_WALLET_EXPORT_PATH);
  }
  return cfg;
}
