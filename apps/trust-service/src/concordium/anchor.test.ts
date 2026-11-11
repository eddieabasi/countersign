import { describe, expect, it } from 'vitest';
import {
  REGISTER_DATA_MAX_BYTES,
  canonicalJson,
  decodeReceiptAnchor,
  encodeReceiptAnchor,
  sha256,
} from './anchor.ts';

describe('canonicalJson', () => {
  it('sorts keys recursively and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[2,{"y":2,"z":1}]},"b":1}',
    );
  });
  it('is stable regardless of key order', () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });
});

describe('receipt anchor', () => {
  const hash = sha256(canonicalJson({ id: 'rcpt_1', price: '10.00', currency: 'EURQ' }));

  it('round-trips through CBOR and fits in RegisterData', () => {
    const bytes = encodeReceiptAnchor(hash, { rid: 'rcpt_1' });
    expect(bytes.byteLength).toBeLessThanOrEqual(REGISTER_DATA_MAX_BYTES);
    const decoded = decodeReceiptAnchor(bytes);
    expect(decoded.type).toBe('CSTR');
    expect(decoded.version).toBe(1);
    expect(Buffer.from(decoded.hash).equals(Buffer.from(hash))).toBe(true);
    expect(decoded.public).toEqual({ rid: 'rcpt_1' });
  });

  it('encodes a Node Buffer hash as a CBOR byte string, not a JSON object', () => {
    const decoded = decodeReceiptAnchor(encodeReceiptAnchor(Buffer.from(hash)));
    expect(Buffer.from(decoded.hash).equals(Buffer.from(hash))).toBe(true);
  });

  it('refuses oversized public info and wrong hash length', () => {
    expect(() => encodeReceiptAnchor(hash, { big: 'x'.repeat(300) })).toThrow(/RegisterData max/);
    expect(() => encodeReceiptAnchor(new Uint8Array(16))).toThrow(/32 bytes/);
  });
});
