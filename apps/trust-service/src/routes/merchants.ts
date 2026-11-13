import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/client.ts';
import {
  VerificationError,
  createProofRequest,
  getMerchant,
  verifyProof,
  type Chain,
} from '../merchant/verification.ts';

const ProofRequestBody = z.object({
  account: z.string().min(1),
  displayName: z.string().trim().min(2).max(80),
});
const ProofVerifyBody = z.object({
  sessionId: z.uuid(),
  presentation: z.record(z.string(), z.unknown()),
});

type Deps = { db?: Db | undefined; chain?: Chain | undefined; resourceId: string };

export function registerMerchantRoutes(app: FastifyInstance, deps: Deps): void {
  const unavailable = (reply: FastifyReply) => {
    if (!deps.db) {
      return reply
        .code(503)
        .send({ error: 'db_unavailable', message: 'DATABASE_URL not configured.' });
    }
    if (!deps.chain) {
      return reply.code(503).send({
        error: 'chain_unavailable',
        message: 'Anchoring account or Concordium node not configured.',
      });
    }
    return null;
  };

  const handle = async (reply: FastifyReply, fn: () => Promise<unknown>) => {
    try {
      return reply.send(await fn());
    } catch (e) {
      if (e instanceof VerificationError) {
        return reply.code(e.status).send({ error: e.code, message: e.message });
      }
      app.log.error(e);
      // Fail closed: chain/DB trouble is never reported as success.
      return reply
        .code(503)
        .send({ error: 'upstream_error', message: (e as Error).message ?? 'Unexpected error' });
    }
  };

  app.post('/merchants/proof-request', async (req, reply) => {
    const body = ProofRequestBody.safeParse(req.body);
    if (!body.success)
      return reply.code(400).send({ error: 'invalid_body', message: z.prettifyError(body.error) });
    const blocked = unavailable(reply);
    if (blocked) return blocked;
    return handle(reply, () =>
      createProofRequest(
        { db: deps.db as Db, chain: deps.chain as Chain, resourceId: deps.resourceId },
        body.data,
      ),
    );
  });

  app.post('/merchants/proof-verify', async (req, reply) => {
    const body = ProofVerifyBody.safeParse(req.body);
    if (!body.success)
      return reply.code(400).send({ error: 'invalid_body', message: z.prettifyError(body.error) });
    const blocked = unavailable(reply);
    if (blocked) return blocked;
    return handle(reply, () =>
      verifyProof({ db: deps.db as Db, chain: deps.chain as Chain }, body.data),
    );
  });

  app.get<{ Params: { account: string } }>('/merchants/:account', async (req, reply) => {
    if (!deps.db)
      return reply
        .code(503)
        .send({ error: 'db_unavailable', message: 'DATABASE_URL not configured.' });
    return handle(reply, async () => {
      const m = await getMerchant(deps.db as Db, req.params.account);
      if (!m)
        throw new VerificationError(
          404,
          'merchant_not_found',
          'No verified merchant for this account.',
        );
      return m;
    });
  });
}
