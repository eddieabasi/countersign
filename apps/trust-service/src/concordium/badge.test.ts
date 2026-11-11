import { describe, expect, it } from 'vitest';
import { AGENT_REGISTRY, CAIP2 } from '@countersign/shared';
import {
  InvalidBadgeError,
  badgeFor,
  isRegistry,
  parseBadge,
  tokenIdHexToU64,
  u64ToTokenIdHex,
} from './badge.ts';

// Expected values come from Concordium's hosted registry `token_address` tool (2026-11-11).
const TESTNET = AGENT_REGISTRY.testnet.cis8004;

describe('badge codec', () => {
  it('matches Concordium-encoded testnet badges', () => {
    expect(badgeFor(TESTNET, 0n)).toBe('JyP9TtQC3HCNrTYR3sc2T');
    expect(badgeFor(TESTNET, 1112n)).toBe('JyP9VYjZYJcQebdQ7ypD5');
  });

  it('parses short and CAIP-19 badges back to contract + token id', () => {
    for (const input of ['JyP9VYjZYJcQebdQ7ypD5', `${CAIP2.testnet}/cis-2:JyP9VYjZYJcQebdQ7ypD5`]) {
      const p = parseBadge(input);
      expect(p.short).toBe('JyP9VYjZYJcQebdQ7ypD5');
      expect(p.contract.index).toBe(12802n);
      expect(p.contract.subindex).toBe(0n);
      expect(p.tokenId).toBe(1112n);
      expect(isRegistry(p, TESTNET)).toBe(true);
      expect(isRegistry(p, AGENT_REGISTRY.mainnet.cis8004)).toBe(false);
    }
  });

  it('round-trips u64 token ids little-endian', () => {
    expect(u64ToTokenIdHex(1112n)).toBe('5804000000000000');
    expect(tokenIdHexToU64('5804000000000000')).toBe(1112n);
    expect(tokenIdHexToU64(u64ToTokenIdHex(2n ** 64n - 1n))).toBe(2n ** 64n - 1n);
  });

  it('rejects garbage and non-u64 token ids', () => {
    expect(() => parseBadge('not-a-badge')).toThrow(InvalidBadgeError);
    expect(() => tokenIdHexToU64('01')).toThrow(InvalidBadgeError);
  });
});
