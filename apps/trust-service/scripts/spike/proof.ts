/**
 * Spike (b): create + verify a zero-knowledge proof request (merchant onboarding, individual path).
 *
 *   pnpm spike:proof create
 *       Offline: builds claims + context and prints the VRA anchor hash.
 *       Online (gRPC + ANCHOR_WALLET_EXPORT_PATH): VerificationRequestV1.createAndAnchor →
 *       waitForTransactionFinalization → verifyAnchor → writes out/request.json
 *
 *   pnpm spike:proof verify [--presentation out/presentation.json]
 *       VerifiablePresentationV1.verifyWithNode, then VerificationAuditRecordV1.createAndAnchor
 *       (the VAA) → verifyAnchor → writes out/audit-record.json (PRIVATE: keep out of git)
 *
 * The presentation itself must come from a merchant's wallet (Concordium ID app / wallet via
 * WalletConnect). Phase 1's console does that with @concordium/verification-web-ui.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  TransactionHash,
  VerifiablePresentationV1,
  VerificationAuditRecordV1,
  VerificationRequestV1,
} from '@concordium/web-sdk';
import { merchantIndividualClaims, merchantProofContext } from '../../src/concordium/proof.ts';
import {
  OUT_DIR,
  anchorAccountOrExplain,
  connectGrpc,
  explorerTx,
  heading,
  kv,
  writeOut,
} from './_lib.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { presentation: { type: 'string' }, request: { type: 'string' } },
});
const cmd = positionals[0] ?? 'create';

if (cmd === 'create') {
  heading('Proof request (offline)');
  const claims = merchantIndividualClaims();
  const context = merchantProofContext({
    connectionId: `spike-${randomUUID()}`,
    resourceId: 'countersign:merchant-console',
    contextString: 'Countersign merchant verification',
    nonce: randomBytes(32),
  });
  const publicInfo = { svc: 'countersign', kind: 'merchant-onboarding' };
  const anchor = VerificationRequestV1.createAnchor(context, claims, publicInfo);
  kv(
    'claims',
    claims.map((c) => ({ ...c, issuers: c.issuers.map((i) => i.toJSON()) })),
  );
  kv('context.requested', context.requested);
  kv(
    'VRA anchor hash',
    Buffer.from(VerificationRequestV1.computeAnchorHash(context, claims)).toString('hex'),
  );
  kv('VRA anchor bytes', anchor.byteLength);

  heading('Anchor on testnet (VerificationRequestV1.createAndAnchor)');
  const account = anchorAccountOrExplain();
  const client = account ? await connectGrpc() : null;
  if (!account || !client) {
    console.log('\nOFFLINE ONLY — request built and hashed, not anchored.');
    process.exit(0);
  }
  const request = await VerificationRequestV1.createAndAnchor(
    client,
    { sender: account.sender, signer: account.signer },
    { given: context.given, requested: context.requested },
    claims,
    publicInfo,
  );
  const tx = TransactionHash.toHexString(request.transactionRef);
  kv('VRA tx', tx);
  kv('explorer', explorerTx(tx));
  await client.waitForTransactionFinalization(request.transactionRef);
  await VerificationRequestV1.verifyAnchor(request, client);
  kv('verifyAnchor', 'ok (finalized RegisterData, hash matches)');
  kv('wrote', writeOut('request.json', request.toJSON()));
  console.log('\nNext: present out/request.json to a testnet wallet, save its presentation JSON');
  console.log('to out/presentation.json, then run: pnpm spike:proof verify');
  process.exit(0);
}

if (cmd === 'verify') {
  heading('Verify presentation (VerifiablePresentationV1.verifyWithNode)');
  const requestPath = values.request ?? join(OUT_DIR, 'request.json');
  const presentationPath = values.presentation ?? join(OUT_DIR, 'presentation.json');
  const request = VerificationRequestV1.fromJSON(
    JSON.parse(readFileSync(requestPath, 'utf8')) as VerificationRequestV1.JSON,
  );
  // Wallets may wrap the presentation as { verifiablePresentationJson: … } (verify-access tutorial).
  const raw = JSON.parse(readFileSync(presentationPath, 'utf8')) as Record<string, unknown>;
  const presentation = VerifiablePresentationV1.fromJSON(
    (raw.verifiablePresentationJson ?? raw) as VerifiablePresentationV1.JSON,
  );

  const client = await connectGrpc();
  if (!client) process.exit(1);
  const result = await VerifiablePresentationV1.verifyWithNode(presentation, client, 'Testnet');
  if (result.type === 'failed') {
    console.log(`  ✗ verifyWithNode failed: ${result.error.message}`);
    process.exit(1);
  }
  kv('verifyWithNode', 'success');
  kv('credentialsStatus', result.result.credentialsStatus);

  heading('Audit record + anchor (VerificationAuditRecordV1.createAndAnchor)');
  const account = anchorAccountOrExplain();
  if (!account) process.exit(1);
  const audit = await VerificationAuditRecordV1.createAndAnchor(
    randomUUID(),
    request,
    presentation,
    client,
    { metadata: { sender: account.sender, signer: account.signer }, info: { svc: 'countersign' } },
    { network: 'Testnet' },
  );
  if (audit.type === 'failed') {
    console.log(`  ✗ createAndAnchor failed: ${audit.error.message}`);
    process.exit(1);
  }
  const { record, anchorTransactionRef } = audit.result;
  const tx = TransactionHash.toHexString(anchorTransactionRef);
  kv('VAA tx', tx);
  kv('explorer', explorerTx(tx));
  await client.waitForTransactionFinalization(anchorTransactionRef);
  await VerificationAuditRecordV1.verifyAnchor(record, anchorTransactionRef, client);
  kv('verifyAnchor', 'ok');
  kv('wrote (PRIVATE)', writeOut('audit-record.json', record.toJSON()));
  process.exit(0);
}

console.log(`unknown command "${cmd}" (expected create | verify)`);
process.exit(2);
