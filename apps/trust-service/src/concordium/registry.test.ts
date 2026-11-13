import { describe, expect, it } from 'vitest';
import { deserializeTypeValue } from '@concordium/web-sdk';
import { RegistryReadError, encodeTokenIdU64Param, normalizeAgentOf } from './registry.ts';

const none = { None: [] };
const some = <T>(v: T) => ({ Some: [v] });

// Shape follows the deployed CIS-8004 `agentOf` return schema (see docs/DECISIONS.md).
const hash = Array.from(
  Buffer.from('b884437caa91954653ce6d76a8fd7bad1153dc0a252178829fceb4d6caf1943b', 'hex'),
);
const activeView = {
  token_id: '5804000000000000',
  owner_account: '3mC9tNFNDhTLJNjHHEdrjkqvcCDLDbff1ceA1b9xah9cfxeCKA',
  status: { Active: [] },
  agent_uri: some('https://app.numberoneagent.co.uk/agents/4c985c7f.json'),
  metadata_hash: some(hash),
  agent_wallet: none,
  external_reference: none,
  on_chain_metadata: [],
  registered_at: '2026-11-11T16:08:12.924Z',
  revoked_at: none,
  revocation_reason: none,
};

describe('normalizeAgentOf', () => {
  it('returns null for None (agent not found)', () => {
    expect(normalizeAgentOf(none)).toBeNull();
  });

  it('normalises an active agent', () => {
    const r = normalizeAgentOf(some(activeView));
    expect(r).toEqual({
      tokenId: 1112n,
      owner: activeView.owner_account,
      status: 'Active',
      agentUri: 'https://app.numberoneagent.co.uk/agents/4c985c7f.json',
      metadataHashHex: 'b884437caa91954653ce6d76a8fd7bad1153dc0a252178829fceb4d6caf1943b',
      registeredAt: '2026-11-11T16:08:12.924Z',
    });
  });

  it('normalises a revoked agent with reason', () => {
    const r = normalizeAgentOf(
      some({
        ...activeView,
        status: { Revoked: [] },
        revoked_at: some('2026-06-01T00:00:00Z'),
        revocation_reason: some('compromised'),
      }),
    );
    expect(r?.status).toBe('Revoked');
    expect(r?.revokedAt).toBe('2026-06-01T00:00:00Z');
    expect(r?.revocationReason).toBe('compromised');
  });

  it('keeps absent uri/hash absent (so card check fails closed)', () => {
    const r = normalizeAgentOf(some({ ...activeView, agent_uri: none, metadata_hash: none }));
    expect(r?.agentUri).toBeUndefined();
    expect(r?.metadataHashHex).toBeUndefined();
  });

  it('throws on unknown encodings rather than guessing', () => {
    expect(() => normalizeAgentOf({ weird: true })).toThrow(RegistryReadError);
    expect(() => normalizeAgentOf(some({ ...activeView, status: { Paused: [] } }))).toThrow(
      RegistryReadError,
    );
  });
});

describe('normalizeAgentOf with real web-sdk decoder output', () => {
  // Build Option<[u8; 32]> with schema Type tags from concordium-contracts-common
  // (21 = Enum, 19 = Array, 2 = U8; field kinds 2 = none, 1 = unnamed) and decode it with the SDK,
  // so this test fails if the SDK's JSON shape for the registry's metadata_hash ever changes.
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  const str = (s: string) => [...u32(s.length), ...Buffer.from(s)];
  const optArray32 = [
    21,
    ...u32(2),
    ...str('None'),
    2,
    ...str('Some'),
    1,
    ...u32(1),
    19,
    ...u32(32),
    2,
  ];
  const ab = (u: number[]) => Uint8Array.from(u).buffer;

  it('accepts the BigInt byte array the SDK produces for metadata_hash (regression)', () => {
    const decodedHash: unknown = deserializeTypeValue(ab([1, ...hash]), ab(optArray32));
    const r = normalizeAgentOf(some({ ...activeView, metadata_hash: decodedHash }));
    expect(r?.metadataHashHex).toBe(
      'b884437caa91954653ce6d76a8fd7bad1153dc0a252178829fceb4d6caf1943b',
    );
  });

  it('accepts hex-string encodings (ByteArray schema)', () => {
    const hex = 'B884437CAA91954653CE6D76A8FD7BAD1153DC0A252178829FCEB4D6CAF1943B';
    expect(
      normalizeAgentOf(some({ ...activeView, metadata_hash: some(hex) }))?.metadataHashHex,
    ).toBe(hex.toLowerCase());
  });

  it('reports the offending value when bytes are malformed', () => {
    expect(() => normalizeAgentOf(some({ ...activeView, metadata_hash: some([999n]) }))).toThrow(
      /metadata_hash \(array: \["999n"\]\)/,
    );
  });
});

describe('encodeTokenIdU64Param', () => {
  it('is a 1-byte length prefix + u64 LE (CIS-2 TokenIdU64)', () => {
    expect(Buffer.from(encodeTokenIdU64Param(1112n)).toString('hex')).toBe('085804000000000000');
  });
});
