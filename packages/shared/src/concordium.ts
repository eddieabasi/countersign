/**
 * Concordium constants that are safe to share with browser code (no SDK import).
 * Values verified 2026-11-11 — see docs/DECISIONS.md.
 */

/** CAIP-2 chain ids: `ccd:` + first 32 hex chars of the network genesis hash. */
export const CAIP2 = {
  testnet: 'ccd:4221332d34e1694168c2a0c0b3fd0f27',
  mainnet: 'ccd:9dd9ca4d19e9393877d2c44b70f89acb',
} as const;

export type ContractRef = { index: number; subindex: number };

/** Official Concordium Agent Registry (CIS-8004) and External Key Registry (CIS-8) instances. */
export const AGENT_REGISTRY = {
  testnet: {
    cis8004: { index: 12802, subindex: 0 },
    cis8: { index: 12801, subindex: 0 },
  },
  mainnet: {
    cis8004: { index: 10082, subindex: 0 },
    cis8: { index: 10081, subindex: 0 },
  },
} as const satisfies Record<string, { cis8004: ContractRef; cis8: ContractRef }>;

/** URI that identifies the Verified by Concordium badge extension in an A2A Agent Card. */
export const CONCORDIUM_BADGE_EXTENSION_URI =
  'https://docs.concordium.com/a2a-extensions/concordium-badge/v1';

/** Short-form badges are Base58Check CIS-2 token addresses. */
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Cheap shape check for a badge string (short or CAIP-19 form). Not a cryptographic check. */
export function looksLikeBadge(input: string): boolean {
  const short = input.includes('/cis-2:') ? input.split('/cis-2:')[1] : input;
  return !!short && short.length >= 15 && short.length <= 40 && BASE58_RE.test(short);
}

/** Strip a CAIP-19 prefix (`ccd:<chain>/cis-2:`) to the short Base58Check badge. */
export function toShortBadge(input: string): string {
  const idx = input.indexOf('/cis-2:');
  return idx === -1 ? input : input.slice(idx + '/cis-2:'.length);
}
