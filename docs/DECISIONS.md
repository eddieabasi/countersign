# Decisions and build log

Running record of what was verified, what changed from `CLAUDE.md`, and why. Newest phase first.

---

## Phase 1 — Merchant onboarding (target: checkpoint 2026-11-22)

Status: **plan only — awaiting sign-off.** See the bottom of this file for the checklist.

---

## Phase 0 — Spike (2026-11-11)

### Checklist

- [x] pnpm monorepo in the layout from `CLAUDE.md` (`apps/web`, `apps/trust-service`, `apps/seller-agent`, `packages/shared`, `packages/widget`, `infra/`, `docs/`)
- [x] Strict TS, ESLint (flat config, typescript-eslint strict), Prettier, Vitest projects
- [x] `infra/docker-compose.yml` (Postgres 16, Redis 7) and `.env.example`
- [x] Read current docs for web-sdk, verification-web-ui, Agent Registry, MCP service; pinned versions
- [x] Spike (a) read an agent from the Agent Registry — **hosted path executed on testnet**; gRPC path written + typechecked, not executed (see B1)
- [x] Spike (b) create + verify a proof request — **offline part executed**; anchoring + `verifyWithNode` written + typechecked, need B1 + B2 + a wallet presentation
- [x] Spike (c) anchor an audit record — **offline part executed** (CBOR anchor built, 93/256 bytes); submission needs B1 + B2
- [x] Testnet anchoring account created and exported by the user (2026-11-13)
- [ ] Run (a)-gRPC, (b), (c) on-chain from a machine that can reach the node (B1)

### Pinned versions

| Package                                  | Version                     | Notes                                                                                                                              |
| ---------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@concordium/web-sdk`                    | **12.0.2** (exact)          | `latest` tag on 2026-11-11. `13.0.0-alpha.2` exists — do not use.                                                                  |
| `@concordium/verification-web-ui`        | **0.2.1** (exact, Phase 1)  | Not yet installed in a workspace package.                                                                                          |
| `@concordium/wallet-connectors`          | **0.9.0** (exact, Phase 1)  | Browser Wallet + WalletConnect. Read its docs before use.                                                                          |
| `@concordium/browser-wallet-api-helpers` | **3.3.0** (exact, Phase 1)  |                                                                                                                                    |
| `@x402/concordium`                       | **2.30.0** (exact, Phase 3) | Concordium x402 package from the `coinbase/x402` repo.                                                                             |
| typescript                               | 6.0.3                       | Not 7.x: `typescript-eslint@8.72.2` requires `<6.1`. TS 6 defaults `types` to `[]`, so the base tsconfig sets `"types": ["node"]`. |
| eslint / @eslint/js                      | 10.14.0 / 10.0.1            | 9.x is marked deprecated on npm.                                                                                                   |
| next / react                             | 16.4.6 / 19.3.1             |                                                                                                                                    |
| fastify / zod / vitest                   | 5.12.8 / 4.6.7 / 5.1.0      |                                                                                                                                    |

### Concordium facts verified on 2026-11-11

| Fact                                | Value                                                                                                                                                                                                                                        | Source                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Testnet CIS-8004 Agent Registry     | `<12802,0>`                                                                                                                                                                                                                                  | hosted MCP `contract_info {network:"testnet"}`                                 |
| Testnet CIS-8 External Key Registry | `<12801,0>`                                                                                                                                                                                                                                  | same                                                                           |
| Mainnet registries (reference only) | CIS-8004 `<10082,0>`, CIS-8 `<10081,0>`                                                                                                                                                                                                      | docs: technical-reference/agent-registry                                       |
| On-chain contract name              | `CIS-8004` (receive names `CIS-8004.<entrypoint>`)                                                                                                                                                                                           | CCDScan `contract.snapshot.contractName`                                       |
| Module refs seen                    | `142462ff…a5c6` (MCP `contract_info`, deployed 2026-10-06) and `e69e11fe…3c8e` (CCDScan snapshot, 2026-05-27)                                                                                                                                | The registry has been upgraded; decode with the live instance's schema.        |
| View entrypoint                     | `agentOf(TokenIdU64) → Option<AgentView>` with `owner_account, status{Active,Revoked}, agent_uri?, metadata_hash?([u8;32]), registered_at, revoked_at?, revocation_reason?, agent_wallet?, external_reference?, on_chain_metadata, token_id` | module display schema via CCDScan GraphQL `moduleReferenceEvent.displaySchema` |
| Badge                               | CIS-2 token address of the agent NFT, Base58Check (`tokenAddressToBase58`); token ids are `TokenIdU64` (8 bytes LE)                                                                                                                          | docs: concordium-badge                                                         |
| Testnet CAIP-2 chain id             | `ccd:4221332d34e1694168c2a0c0b3fd0f27`                                                                                                                                                                                                       | hosted `/v1/check-badge` response                                              |
| Testnet identity providers          | **0** Concordium testnet IP, **3** Digital Trust Solutions TestNet, **5** Dataspike                                                                                                                                                          | wallet-proxy `GET /v1/ip_info`                                                 |
| Testnet agents                      | 949 active, 166 revoked                                                                                                                                                                                                                      | hosted MCP `list_agents`                                                       |
| gRPC endpoint                       | `grpc.testnet.concordium.com:20000` (TLS)                                                                                                                                                                                                    | hosted MCP `network_status`; verifier-service compose file in docs             |
| Testnet CCD                         | Browser Wallet → account → Activity → **Request CCD** (20,000 CCD, once per account with no incoming txs)                                                                                                                                    | docs: tutorials/plt/request-ccd                                                |
| RegisterData limit                  | 256 bytes                                                                                                                                                                                                                                    | protocol                                                                       |
| Anchor cost                         | ~€0.02 per VRA/VAA (paid in CCD, euro-pegged)                                                                                                                                                                                                | docs: verify-and-access                                                        |

**Testnet fixtures** (registry `<12802,0>`) for tests and the demo:

| Token                 | Badge                   | Case                                                   |
| --------------------- | ----------------------- | ------------------------------------------------------ |
| 1112                  | `JyP9VYjZYJcQebdQ7ypD5` | Active, card hash matches (no badge extension in card) |
| 1000, 900, 1100, 1111 | —                       | Active, card hash matches                              |
| 0                     | `JyP9TtQC3HCNrTYR3sc2T` | Active, card URL 404 → **card hash mismatch**          |
| 1050                  | —                       | Active, card 404 → mismatch                            |
| 15                    | `JyP9UApR1fgJJL79x1xQT` | **Revoked**                                            |
| 999999                | `JyP9V5dupAgxNyUmSS4CG` | **Not found**                                          |

### Exact working calls

**(a) Read an agent — hosted path (executed against testnet)**

```bash
curl -s https://agent-registry-mcp.concordium.com/v1/check-badge/JyP9VYjZYJcQebdQ7ypD5
curl -s https://agent-registry-mcp.concordium.com/mcp -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_of","arguments":{"token_id":"1112","network":"testnet"}}}'
```

`check-badge` returns `checks.{on_chain_agent_found,status_active,has_agent_uri,card_fetched,hash_matches_on_chain,badge_present,badge_well_formed}`. `agent_of` returns `null` for an unknown token. In code: `HostedRegistryClient` (`apps/trust-service/src/concordium/hosted-registry.ts`).

**(a) Read an agent — direct chain path (typechecked; not executed here, see B1)** — `readAgentOnChain` in `apps/trust-service/src/concordium/registry.ts`:

```ts
const info = await client.getInstanceInfo(ContractAddress.create(12802, 0));
const schema = await getEmbeddedModuleSchema(await client.getModuleSource(info.sourceModule));
const res = await client.invokeContract({
  contract,
  method: ReceiveName.fromString('CIS-8004.agentOf'),
  parameter: Parameter.fromBuffer(/* 0x08 ‖ u64 LE token id */),
});
const decoded = deserializeReceiveReturnValue(
  ReturnValue.toBuffer(res.returnValue),
  schema.buffer,
  ContractName.fromString('CIS-8004'),
  EntrypointName.fromString('agentOf'),
);
// then fetch agent_uri, SHA-256 the raw bytes, compare with metadata_hash
```

**(b) Proof request** — `apps/trust-service/src/concordium/proof.ts` + `scripts/spike/proof.ts`:

```ts
const claims = VerificationRequestV1.claimsBuilder()
  .addAccountOrIdentityClaims(
    [0, 3, 5].map((i) => new IdentityProviderDID('Testnet', i)),
    (b) => {
      b.addMinimumAge(18);
      b.revealAttribute('countryOfResidence');
    },
  )
  .getClaims();
const context = VerificationRequestV1.createSimpleContext(
  nonce32,
  connectionId,
  resourceId,
  contextString,
);
// offline (executed): VerificationRequestV1.createAnchor / computeAnchorHash → 110-byte CCDVRA anchor
// online (written):
const request = await VerificationRequestV1.createAndAnchor(
  client,
  { sender, signer },
  { given, requested },
  claims,
  publicInfo,
);
await client.waitForTransactionFinalization(request.transactionRef);
await VerificationRequestV1.verifyAnchor(request, client);
// after the wallet returns a presentation:
const result = await VerifiablePresentationV1.verifyWithNode(
  VerifiablePresentationV1.fromJSON(json),
  client,
  'Testnet',
);
const audit = await VerificationAuditRecordV1.createAndAnchor(
  id,
  request,
  presentation,
  client,
  { metadata: { sender, signer }, info },
  { network: 'Testnet' },
);
await VerificationAuditRecordV1.verifyAnchor(
  audit.result.record,
  audit.result.anchorTransactionRef,
  client,
);
```

**(c) Anchor a Trust Receipt** — `apps/trust-service/src/concordium/anchor.ts` + `scripts/spike/anchor.ts`:

```ts
const hash = sha256(canonicalJson(receipt)); // 32 bytes
const bytes = cborEncode({ type: 'CSTR', version: 1, hash, public: { rid } }); // 93 bytes in the spike
const tx = {
  type: AccountTransactionType.RegisterData,
  header: { sender, nonce, expiry: TransactionExpiry.futureMinutes(60) },
  payload: { data: new DataBlob(bytes) },
};
await client.sendAccountTransaction(tx, await signTransaction(tx, signer));
// read back: outcome.summary.transactionType === 'registerData' → summary.dataRegistered.data (hex)
```

Signer: `buildAccountSigner(parseWallet(<Browser Wallet .export>))`; the loader refuses non-testnet exports.

### Decisions and deviations from `CLAUDE.md`

- **D1 — "Concordium MCP server" is the Agent Registry MCP service.** Hosted at `https://agent-registry-mcp.concordium.com/mcp` (40 tools, plus REST twins). It holds no keys and returns sign-ready payloads. Countersign's own MCP server (`verify_agent`, `create_receipt`, `get_receipt`) is separate. We use the hosted service for dev and as a cross-check; **the verdict reads the chain directly**, because the badge spec calls a hosted resolver "a convenience, not an authority".
- **D2 — Proofs verified in-process with web-sdk V1, not the Dockerised `credential-verification-service`.** Concordium's verify-and-access docs recommend the Docker service; `CLAUDE.md` names the web-sdk APIs. All of `VerificationRequestV1.createAndAnchor`, `VerifiablePresentationV1.verifyWithNode` and `VerificationAuditRecordV1.createAndAnchor` exist in 12.0.2, so we keep one trust service. If `verifyWithNode` misbehaves on testnet, the Docker service is the fallback.
- **D3 — Testnet issuers are IdPs 0, 3, 5.** The docs tutorial hard-codes 0–3; 1 and 2 do not exist on testnet.
- **D4 — Decode registry views with the live instance's embedded schema**, cached per module ref. The contract has been upgraded and the two sources disagree on the current module.
- **D5 — Trust Receipts use RegisterData with a `CSTR` CBOR anchor.** The web-sdk audit-record helpers only work on a (request, presentation) pair, so they apply to merchant verification (the VAA), not receipts. The receipt anchor copies the SDK's CCDVRA/CCDVAA shape and submission code. The SDK itself still uses the `AccountTransaction` + `signTransaction` path internally, although `accountTransactions` handlers are marked deprecated in favour of `Transaction.registerData`. We mirror the SDK and will revisit on the next SDK bump.
- **D6 — Bug found: never pass a Node `Buffer` to web-sdk `cborEncode`.** It serialises it as `{type:'Buffer',data:[…]}`. `sha256()` returns a plain `Uint8Array` and the encoder copies defensively. There is a test for this.
- **D7 — More verdict reasons than the brief lists**: `invalid_badge`, `untrusted_registry`, `card_unavailable` and `not_linked` were added next to the brief's six. All of them still mean `NOT_VERIFIED` (fail closed).
- **D8 — Internal packages ship TypeScript source** (`exports: ./src/index.ts`), and relative imports use explicit `.ts` extensions (`allowImportingTsExtensions`; tsc never emits). Next/Turbopack (`transpilePackages`) does not map NodeNext-style `./x.js` specifiers to `.ts` source, whereas `.ts` specifiers work in Turbopack, tsx, Vitest and Node type-stripping alike. Production bundling of the trust service is a Phase 4 task.
- **D9 — Badge-extension conformance is reported, not gating (open).** Concordium's `check-badge` says `badge_valid:false` when a card lacks the `…/concordium-badge/v1` extension, even if the hash matches (token 1112). The brief's verdict does not require it. Cards that Countersign generates will include it.

- **D10 — web-sdk's schema decoder returns numbers as BigInt.** `deserializeReceiveReturnValue` / `deserializeTypeValue` parse with json-bigint, so a `[u8; 32]` (the registry's `metadata_hash`) arrives as an array of BigInt, while `ByteArray` arrives as a hex string. Found on the first real gRPC run (2026-11-13); `bytesToHex` now accepts both, and a regression test decodes through the real SDK.
- **D11 — Relative paths in `.env` resolve from the repo root.** pnpm runs package scripts with the package directory as cwd, so `./secrets/…` used to point into `apps/trust-service/`. `loadConfig` now resolves against the nearest `pnpm-workspace.yaml`.

### Environment blockers

- **B1 — This cloud sandbox cannot reach the Concordium node over gRPC.** Its egress proxy carries only HTTPS on 443, not gRPC/HTTP2 or port 20000. Every gRPC call here fails with `UNAVAILABLE / ECONNRESET`. **Confirmed working from the user's Mac (2026-11-13):** the spike connected to `grpc.testnet.concordium.com:20000`, read finalized block 50760060 and decoded `CIS-8004.agentOf`. HTTPS services work: docs, the hosted registry, the indexer, the CCDScan API and wallet-proxy. **Effect:** the direct-chain read, anchoring and `verifyWithNode` are typechecked but have not run. Run them from a laptop, or from the deployed trust-service container.
- **B2 — Anchoring needs a funded testnet account.** That means a Browser Wallet account with testnet CCD and its key exported as `.export`. Only the user can create it.
- **B3 — Sandbox-only:** Node's built-in `fetch` ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1`. Not needed on a normal machine.

### How to run the spikes

```bash
pnpm install
cp .env.example .env            # set ANCHOR_WALLET_EXPORT_PATH for on-chain steps
pnpm spike:registry             # default badge JyP9VYjZYJcQebdQ7ypD5; also try 0, 15, 999999
pnpm spike:registry 1112 --via grpc
pnpm spike:proof create         # then: pnpm spike:proof verify --presentation <file>
pnpm spike:anchor               # --dry-run to skip submission
```

---

## Phase 1 plan — checklist (not started)

Goal for 2026-11-22: a merchant connects a wallet, proves identity with a ZK proof, links a registered agent and gets a verify link, a widget snippet and an API key, end to end on testnet.

**Prerequisites (user)**

- [ ] Anchoring service account `.export` (B2), funded with Request CCD
- [ ] Reown (WalletConnect) project id
- [ ] A merchant persona wallet with a testnet identity (Browser Wallet or Concordium ID app) to produce real proofs
- [ ] A place where gRPC works for integration runs (B1): a laptop, or an early container deploy

**Trust service**

- [ ] Drizzle schema + migrations: `merchant`, `agent`, `receipt`, `report` (as in the brief), plus `verification_session` (pending request JSON, nonce, expiry, status) and `api_key` (hashed)
- [ ] Postgres + Redis wiring, `/healthz` checks both
- [ ] `RegistrySource` interface: `chain` (gRPC, default) and `hosted` (dev-only fallback for B1), both fail closed
- [ ] `POST /merchants/proof-request`: build claims → `createAndAnchor` → store session → return request JSON
- [ ] `POST /merchants/proof-verify`: `verifyWithNode` → `VerificationAuditRecordV1.createAndAnchor` → store revealed attributes only + audit record ref → upsert merchant
- [ ] `POST /agents`: parse badge → read registry → require Active + card hash match + **on-chain owner = merchant's verified account** → store channels → issue verify link, widget snippet, API key (shown once, stored hashed)
- [ ] Unit tests: proof-verify outcome mapping, `/agents` ownership/status/hash rules (mocked registry)

**Web (Merchant Console)**

- [ ] Read docs/types for `@concordium/wallet-connectors` 0.9.0 and `@concordium/verification-web-ui` 0.2.1 first; log the confirmed API here
- [ ] `/console`: connect wallet (Browser Wallet + WalletConnect)
- [ ] `/console/verify`: proof flow with `verification-web-ui` → trust service
- [ ] `/console/agents/new`: paste a badge + choose channels (web chat, WhatsApp, Instagram, email, domain); show registry checks live
- [ ] `/console/done`: verify link, widget `<script>` snippet, API key
- [ ] Playwright smoke test for onboarding against a mocked trust service

**Integration**

- [ ] `CONCORDIUM_INTEGRATION=1` test: proof-request anchors on testnet and `verifyAnchor` passes
- [ ] Re-run spikes (a)-gRPC, (b), (c) on-chain and paste tx hashes here
- [ ] Commit at checkpoint
