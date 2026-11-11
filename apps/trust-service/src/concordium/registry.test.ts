import { describe, expect, it } from 'vitest';
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

describe('encodeTokenIdU64Param', () => {
  it('is a 1-byte length prefix + u64 LE (CIS-2 TokenIdU64)', () => {
    expect(Buffer.from(encodeTokenIdU64Param(1112n)).toString('hex')).toBe('085804000000000000');
  });
});
