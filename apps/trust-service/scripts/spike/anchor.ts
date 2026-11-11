/**
 * Spike (c): anchor an audit record on testnet — the Trust Receipt evidence path.
 *
 *   pnpm spike:anchor [--dry-run]
 *
 * Builds a sample Trust Receipt, hashes its canonical JSON, wraps the hash in a CBOR
 * `{type:'CSTR', version:1, hash, public}` anchor (same pattern as the SDK's CCDVRA/CCDVAA anchors)
 * and registers it with a RegisterData transaction. Then reads the finalized transaction back and
 * confirms the on-chain bytes decode to the same hash.
 *
 * The ZK *verification* audit record (VAA, VerificationAuditRecordV1) needs a real presentation
 * and is covered by `pnpm spike:proof verify`.
 */
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { TransactionHash } from '@concordium/web-sdk';
import {
  canonicalJson,
  decodeReceiptAnchor,
  encodeReceiptAnchor,
  registerData,
  registeredDataFromOutcome,
  sha256,
} from '../../src/concordium/anchor.ts';
import { anchorAccountOrExplain, connectGrpc, explorerTx, heading, kv } from './_lib.ts';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });

heading('Trust Receipt (offline)');
const receiptId = `rcpt_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const salt = process.env.BUYER_REF_HASH_SALT ?? 'spike-salt';
const receipt = {
  id: receiptId,
  agentBadge: 'JyP9VYjZYJcQebdQ7ypD5',
  offer: { sku: 'DEMO-001', title: 'Demo widget', qty: 1 },
  price: '25.00',
  currency: 'EURQ',
  termsHash: Buffer.from(sha256('Returns within 14 days.')).toString('hex'),
  buyerRefHash: Buffer.from(sha256(`${salt}:buyer@example.invalid`)).toString('hex'),
  createdAt: new Date().toISOString(),
};
const hash = sha256(canonicalJson(receipt));
const anchor = encodeReceiptAnchor(hash, { rid: receiptId });
kv('receipt id', receiptId);
kv('receipt sha256', Buffer.from(hash).toString('hex'));
kv('anchor bytes', `${anchor.byteLength} / 256 (RegisterData max)`);
kv('anchor (cbor hex)', Buffer.from(anchor).toString('hex'));

if (values['dry-run']) {
  console.log('\nDRY RUN — not submitted.');
  process.exit(0);
}

heading('Register on testnet (RegisterData)');
const account = anchorAccountOrExplain();
const client = account ? await connectGrpc() : null;
if (!account || !client) {
  console.log('\nOFFLINE ONLY — anchor built, not submitted.');
  process.exit(0);
}
const tx = await registerData(client, account, anchor);
const txHex = TransactionHash.toHexString(tx);
kv('tx', txHex);
kv('explorer', explorerTx(txHex));
const outcome = await client.waitForTransactionFinalization(tx);
kv('finalized in block', outcome.blockHash.toString());
const onChain = decodeReceiptAnchor(registeredDataFromOutcome(outcome));
const match = Buffer.from(onChain.hash).equals(Buffer.from(hash));
kv('on-chain hash matches', match);
process.exit(match ? 0 : 1);
