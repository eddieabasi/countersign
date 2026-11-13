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
 * Merchant onboarding claims (individual path, decisions P2 + P5): the merchant proves, from an
 * **account credential**, that the account they connected carries a valid identity from a trusted
 * testnet IdP, and reveals their country of residence. Nothing else is disclosed — no age check:
 * the identity behind the account is the accountability anchor (see P5 in docs/DECISIONS.md).
 * Account-only binds the verified identity to the account that must own the agent NFT.
 */
export function merchantAccountClaims(): VerificationRequestV1.SubjectClaims[] {
  return VerificationRequestV1.claimsBuilder()
    .addAccountClaims(testnetIssuers(), (b) => {
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
