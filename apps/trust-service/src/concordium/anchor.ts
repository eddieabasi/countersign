import { createHash } from 'node:crypto';
import {
  AccountTransactionType,
  DataBlob,
  TransactionExpiry,
  TransactionKindString,
  TransactionSummaryType,
  cborDecode,
  cborEncode,
  signTransaction,
  type AccountTransaction,
  type BlockItemSummaryInBlock,
  type ConcordiumGRPCClient,
  type TransactionHash,
} from '@concordium/web-sdk';
import type { AnchorAccount } from './wallet.ts';

/** Concordium limits RegisterData payloads to 256 bytes. */
export const REGISTER_DATA_MAX_BYTES = 256;

/** Anchor tag for Countersign Trust Receipts (mirrors the SDK's `CCDVRA` / `CCDVAA` anchors). */
export const RECEIPT_ANCHOR_TYPE = 'CSTR';
export const RECEIPT_ANCHOR_VERSION = 1;

export type ReceiptAnchor = {
  type: typeof RECEIPT_ANCHOR_TYPE;
  version: typeof RECEIPT_ANCHOR_VERSION;
  /** SHA-256 of the canonical receipt JSON. */
  hash: Uint8Array;
  /** Small non-PII public info (e.g. receipt id). */
  public?: Record<string, string>;
};

/** Deterministic JSON: object keys sorted recursively, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 as a plain Uint8Array (not a Node Buffer — see encodeReceiptAnchor). */
export function sha256(data: string | Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

export function encodeReceiptAnchor(
  hash: Uint8Array,
  publicInfo?: Record<string, string>,
): Uint8Array {
  if (hash.byteLength !== 32) throw new Error('receipt hash must be 32 bytes');
  // web-sdk's cborEncode serialises a Node Buffer via toJSON() as {type:'Buffer',data:[…]}, not as
  // a CBOR byte string. Always copy into a plain Uint8Array first.
  const anchor: ReceiptAnchor = {
    type: RECEIPT_ANCHOR_TYPE,
    version: RECEIPT_ANCHOR_VERSION,
    hash: Uint8Array.from(hash),
  };
  if (publicInfo) anchor.public = publicInfo;
  const bytes = cborEncode(anchor);
  if (bytes.byteLength > REGISTER_DATA_MAX_BYTES) {
    throw new Error(
      `anchor is ${bytes.byteLength} bytes; RegisterData max is ${REGISTER_DATA_MAX_BYTES}`,
    );
  }
  return bytes;
}

export function decodeReceiptAnchor(bytes: Uint8Array): ReceiptAnchor {
  const v = cborDecode(bytes) as Partial<ReceiptAnchor> | null;
  if (!v || v.type !== RECEIPT_ANCHOR_TYPE || v.version !== RECEIPT_ANCHOR_VERSION) {
    throw new Error('not a Countersign receipt anchor');
  }
  if (!(v.hash instanceof Uint8Array) || v.hash.byteLength !== 32) {
    throw new Error('receipt anchor has no 32-byte hash');
  }
  return v as ReceiptAnchor;
}

/**
 * Submit a RegisterData transaction. Mirrors the web-sdk's own anchoring code in
 * `VerificationRequestV1.createAndAnchor` / `VerificationAuditRecordV1.registerAnchor`
 * (web-sdk 12.0.2), so receipts are anchored exactly like verification requests.
 */
export async function registerData(
  client: ConcordiumGRPCClient,
  { sender, signer }: AnchorAccount,
  data: Uint8Array,
): Promise<TransactionHash.Type> {
  if (data.byteLength > REGISTER_DATA_MAX_BYTES) throw new Error('RegisterData payload too large');
  const { nonce } = await client.getNextAccountNonce(sender);
  const transaction: AccountTransaction = {
    type: AccountTransactionType.RegisterData,
    header: { sender, nonce, expiry: TransactionExpiry.futureMinutes(60) },
    payload: {
      data: new DataBlob(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
      ),
    },
  };
  const signature = await signTransaction(transaction, signer);
  return client.sendAccountTransaction(transaction, signature);
}

/** Extract the registered bytes from a finalized RegisterData transaction outcome. */
export function registeredDataFromOutcome(outcome: BlockItemSummaryInBlock): Uint8Array {
  const { summary } = outcome;
  if (
    !summary ||
    summary.type !== TransactionSummaryType.AccountTransaction ||
    summary.transactionType !== TransactionKindString.RegisterData
  ) {
    throw new Error('transaction is not a successful RegisterData');
  }
  return Buffer.from(summary.dataRegistered.data, 'hex');
}
