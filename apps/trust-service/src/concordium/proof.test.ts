import { describe, expect, it } from 'vitest';
import { VerificationRequestV1 } from '@concordium/web-sdk';
import { merchantAccountClaims, merchantProofContext } from './proof.ts';

describe('merchant proof request (offline)', () => {
  const claims = merchantAccountClaims();
  const context = merchantProofContext({
    connectionId: 'wc-topic-123',
    resourceId: 'https://countersign.example/console',
    contextString: 'Countersign merchant verification',
    nonce: new Uint8Array(32).fill(7),
  });

  it('asks an account credential to reveal country only (no age check), from testnet IdPs 0/3/5', () => {
    expect(claims).toHaveLength(1);
    const [c] = claims;
    if (!c) throw new Error('no claims');
    expect(c.type).toBe('identity');
    expect(c.source).toEqual(['accountCredential']);
    expect(c.issuers.map((i) => i.toJSON())).toEqual([
      'did:ccd:testnet:idp:0',
      'did:ccd:testnet:idp:3',
      'did:ccd:testnet:idp:5',
    ]);
    const kinds = c.statements.map((s) => `${s.type}:${String(s.attributeTag)}`);
    expect(kinds).toEqual(['RevealAttribute:countryOfResidence']);
  });

  it('requests the block hash from the presenter and binds nonce/connection/resource', () => {
    expect(context.requested).toEqual(['BlockHash']);
    expect(context.given.map((g) => g.label)).toEqual([
      'Nonce',
      'ConnectionID',
      'ResourceID',
      'ContextString',
    ]);
  });

  it('produces a deterministic VRA anchor hash (what createAndAnchor puts on chain)', () => {
    const h1 = VerificationRequestV1.computeAnchorHash(context, claims);
    const h2 = VerificationRequestV1.computeAnchorHash(context, claims);
    expect(Buffer.from(h1).toString('hex')).toBe(Buffer.from(h2).toString('hex'));
    expect(h1.byteLength).toBe(32);
    const anchor = VerificationRequestV1.decodeAnchor(
      VerificationRequestV1.createAnchor(context, claims, { svc: 'countersign' }),
    );
    expect(anchor.type).toBe('CCDVRA');
    expect(Buffer.from(anchor.hash).equals(Buffer.from(h1))).toBe(true);
  });
});
