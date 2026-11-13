import { describe, expect, it } from 'vitest';
import { VERDICT_SCOPE } from '@countersign/shared';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRepoRoot, loadConfig } from './config.ts';
import { buildServer } from './server.ts';

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

  it('treats empty strings as unset', () => {
    expect(loadConfig({ ANCHOR_WALLET_EXPORT_PATH: '' }).ANCHOR_WALLET_EXPORT_PATH).toBeUndefined();
  });
});

describe('GET /healthz', () => {
  it('reports network, registry and the scope line', async () => {
    const app = buildServer(loadConfig({}));
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      network: 'testnet',
      registry: { cis8004: '12802,0', cis8: '12801,0' },
      scope: VERDICT_SCOPE,
    });
    await app.close();
  });
});
