import { existsSync } from 'node:fs';
import { loadConfig } from './config.ts';
import { connectDb } from './db/client.ts';
import { createGrpcClient } from './concordium/grpc.ts';
import { anchorAccountFromJson, loadAnchorAccount } from './concordium/wallet.ts';
import type { Chain } from './merchant/verification.ts';
import { buildServer } from './server.ts';

const cfg = loadConfig();

const db = cfg.DATABASE_URL ? (await connectDb(cfg.DATABASE_URL)).db : undefined;

// Anchor key: secret variable on hosted deploys, key file locally.
const anchor = cfg.ANCHOR_WALLET_EXPORT_JSON
  ? anchorAccountFromJson(cfg.ANCHOR_WALLET_EXPORT_JSON)
  : cfg.ANCHOR_WALLET_EXPORT_PATH && existsSync(cfg.ANCHOR_WALLET_EXPORT_PATH)
    ? loadAnchorAccount(cfg.ANCHOR_WALLET_EXPORT_PATH)
    : undefined;
const chain: Chain | undefined = anchor
  ? { grpc: createGrpcClient(cfg, 30_000), anchor }
  : undefined;

const app = await buildServer(cfg, { db, chain });
if (!db) app.log.warn('DATABASE_URL not set — merchant endpoints will return 503');
if (!chain) {
  app.log.warn(
    `no anchor key (set ANCHOR_WALLET_EXPORT_JSON, or a file at ${cfg.ANCHOR_WALLET_EXPORT_PATH ?? 'ANCHOR_WALLET_EXPORT_PATH'}) — proof endpoints will return 503`,
  );
}

try {
  await app.listen({ port: cfg.TRUST_SERVICE_PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
