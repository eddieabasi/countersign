import { randomUUID } from 'node:crypto';
import {
  AccountAddress,
  TransactionHash,
  VerifiablePresentationV1,
  VerificationAuditRecordV1,
  VerificationRequestV1,
  type ConcordiumGRPCClient,
} from '@concordium/web-sdk';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { merchant, verificationSession } from '../db/schema.ts';
import type { AnchorAccount } from '../concordium/wallet.ts';
import { merchantAccountClaims, merchantProofContext } from '../concordium/proof.ts';
import {
  accountCredentialIds,
  accountOfCredential,
  disclosedAttributes,
} from '../concordium/presentation.ts';

export const SESSION_TTL_MS = 10 * 60_000;
const FINALIZATION_TIMEOUT_MS = 90_000;

export type Chain = { grpc: ConcordiumGRPCClient; anchor: AnchorAccount };

/** A failure the caller can show to the merchant. `status` maps to an HTTP status. */
export class VerificationError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

/** Throws VerificationError(400) unless `account` is a valid Base58 Concordium address. */
export function parseAccount(account: string): AccountAddress.Type {
  try {
    return AccountAddress.fromBase58(account);
  } catch {
    throw new VerificationError(400, 'invalid_account', 'Not a valid Concordium account address.');
  }
}

/**
 * Step 1: build the account-credential request, anchor it on testnet (VRA) and wait until it is
 * finalized — the wallet checks the anchor before it will build a proof.
 */
export async function createProofRequest(
  deps: { db: Db; chain: Chain; resourceId: string },
  input: { account: string; displayName: string },
): Promise<{ sessionId: string; request: VerificationRequestV1.JSON; vraTxHash: string }> {
  const account = parseAccount(input.account);
  const claims = merchantAccountClaims();
  const context = merchantProofContext({
    connectionId: `browser-wallet:${account.address}`,
    resourceId: deps.resourceId,
    contextString: 'Countersign merchant verification',
  });

  const request = await VerificationRequestV1.createAndAnchor(
    deps.chain.grpc,
    { sender: deps.chain.anchor.sender, signer: deps.chain.anchor.signer },
    { given: context.given, requested: context.requested },
    claims,
    { svc: 'countersign', kind: 'merchant-verification' },
  );
  await deps.chain.grpc.waitForTransactionFinalization(
    request.transactionRef,
    FINALIZATION_TIMEOUT_MS,
  );
  await VerificationRequestV1.verifyAnchor(request, deps.chain.grpc);

  const json = request.toJSON();
  const vraTxHash = TransactionHash.toHexString(request.transactionRef);
  const [row] = await deps.db
    .insert(verificationSession)
    .values({
      walletAccount: account.address,
      displayName: input.displayName,
      request: json,
      vraTxHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    .returning({ id: verificationSession.id });
  if (!row) throw new Error('failed to store verification session');
  return { sessionId: row.id, request: json, vraTxHash };
}

/**
 * Step 2: verify the wallet's presentation against the stored request, check that the account
 * credential belongs to the connected account, then anchor the audit record (VAA) and save the
 * merchant with only the attributes they revealed. Fails closed on any error.
 */
export async function verifyProof(
  deps: { db: Db; chain: Chain },
  input: { sessionId: string; presentation: unknown },
): Promise<{
  merchant: {
    displayName: string;
    walletAccount: string;
    disclosedAttributes: Record<string, string>;
    verifiedAt: string;
  };
  vraTxHash: string;
  vaaTxHash: string;
}> {
  const [session] = await deps.db
    .select()
    .from(verificationSession)
    .where(eq(verificationSession.id, input.sessionId));
  if (!session)
    throw new VerificationError(404, 'session_not_found', 'Unknown verification session.');
  if (session.status !== 'pending') {
    throw new VerificationError(409, 'session_used', `Session is already ${session.status}.`);
  }
  if (session.expiresAt.getTime() < Date.now()) {
    await fail(deps.db, session.id, 'expired');
    throw new VerificationError(409, 'session_expired', 'Session expired — start again.');
  }

  let presentation: VerifiablePresentationV1.Type;
  try {
    const raw = input.presentation as Record<string, unknown>;
    presentation = VerifiablePresentationV1.fromJSON(
      (raw.verifiablePresentationJson ?? raw) as VerifiablePresentationV1.JSON,
    );
  } catch (e) {
    await fail(deps.db, session.id, `malformed presentation: ${(e as Error).message}`);
    throw new VerificationError(400, 'malformed_presentation', 'Presentation could not be parsed.');
  }
  const request = VerificationRequestV1.fromJSON(session.request as VerificationRequestV1.JSON);

  // Context, cryptography (verifyWithNode), credential status, VRA anchor, claims and issuer.
  const checked = await VerificationAuditRecordV1.createChecked(
    randomUUID(),
    request,
    presentation,
    deps.chain.grpc,
    'Testnet',
  );
  if (checked.type === 'failed') {
    await fail(deps.db, session.id, checked.error.message);
    throw new VerificationError(422, 'proof_invalid', checked.error.message);
  }

  // Countersign's own rule: the proof must come from the account that was connected.
  const credIds = accountCredentialIds(presentation);
  if (credIds.length !== 1) {
    await fail(deps.db, session.id, `expected 1 account credential, got ${credIds.length}`);
    throw new VerificationError(
      422,
      'account_credential_required',
      'Proof must come from an account credential.',
    );
  }
  const proofAccount = await accountOfCredential(deps.chain.grpc, credIds[0] as string);
  if (proofAccount !== session.walletAccount) {
    await fail(deps.db, session.id, `account mismatch: proof from ${proofAccount}`);
    throw new VerificationError(
      422,
      'account_mismatch',
      'Proof was made with a different account than the one connected.',
    );
  }

  // Only now anchor the audit record on chain (VAA).
  const vaa = await VerificationAuditRecordV1.registerAnchor(
    checked.result,
    deps.chain.grpc,
    {
      sender: deps.chain.anchor.sender,
      signer: deps.chain.anchor.signer,
    },
    { svc: 'countersign', kind: 'merchant-verification' },
  );
  await deps.chain.grpc.waitForTransactionFinalization(vaa, FINALIZATION_TIMEOUT_MS);
  await VerificationAuditRecordV1.verifyAnchor(checked.result, vaa, deps.chain.grpc);
  const vaaTxHash = TransactionHash.toHexString(vaa);

  const disclosed = disclosedAttributes(presentation);
  const verifiedAt = new Date();
  await deps.db.transaction(async (tx) => {
    await tx
      .insert(merchant)
      .values({
        displayName: session.displayName,
        walletAccount: session.walletAccount,
        verificationMethod: 'individual',
        disclosedAttributes: disclosed,
        verifiedAt,
        auditRecordRef: vaaTxHash,
      })
      .onConflictDoUpdate({
        target: merchant.walletAccount,
        set: {
          displayName: session.displayName,
          verificationMethod: 'individual',
          disclosedAttributes: disclosed,
          verifiedAt,
          auditRecordRef: vaaTxHash,
        },
      });
    await tx
      .update(verificationSession)
      .set({ status: 'verified', auditRecord: checked.result.toJSON(), vaaTxHash })
      .where(eq(verificationSession.id, session.id));
  });

  return {
    merchant: {
      displayName: session.displayName,
      walletAccount: session.walletAccount,
      disclosedAttributes: disclosed,
      verifiedAt: verifiedAt.toISOString(),
    },
    vraTxHash: session.vraTxHash,
    vaaTxHash,
  };
}

async function fail(db: Db, id: string, reason: string): Promise<void> {
  await db
    .update(verificationSession)
    .set({ status: 'failed', failureReason: reason.slice(0, 500) })
    .where(eq(verificationSession.id, id));
}

/** Public merchant status for the console (no audit record). */
export async function getMerchant(db: Db, account: string) {
  const addr = parseAccount(account);
  const [row] = await db
    .select({
      displayName: merchant.displayName,
      walletAccount: merchant.walletAccount,
      disclosedAttributes: merchant.disclosedAttributes,
      verifiedAt: merchant.verifiedAt,
      auditRecordRef: merchant.auditRecordRef,
    })
    .from(merchant)
    .where(eq(merchant.walletAccount, addr.address));
  return row ?? null;
}
