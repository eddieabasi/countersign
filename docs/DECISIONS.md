# Decisions and build log

Running record of what was verified, what changed from `CLAUDE.md`, and why. Newest phase first.

---

## Phase 1 — Merchant onboarding (target: checkpoint 2026-11-22)

Status: **in progress** on branch `phase-1-onboarding` (started 2026-11-13). Checklist and decisions P1–P4 at the bottom of this file.

---

## Phase 0 — Spike (2026-11-11)

### Checklist

- [x] pnpm monorepo in the layout from `CLAUDE.md` (`apps/web`, `apps/trust-service`, `apps/seller-agent`, `packages/shared`, `packages/widget`, `infra/`, `docs/`)
- [x] Strict TS, ESLint (flat config, typescript-eslint strict), Prettier, Vitest projects
- [x] `infra/docker-compose.yml` (Postgres 16, Redis 7) and `.env.example`
- [x] Read current docs for web-sdk, verification-web-ui, Agent Registry, MCP service; pinned versions
- [x] Spike (a) read an agent from the Agent Registry — hosted path (sandbox) and **gRPC `CIS-8004.agentOf` path run on testnet from the user's Mac (2026-11-13)**; decoded status matched Concordium's hosted service
- [x] Spike (b) create a proof request — **anchored on testnet**: VRA tx `b14b05179eae32fcfb7ea49da24c15ce93fb2e1ac66dc7beefd0b72248f74ae4` (block 50760287), `verifyAnchor` ok
- [x] Spike (b) verify a presentation (`verifyWithNode` + VAA) — **done via the Phase 1 console, 2026-11-13**: VAA tx `b16036a11c171ea012589c7f458e6ee90079478e1c51c0434b934c133ef875da` (block 50763611)
- [x] Spike (c) anchor an audit record — **Trust Receipt anchored on testnet**: tx `08ea617b45ca8b19f1253386e465e65a1493713bf5d96449a94314e57859bdf1` (block 50760283), on-chain bytes decode to the same receipt hash
- [x] Testnet anchoring account created and exported by the user (2026-11-13)
- [x] Run (a)-gRPC, (b)-create, (c) on-chain from a machine that can reach the node (B1) — `pnpm spike`, all PASS, 2026-11-13
- [x] Both anchor txs independently confirmed on CCDScan (`REGISTER_DATA`, Success; data bytes identical to what the spikes printed)

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

| Token            | Badge                          | Case                                                             |
| ---------------- | ------------------------------ | ---------------------------------------------------------------- |
| 1000             | `JyP9YGLfHqYxwH3ktm562`        | Active, card hash matches (default spike badge since 2026-11-13) |
| 900              | `JyP9WNtW9Fg9xoHfAjzm4`        | Active, card hash matches                                        |
| 1112, 1111, 1100 | `JyP9VYjZYJcQebdQ7ypD5` (1112) | **Revoked by their owner between 11-11 and 11-13**; card now 404 |
| 0                | `JyP9TtQC3HCNrTYR3sc2T`        | Active, card URL 404 → **card hash mismatch**                    |
| 1050             | —                              | Active, card 404 → mismatch                                      |
| 15               | `JyP9UApR1fgJJL79x1xQT`        | **Revoked**                                                      |
| 999999           | `JyP9V5dupAgxNyUmSS4CG`        | **Not found**                                                    |

**Fixture drift:** third-party testnet agents change under us (1112 was revoked two days after it was picked). Tests never depend on live fixtures; the demo will use Countersign's own agent registered by the merchant persona account.

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
pnpm spike                      # runs all three below in order + prints a PASS/FAIL summary
pnpm spike:registry             # default badge JyP9VYjZYJcQebdQ7ypD5; also try 0, 15, 999999
pnpm spike:registry 1000 --via grpc
pnpm spike:proof create         # then: pnpm spike:proof verify --presentation <file>
pnpm spike:anchor               # --dry-run to skip submission
```

---

## Phase 1 plan — checklist (in progress, branch `phase-1-onboarding`)

Goal for 2026-11-22: a merchant connects a wallet, proves identity with a ZK proof, links a registered agent and gets a verify link, a widget snippet and an API key, end to end on testnet.

**Decisions taken at kickoff (2026-11-13)** — user: "we do not want to use any mock thing now"; defaults applied:

- **P1 — No mocks.** No mock modes, fake wallets or stand-in services in the product or its test flow. Real wallet, real testnet, real Postgres. Unit tests cover pure logic only; anything touching the chain or a wallet is exercised for real on the user's Mac (`CONCORDIUM_INTEGRATION=1`). DB tests use PGlite (real Postgres compiled to WASM). The dev-only `hosted` registry fallback is dropped: the trust service reads the chain only. _Exception still required by `CLAUDE.md` for Phase 3: escrow on Protocol-Level Locks is not live on testnet, so it must sit behind a clearly named mock adapter — to be confirmed with the user then._
- **P2 — Account credentials only** for merchant proofs (`claimsBuilder().addAccountClaims`). The verified identity is bound to the connected account, which must also own the agent NFT.
- **P3 — Link existing badges first**; in-console agent registration (card + `register` signed in the wallet) is the stretch goal.
- **P4 — Testnet code runs on the user's Mac** until the trust service is deployed.
- **P5 — No age check in merchant proofs (2026-11-13).** First real run: the Browser Wallet showed "Age: 18 years or older" in red and offered only Reject — the merchant persona's test identity could not satisfy `addMinimumAge(18)`. The user chose to drop it: for a business the accountability anchor is the verified identity behind the account (every Concordium account requires one), and age adds little. Claims are now account credential + `revealAttribute('countryOfResidence')` only. Wallet behaviour noted: unsatisfiable statements render red and the Approve button is hidden.

**Confirmed wallet APIs (read from the packages, 2026-11-13)**

- `@concordium/browser-wallet-api-helpers` **3.3.0** (depends on `@concordium/web-sdk ^12.0.2`): `detectConcordiumProvider(timeout?)` → `WalletApi` with `requestAccounts(): string[]`, `getSelectedChain(): genesisHash | undefined`, **`requestVerifiablePresentationV1(request: VerificationRequestV1.Type): VerifiablePresentationV1.Type`**, `sendTransaction(account, AccountTransactionType.Update, payload, params, schema)`, `signMessage`. → The Browser Wallet answers V1 proof requests directly; no WalletConnect needed for desktop.
- `@concordium/wallet-connectors` **0.9.0** exposes only the legacy V0 `requestVerifiablePresentation(challenge, statements)` and pins helpers `3.3.0-alpha.0` → **not used**.
- `@concordium/verification-web-ui` **0.2.1**: React/Vue/vanilla modals over WalletConnect (`@walletconnect/sign-client`), method `request_verifiable_presentation_v1`, chain `ccd:4221332d34e1694168c2a0c0b3fd0f27` (testnet). Flow: `renderUIModals()` → `session_approved {topic}` → create request with `connectionId = topic` → `sendPresentationRequest(request, topic)` → `presentation_received`. → Second path for phone wallets / Concordium ID app; uses `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- web-sdk in the browser: `@concordium/rust-bindings` browser build inlines its WASM (4.6 MB) → load web-sdk with a dynamic `import()` only on the verify step.
- Verification checks done by `VerificationAuditRecordV1.createChecked`: context match, `verifyWithNode`, credentials Active, `verifyAnchor` of the VRA, claims vs request incl. issuer IdP. Countersign adds: the account credential's account (via `getAccountInfo(credId)`) must equal the connected account — checked **before** the VAA is anchored. Revealed attributes arrive as `AttributeValue` statements.

- **D12 — Merchant display name is self-declared (open).** The proof establishes an accountable, verified person (valid IdP identity, revealed country) behind the account; the business name they type is not proven. The LEI path (stretch) would prove a legal entity name. The verify page must word this honestly.
- **D13 — One `.env` at the repo root for every app.** `apps/web/next.config.ts` loads it with `process.loadEnvFile` before compilation so `NEXT_PUBLIC_*` values are inlined (verified in a build).

- **D14 — Trust service deploys to Railway from `apps/trust-service/Dockerfile` (2026-11-13, user choice).** Build context is the repo root; Railway picks the file via the `RAILWAY_DOCKERFILE_PATH` service variable. Railway's `railway.toml`/`railway.json` config-as-code is **deprecated and stops being read on 2026-12-01** (before submission), and its replacement (IaC, `.railway/railway.ts`) needs the Railway CLI — so service settings (healthcheck `/healthz`, domain, branch) live in the dashboard and are documented here instead. Image runs `node --import tsx src/index.ts` (tsx is now a runtime dependency); listens on Railway's `PORT`; migrations on startup. The anchor key comes from the sealed variable `ANCHOR_WALLET_EXPORT_JSON` (file contents) — testnet-only, low balance. Verified without Docker by replaying the Dockerfile steps in a clean directory: frozen-lockfile prod install (129 packages) → service starts, `/healthz` 200, merchant routes 503 without DB/key.
- **D15 — Railway trial caveat.** Unverified (limited) trial accounts have restricted outbound network/ports; the trust service needs outbound gRPC to `grpc.testnet.concordium.com:20000`. Needs the GitHub-verified full trial ($5 one-time, 30 days) or Hobby ($5/month). User decides on spend.

**Prerequisites (user)**

- [x] Anchoring service account `.export` (B2), funded with Request CCD — `3k3MRAXGqgS8b6FCa2MjX5adcowmf1LhEnd8xfHT4J7Jnse3k4`
- [x] Reown (WalletConnect) project id — in the user's local `.env`
- [x] Merchant persona: Account B in the Browser Wallet, same testnet identity
- [x] gRPC location: the user's Mac (P4)
- [x] Docker on the Mac for Postgres + Redis (`pnpm infra:up`)

**Slice 1 — merchant verification (real, end to end)**

- [x] Drizzle schema + SQL migrations: `merchant`, `agent`, `receipt`, `report` (brief) + `verification_session`, `api_key`; migrate on startup
- [x] `POST /merchants/proof-request`: account claims → `createAndAnchor` → wait for finalization → store session → return request JSON
- [x] `POST /merchants/proof-verify`: `createChecked` → account binding → `registerAnchor` (VAA) → store revealed attributes only + VAA ref → upsert merchant
- [x] `/console`: detect Browser Wallet → testnet check → `requestAccounts` → display name → `requestVerifiablePresentationV1` → result with CCDScan links (renders headless with no errors; web-sdk chunk 5.4 MB loads only on Verify)
- [x] **User ran it on the Mac, 2026-11-13 — merchant "Mama's Fabrics · DK" verified from Account B.** VRA `724958807a462f1cacdaf9cc2b1760af500e6c2cda7cfd017882f0885d6a5d2d` (block 50763603) → wallet proof → `createChecked` + account binding → VAA `b16036a11c171ea012589c7f458e6ee90079478e1c51c0434b934c133ef875da` (block 50763611). Both confirmed on CCDScan (`REGISTER_DATA`, Success). Three earlier VRAs (`3282a99e…`, `4ebb324e…` and the age-check attempt) were abandoned requests.

**Slice 2 — agent linking + issuance**

- [ ] `POST /agents`: parse badge → chain read → Active + card hash match + on-chain owner = merchant account → store channels
- [ ] Issue verify link, widget snippet, API key (shown once, stored hashed)
- [ ] `/console/agents/new` + `/console/done`
- [ ] Phone-wallet path via `verification-web-ui` (WalletConnect)

**Tests**

- [x] Unit: claims, request JSON round-trip, disclosed-attribute extraction
- [ ] Unit: `/agents` rules
- [x] DB tests on PGlite (real Postgres): migrations, merchant upsert, route guards
- [ ] `CONCORDIUM_INTEGRATION=1`: proof-request anchors and `verifyAnchor` passes (run on the Mac)
- [ ] Playwright smoke against the real local stack (pages render, trust service healthy); the wallet step is manual
- [ ] Commit at checkpoint
