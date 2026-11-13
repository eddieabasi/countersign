/** Typed client for the trust service. Browser- and Node-safe (fetch only, no SDK import). */

export type MerchantPublic = {
  displayName: string;
  walletAccount: string;
  disclosedAttributes: Record<string, string>;
  verifiedAt: string | null;
  auditRecordRef?: string | null;
};

export type ProofRequestResponse = {
  sessionId: string;
  /** `VerificationRequestV1.JSON` — rebuild with `VerificationRequestV1.fromJSON`. */
  request: unknown;
  vraTxHash: string;
};

export type ProofVerifyResponse = {
  merchant: MerchantPublic;
  vraTxHash: string;
  vaaTxHash: string;
};

export class TrustServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TrustServiceError';
  }
}

export function createTrustServiceClient(baseUrl: string) {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...init?.headers },
      });
    } catch (e) {
      throw new TrustServiceError(
        0,
        'unreachable',
        `Trust service unreachable at ${baseUrl}: ${(e as Error).message}`,
      );
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) {
      throw new TrustServiceError(
        res.status,
        body.error ?? 'error',
        body.message ?? res.statusText,
      );
    }
    return body as T;
  };

  return {
    proofRequest: (input: { account: string; displayName: string }) =>
      call<ProofRequestResponse>('/merchants/proof-request', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    /** `presentation` may be a VerifiablePresentationV1 instance; JSON.stringify calls its toJSON(). */
    proofVerify: (input: { sessionId: string; presentation: unknown }) =>
      call<ProofVerifyResponse>('/merchants/proof-verify', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    health: () => call<{ ok: boolean; network: string; anchorAccount: string | null }>('/healthz'),
    getMerchant: (account: string) =>
      call<MerchantPublic>(`/merchants/${encodeURIComponent(account)}`),
  };
}

export type TrustServiceClient = ReturnType<typeof createTrustServiceClient>;

export function ccdscanTx(hash: string): string {
  return `https://testnet.ccdscan.io/?dcount=1&dentity=transaction&dhash=${hash}`;
}
