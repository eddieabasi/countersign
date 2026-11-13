import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConcordiumGRPCNodeClient } from '@concordium/web-sdk/nodejs';
import { loadConfig, type Config } from '../../src/config.ts';
import { createGrpcClient } from '../../src/concordium/grpc.ts';
import { loadAnchorAccount, type AnchorAccount } from '../../src/concordium/wallet.ts';

export const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'out');

export const cfg: Config = loadConfig();

export function heading(s: string): void {
  console.log(`\n=== ${s} ${'='.repeat(Math.max(0, 70 - s.length))}`);
}

export function kv(k: string, v: unknown): void {
  const val = typeof v === 'bigint' ? v.toString() : typeof v === 'string' ? v : JSON.stringify(v);
  console.log(`  ${k.padEnd(22)} ${val}`);
}

export function writeOut(name: string, data: unknown): string {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, name);
  writeFileSync(
    path,
    JSON.stringify(data, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v), 2),
  );
  return path;
}

export function explorerTx(hash: string): string {
  return `https://testnet.ccdscan.io/?dcount=1&dentity=transaction&dhash=${hash}`;
}

/** Connect and probe the node. Returns null (with a clear message) when gRPC is unreachable. */
export async function connectGrpc(): Promise<ConcordiumGRPCNodeClient | null> {
  const client = createGrpcClient(cfg, 10_000);
  try {
    const cs = await client.getConsensusStatus();
    kv('gRPC node', `${cfg.CONCORDIUM_GRPC_HOST}:${cfg.CONCORDIUM_GRPC_PORT}`);
    kv('last finalized', `${cs.lastFinalizedBlockHeight} (${cs.lastFinalizedBlock.toString()})`);
    return client;
  } catch (e) {
    console.log(
      `  ✗ gRPC unreachable (${cfg.CONCORDIUM_GRPC_HOST}:${cfg.CONCORDIUM_GRPC_PORT}): ${(e as Error).message}`,
    );
    console.log('    Run this spike from a machine/container that can reach the node over gRPC.');
    return null;
  }
}

/** Load the anchoring service account, or explain how to provide one. */
export function anchorAccountOrExplain(): AnchorAccount | null {
  if (!cfg.ANCHOR_WALLET_EXPORT_PATH) {
    console.log('  ✗ ANCHOR_WALLET_EXPORT_PATH not set — on-chain steps skipped.');
    console.log(
      '    Create a testnet account in the Concordium Browser Wallet, use "Request CCD",',
    );
    console.log('    export its keys (.export) and point ANCHOR_WALLET_EXPORT_PATH at the file.');
    return null;
  }
  if (!existsSync(cfg.ANCHOR_WALLET_EXPORT_PATH)) {
    console.log(`  ✗ anchor key file not found at ${cfg.ANCHOR_WALLET_EXPORT_PATH}`);
    console.log('    (relative paths in .env are resolved from the repo root)');
    return null;
  }
  const acct = loadAnchorAccount(cfg.ANCHOR_WALLET_EXPORT_PATH);
  kv('anchor key file', cfg.ANCHOR_WALLET_EXPORT_PATH);
  kv('anchor account', acct.sender.address);
  return acct;
}
