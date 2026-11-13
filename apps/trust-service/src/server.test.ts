import { describe, expect, it } from 'vitest';
import { VERDICT_SCOPE } from '@countersign/shared';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRepoRoot, loadConfig } from './config.ts';
import { buildServer } from './server.ts';
import { createTestDb } from './db/test-db.ts';

describe('config', () => {
  it('defaults to testnet and the official testnet registry', () => {
    const cfg = loadConfig({});
    expect(cfg.CONCORDIUM_NETWORK).toBe('testnet');
    expect(cfg.CIS8004_CONTRACT_INDEX).toBe(12802);
    expect(cfg.CONCORDIUM_GRPC_TLS).toBe(true);
  });

  it('refuses mainnet', () => {
    expect(() => loadConfig({ CONCORDIUM_NETWORK: 'mainnet' })).toThrow(/testnet/);
  });

  it('resolves a relative key path from the repo root, not the package cwd (regression)', () => {
    const pkgDir = fileURLToPath(new URL('..', import.meta.url)); // apps/trust-service/
    const repoRoot = findRepoRoot(pkgDir);
    expect(repoRoot).toBe(resolve(pkgDir, '../..'));
    const cfg = loadConfig(
      { ANCHOR_WALLET_EXPORT_PATH: './secrets/anchor-account.export' },
      pkgDir,
    );
    expect(cfg.ANCHOR_WALLET_EXPORT_PATH).toBe(join(repoRoot, 'secrets', 'anchor-account.export'));
    expect(
      loadConfig({ ANCHOR_WALLET_EXPORT_PATH: '/abs/key.export' }, pkgDir)
        .ANCHOR_WALLET_EXPORT_PATH,
    ).toBe('/abs/key.export');
  });

  it("uses the host's PORT unless TRUST_SERVICE_PORT is set", () => {
    expect(loadConfig({ PORT: '8080' }).TRUST_SERVICE_PORT).toBe(8080);
    expect(loadConfig({ PORT: '8080', TRUST_SERVICE_PORT: '4000' }).TRUST_SERVICE_PORT).toBe(4000);
  });

  it('treats empty strings as unset', () => {
    expect(loadConfig({ ANCHOR_WALLET_EXPORT_PATH: '' }).ANCHOR_WALLET_EXPORT_PATH).toBeUndefined();
  });
});

describe('GET /healthz', () => {
  it('reports network, registry and the scope line', async () => {
    const app = await buildServer(loadConfig({}));
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      network: 'testnet',
      registry: { cis8004: '12802,0', cis8: '12801,0' },
      db: 'not configured',
      anchorAccount: null,
      scope: VERDICT_SCOPE,
    });
    await app.close();
  });
});

describe('merchant routes guards', () => {
  it('rejects a bad body before touching the chain', async () => {
    const app = await buildServer(loadConfig({}));
    const res = await app.inject({
      method: 'POST',
      url: '/merchants/proof-request',
      payload: { account: 'x', displayName: '' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('fails closed with 503 when DB or chain are not configured', async () => {
    const { db, close } = await createTestDb();
    const app = await buildServer(loadConfig({}), { db });
    const res = await app.inject({
      method: 'POST',
      url: '/merchants/proof-request',
      payload: {
        account: '3k3MRAXGqgS8b6FCa2MjX5adcowmf1LhEnd8xfHT4J7Jnse3k4',
        displayName: 'Ada Shop',
      },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: 'chain_unavailable' });
    const noDb = await (
      await buildServer(loadConfig({}))
    ).inject({
      method: 'GET',
      url: '/merchants/3k3MRAXGqgS8b6FCa2MjX5adcowmf1LhEnd8xfHT4J7Jnse3k4',
    });
    expect(noDb.statusCode).toBe(503);
    await app.close();
    await close();
  });

  it('returns 404 for an account with no verified merchant and 400 for a malformed one', async () => {
    const { db, close } = await createTestDb();
    const app = await buildServer(loadConfig({}), { db });
    const missing = await app.inject({
      method: 'GET',
      url: '/merchants/3k3MRAXGqgS8b6FCa2MjX5adcowmf1LhEnd8xfHT4J7Jnse3k4',
    });
    expect(missing.statusCode).toBe(404);
    const bad = await app.inject({ method: 'GET', url: '/merchants/not-an-account' });
    expect(bad.statusCode).toBe(400);
    await app.close();
    await close();
  });
});
