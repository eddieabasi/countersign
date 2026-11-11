import { randomBytes } from 'node:crypto';
import { IdentityProviderDID, VerificationRequestV1 } from '@concordium/web-sdk';

/**
 * Identity providers live on testnet as of 2026-11-11 (wallet-proxy `/v1/ip_info`):
 * 0 Concordium testnet IP · 3 Digital Trust Solutions TestNet · 5 Dataspike.
 * (Concordium's verify-access tutorial hard-codes 0–3; 1 and 2 do not exist on testnet.)
 */
export const TESTNET_IDENTITY_PROVIDERS = [0, 3, 5] as const;

export function testnetIssuers(): IdentityProviderDID[] {
  return TESTNET_IDENTITY_PROVIDERS.map((i) => new IdentityProviderDID('Testnet', i));
}

/**
 * Merchant onboarding claims (individual path): the merchant proves they hold a valid Concordium
 * identity from a trusted IdP, is an adult, and chooses to reveal their country of residence.
 * Nothing else is disclosed. The wallet picks an identity or account credential.
 */
export function merchantIndividualClaims(): VerificationRequestV1.SubjectClaims[] {
  return VerificationRequestV1.claimsBuilder()
    .addAccountOrIdentityClaims(testnetIssuers(), (b) => {
      b.addMinimumAge(18);
      b.revealAttribute('countryOfResidence');
    })
    .getClaims();
}

/** Context binding the proof to this session (nonce), connection and resource. */
export function merchantProofContext(opts: {
  connectionId: string;
  resourceId: string;
  contextString?: string;
  nonce?: Uint8Array;
}): VerificationRequestV1.Context {
  return VerificationRequestV1.createSimpleContext(
    opts.nonce ?? randomBytes(32),
    opts.connectionId,
    opts.resourceId,
    opts.contextString,
  );
}
