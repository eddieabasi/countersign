import { existsSync } from 'node:fs';
import { loadConfig } from './config.ts';
import { connectDb } from './db/client.ts';
import { createGrpcClient } from './concordium/grpc.ts';
import { loadAnchorAccount } from './concordium/wallet.ts';
import type { Chain } from './merchant/verification.ts';
import { buildServer } from './server.ts';

const cfg = loadConfig();

const db = cfg.DATABASE_URL ? (await connectDb(cfg.DATABASE_URL)).db : undefined;

let chain: Chain | undefined;
if (cfg.ANCHOR_WALLET_EXPORT_PATH && existsSync(cfg.ANCHOR_WALLET_EXPORT_PATH)) {
  chain = {
    grpc: createGrpcClient(cfg, 30_000),
    anchor: loadAnchorAccount(cfg.ANCHOR_WALLET_EXPORT_PATH),
  };
}

const app = await buildServer(cfg, { db, chain });
if (!db) app.log.warn('DATABASE_URL not set — merchant endpoints will return 503');
if (!chain) {
  app.log.warn(
    `anchor key not found at ${cfg.ANCHOR_WALLET_EXPORT_PATH ?? '(unset)'} — proof endpoints will return 503`,
  );
}

try {
  await app.listen({ port: cfg.TRUST_SERVICE_PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
