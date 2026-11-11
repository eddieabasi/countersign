import { describe, expect, it } from 'vitest';
import { CAIP2, looksLikeBadge, toShortBadge } from './concordium.ts';
import { VERDICT_SCOPE, VerdictSchema } from './verdict.ts';

describe('badge helpers', () => {
  it('accepts short and CAIP-19 badges', () => {
    expect(looksLikeBadge('JyP9VYjZYJcQebdQ7ypD5')).toBe(true);
    expect(looksLikeBadge(`${CAIP2.testnet}/cis-2:JyP9VYjZYJcQebdQ7ypD5`)).toBe(true);
  });

  it('rejects junk', () => {
    expect(looksLikeBadge('')).toBe(false);
    expect(looksLikeBadge('not a badge!')).toBe(false);
    expect(looksLikeBadge('0OIl0OIl0OIl0OIl')).toBe(false); // excluded base58 chars
  });

  it('strips CAIP-19 prefix', () => {
    expect(toShortBadge(`${CAIP2.testnet}/cis-2:JyP9VYjZYJcQebdQ7ypD5`)).toBe(
      'JyP9VYjZYJcQebdQ7ypD5',
    );
    expect(toShortBadge('JyP9VYjZYJcQebdQ7ypD5')).toBe('JyP9VYjZYJcQebdQ7ypD5');
  });
});

describe('VerdictSchema', () => {
  it('requires the exact scope line', () => {
    const base = {
      status: 'NOT_VERIFIED',
      reasons: ['not_found'],
      checkedAt: new Date().toISOString(),
    };
    expect(VerdictSchema.safeParse({ ...base, scope: VERDICT_SCOPE }).success).toBe(true);
    expect(VerdictSchema.safeParse({ ...base, scope: 'Totally safe!' }).success).toBe(false);
  });
});
