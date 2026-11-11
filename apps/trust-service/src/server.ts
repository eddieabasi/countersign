import Fastify, { type FastifyInstance } from 'fastify';
import { VERDICT_SCOPE } from '@countersign/shared';
import type { Config } from './config.ts';

export function buildServer(cfg: Config): FastifyInstance {
  const app = Fastify({
    logger: process.env.VITEST ? false : { level: process.env.LOG_LEVEL ?? 'info' },
  });

  app.get('/healthz', async () => ({
    ok: true,
    network: cfg.CONCORDIUM_NETWORK,
    registry: {
      cis8004: `${cfg.CIS8004_CONTRACT_INDEX},${cfg.CIS8004_CONTRACT_SUBINDEX}`,
      cis8: `${cfg.CIS8_CONTRACT_INDEX},${cfg.CIS8_CONTRACT_SUBINDEX}`,
    },
    scope: VERDICT_SCOPE,
  }));

  return app;
}
