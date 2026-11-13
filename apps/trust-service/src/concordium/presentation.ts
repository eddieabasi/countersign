import {
  CredentialRegistrationId,
  VerifiableCredentialV1,
  type ConcordiumGRPCClient,
  type VerifiablePresentationV1,
} from '@concordium/web-sdk';

/** Credential registration ids (hex) of the account credentials in a presentation. */
export function accountCredentialIds(presentation: VerifiablePresentationV1.Type): string[] {
  return presentation.verifiableCredential
    .filter(VerifiableCredentialV1.isAccountCredential)
    .map((c) => {
      const credId = c.credentialSubject.id.split(':cred:')[1];
      if (!credId) throw new Error(`malformed credential subject id: ${c.credentialSubject.id}`);
      return credId;
    });
}

/**
 * Attributes the holder chose to reveal. A requested `RevealAttribute` comes back as an
 * `AttributeValue` statement carrying the value (web-sdk 12.0.2). Range/set statements reveal
 * nothing and are skipped.
 */
export function disclosedAttributes(
  presentation: VerifiablePresentationV1.Type,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const cred of presentation.verifiableCredential) {
    for (const st of cred.credentialSubject.statement) {
      if (st.type === 'AttributeValue') {
        const v: unknown = st.attributeValue;
        out[String(st.attributeTag)] =
          typeof v === 'object' && v !== null && 'timestamp' in v
            ? String((v as { timestamp: unknown }).timestamp)
            : String(v);
      }
    }
  }
  return out;
}

/** The account (Base58) an account credential belongs to, read from the chain. */
export async function accountOfCredential(
  grpc: ConcordiumGRPCClient,
  credIdHex: string,
): Promise<string> {
  const info = await grpc.getAccountInfo(CredentialRegistrationId.fromHexString(credIdHex));
  return info.accountAddress.address;
}
