import { ContractAddress, tokenAddressFromBase58, tokenAddressToBase58 } from '@concordium/web-sdk';
import { toShortBadge, type ContractRef } from '@countersign/shared';

export class InvalidBadgeError extends Error {
  override name = 'InvalidBadgeError';
}

export type ParsedBadge = {
  /** Short Base58Check form, e.g. `JyP9VYjZYJcQebdQ7ypD5`. */
  short: string;
  contract: ContractAddress.Type;
  /** CIS-8004 token id (TokenIdU64). */
  tokenId: bigint;
  /** CIS-2 token id as hex (8 bytes, little-endian). */
  tokenIdHex: string;
};

/** CIS-8004 token ids are `TokenIdU64`: 8 bytes, little-endian. */
export function tokenIdHexToU64(hex: string): bigint {
  if (!/^[0-9a-f]{16}$/i.test(hex)) {
    throw new InvalidBadgeError(`token id is not a u64 (expected 8 bytes hex, got "${hex}")`);
  }
  return Buffer.from(hex, 'hex').readBigUInt64LE(0);
}

export function u64ToTokenIdHex(id: bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(id);
  return buf.toString('hex');
}

/** Parse a badge (short or CAIP-19) into contract + token id. Throws InvalidBadgeError. */
export function parseBadge(input: string): ParsedBadge {
  const short = toShortBadge(input.trim());
  let addr;
  try {
    addr = tokenAddressFromBase58(short);
  } catch (e) {
    throw new InvalidBadgeError(`not a CIS-2 token address: ${(e as Error).message}`);
  }
  return {
    short,
    contract: addr.contract,
    tokenIdHex: addr.id,
    tokenId: tokenIdHexToU64(addr.id),
  };
}

/** Short badge for a token in a CIS-8004 registry. */
export function badgeFor(registry: ContractRef, tokenId: bigint): string {
  return tokenAddressToBase58({
    contract: ContractAddress.create(registry.index, registry.subindex),
    id: u64ToTokenIdHex(tokenId),
  });
}

export function isRegistry(parsed: ParsedBadge, registry: ContractRef): boolean {
  return (
    parsed.contract.index === BigInt(registry.index) &&
    parsed.contract.subindex === BigInt(registry.subindex)
  );
}
