import { readFileSync } from 'node:fs';
import {
  AccountAddress,
  buildAccountSigner,
  parseWallet,
  type AccountSigner,
} from '@concordium/web-sdk';

export type AnchorAccount = { sender: AccountAddress.Type; signer: AccountSigner };

/**
 * Load the low-balance *service* account used only to pay for anchoring. Never a merchant key.
 * Refuses anything that is not a testnet export.
 */
export function loadAnchorAccount(path: string): AnchorAccount {
  return anchorAccountFromJson(readFileSync(path, 'utf8'));
}

/** Same as loadAnchorAccount, from the export file's JSON text (e.g. a secret env variable). */
export function anchorAccountFromJson(json: string): AnchorAccount {
  const wallet = parseWallet(json);
  if (wallet.environment.toLowerCase() !== 'testnet') {
    throw new Error(
      `Refusing to load a "${wallet.environment}" wallet export — Countersign is testnet-only.`,
    );
  }
  return {
    sender: AccountAddress.fromBase58(wallet.value.address),
    signer: buildAccountSigner(wallet),
  };
}
