import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { VERDICT_SCOPE } from '@countersign/shared';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { Chain } from './merchant/verification.ts';
import { registerMerchantRoutes } from './routes/merchants.ts';

export type ServerDeps = { db?: Db | undefined; chain?: Chain | undefined };

export async function buildServer(cfg: Config, deps: ServerDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.VITEST ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: 1024 * 1024,
  });
  await app.register(cors, { origin: [cfg.WEB_PUBLIC_URL] });

  app.get('/healthz', async () => ({
    ok: true,
    network: cfg.CONCORDIUM_NETWORK,
    registry: {
      cis8004: `${cfg.CIS8004_CONTRACT_INDEX},${cfg.CIS8004_CONTRACT_SUBINDEX}`,
      cis8: `${cfg.CIS8_CONTRACT_INDEX},${cfg.CIS8_CONTRACT_SUBINDEX}`,
    },
    db: deps.db ? 'connected' : 'not configured',
    anchorAccount: deps.chain?.anchor.sender.address ?? null,
    scope: VERDICT_SCOPE,
  }));

  registerMerchantRoutes(app, { ...deps, resourceId: `${cfg.WEB_PUBLIC_URL}/console` });
  return app;
}
