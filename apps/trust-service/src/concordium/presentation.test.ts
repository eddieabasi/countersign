import { describe, expect, it } from 'vitest';
import {
  TransactionHash,
  VerificationRequestV1,
  type VerifiablePresentationV1,
} from '@concordium/web-sdk';
import { accountCredentialIds, disclosedAttributes } from './presentation.ts';
import { merchantAccountClaims, merchantProofContext } from './proof.ts';

// Shape of a V1 presentation's credentials (web-sdk 12.0.2 types); proofs are irrelevant here.
const presentation = {
  verifiableCredential: [
    {
      type: [
        'VerifiableCredential',
        'ConcordiumVerifiableCredentialV1',
        'ConcordiumAccountBasedCredential',
      ],
      issuer: 'did:ccd:testnet:idp:0',
      credentialSubject: {
        id: 'did:ccd:testnet:cred:aa11bb22',
        statement: [
          { type: 'AttributeInRange', attributeTag: 'dob', lower: '18000101', upper: '20081114' },
          { type: 'AttributeValue', attributeTag: 'countryOfResidence', attributeValue: 'NG' },
        ],
      },
    },
  ],
} as unknown as VerifiablePresentationV1.Type;

describe('presentation helpers', () => {
  it('extracts account credential ids from DID subjects', () => {
    expect(accountCredentialIds(presentation)).toEqual(['aa11bb22']);
  });

  it('returns only revealed attributes, never range proofs', () => {
    expect(disclosedAttributes(presentation)).toEqual({ countryOfResidence: 'NG' });
  });

  it('ignores identity credentials when collecting account credential ids', () => {
    const idOnly = {
      verifiableCredential: [
        {
          ...presentation.verifiableCredential[0],
          type: [
            'VerifiableCredential',
            'ConcordiumVerifiableCredentialV1',
            'ConcordiumIdBasedCredential',
          ],
        },
      ],
    } as unknown as VerifiablePresentationV1.Type;
    expect(accountCredentialIds(idOnly)).toEqual([]);
  });
});

describe('verification request JSON', () => {
  it('survives the HTTP round trip (toJSON → JSON text → fromJSON) with the same anchor hash', () => {
    const context = merchantProofContext({
      connectionId: 'browser-wallet:3k3M…',
      resourceId: 'http://localhost:3000/console',
      contextString: 'Countersign merchant verification',
    });
    const claims = merchantAccountClaims();
    const req = VerificationRequestV1.create(
      context,
      claims,
      TransactionHash.fromHexString(
        'b14b05179eae32fcfb7ea49da24c15ce93fb2e1ac66dc7beefd0b72248f74ae4',
      ),
    );
    const back = VerificationRequestV1.fromJSON(
      JSON.parse(JSON.stringify(req.toJSON())) as VerificationRequestV1.JSON,
    );
    expect(
      Buffer.from(VerificationRequestV1.computeAnchorHash(back.context, back.subjectClaims)),
    ).toEqual(Buffer.from(VerificationRequestV1.computeAnchorHash(context, claims)));
  });
});

describe('anchor account guard', () => {
  it('refuses the anchoring service account as a merchant', async () => {
    const { assertNotAnchorAccount, VerificationError } =
      await import('../merchant/verification.ts');
    const anchor = '3k3MRAXGqgS8b6FCa2MjX5adcowmf1LhEnd8xfHT4J7Jnse3k4';
    expect(() => assertNotAnchorAccount(anchor, anchor)).toThrow(VerificationError);
    expect(() =>
      assertNotAnchorAccount('3mC9tNFNDhTLJNjHHEdrjkqvcCDLDbff1ceA1b9xah9cfxeCKA', anchor),
    ).not.toThrow();
  });
});
