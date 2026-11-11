# Countersign — build brief for Claude Code

Countersign (working name) is a trust layer for conversational commerce. Every business AI agent
carries proof that a verified, accountable entity stands behind it; any buyer or buyer-agent can
check that proof in one tap or one API call before paying; every checkout leaves an anchored
Trust Receipt for disputes. Built on Concordium's agent identity layer for the Concordium Trusted
Agents Hackathon (Encode Club). Global product — nothing country-specific.

Full product spec: `docs/SPEC.md` (exported from the Claude Doc). Read it before Phase 1.

## Hard dates
- Build opens: 2026-11-19 (testnet)
- Checkpoint 1: 2026-11-22 → merchant onboarding must work end to end
- Submission: 2026-12-09

## Non-negotiables
- TypeScript everywhere. pnpm monorepo. Strict TS, ESLint, Prettier.
- Concordium **testnet** only. Never touch mainnet keys.
- Pin every Concordium package to an exact version. Before writing integration code, read the
  current docs for that package and confirm the API names below still exist — the SDK moves fast.
  If an API differs from this brief, follow the docs and note the change in `docs/DECISIONS.md`.
- Wallet keys never touch the trust service. Merchants sign in their own wallet.
- No identity documents stored anywhere. Buyer references on receipts are hashed.
- Verdicts **fail closed**: any registry error, revoked badge, card-hash mismatch or suspension → `NOT_VERIFIED`.
- Anything not live on testnet yet (e.g. Protocol-Level Locks escrow) goes behind a clearly named mock adapter.
- Secrets via `.env` (never committed); provide `.env.example`.
- Ask before: installing global tools, spending real funds, or deviating from the architecture.

## Repo layout
```
apps/
  web/              Next.js (App Router) — Merchant Console + public Verify page + widget
  trust-service/    Node + Fastify — Verify API, MCP server, proofs, receipts (@concordium/web-sdk)
  seller-agent/     Reference sales agent (Claude Agent SDK, TS) on web chat
packages/
  shared/           Types, zod schemas, verdict enum, API client
  widget/           Embeddable verify widget (vanilla TS bundle)
infra/
  docker-compose.yml  Postgres + Redis
docs/
  SPEC.md  DECISIONS.md  DEMO.md
```

## Concordium building blocks (confirm each against current docs)
| Need | Package / component |
|---|---|
| Node queries, contract reads, tx signing | `@concordium/web-sdk` (gRPC client) |
| ZK proof requests + verification | `VerificationRequestV1.createAndAnchor`, `VerifiablePresentationV1.verifyWithNode` (web-sdk) |
| Prebuilt proof UI | `@concordium/verification-web-ui` |
| Audit records (Trust Receipts evidence) | web-sdk verifiable audit record helpers |
| Wallet connect | Concordium Browser Wallet API + WalletConnect (CryptoX) |
| Agent registration + badge | Concordium Agent Registry (CIS-8004 / ERC-8004 Agent Card); badge is CIS-2 |
| Agent-side checks | Concordium MCP server |
| Payments | x402 (Concordium integration in the x402 repo) + testnet stablecoin (EURQ) |
| Business identity | Global FinReg LEI flow (stretch goal) |

## Trust service API
| Endpoint | Purpose |
|---|---|
| `POST /merchants/proof-request` | Create + anchor a verification request |
| `POST /merchants/proof-verify` | Verify presentation, store outcome + audit record |
| `POST /agents` | Link a registered agent (badge id, Agent Card URI, channels) to a merchant |
| `GET /verify/:badgeOrHandle` | Public verdict |
| `POST /receipts` | Create + anchor a Trust Receipt |
| `GET /receipts/:id` | Fetch receipt + anchor |
| `POST /reports` | Buyer flags an agent |

MCP tools on the same service: `verify_agent`, `create_receipt`, `get_receipt`.

Verdict response shape:
```ts
type Verdict = {
  status: 'VERIFIED' | 'NOT_VERIFIED';
  reasons: string[];            // e.g. 'not_found','revoked','card_hash_mismatch','suspended','channel_mismatch','registry_unavailable'
  merchant?: { displayName: string; country?: string; verifiedAt: string };
  agent?: { badgeId: string; channels: string[]; activeSince: string };
  checkedAt: string;
  scope: 'Confirms an accountable verified entity stands behind this agent. Does not vouch for goods, prices or agent code.';
};
```
`VERIFIED` only if: found in registry AND active AND card hash matches on-chain AND not suspended
(AND channel matches, when a channel is passed). Cache verdicts in Redis, short TTL.

## Data model (Postgres, use Drizzle or Prisma)
- `merchant` — id, display_name, wallet_account, verification_method (individual|lei), disclosed_attributes jsonb, verified_at, audit_record_ref
- `agent` — id, merchant_id, badge_id, agent_card_uri, channels text[], status (active|suspended|revoked), created_at
- `receipt` — id, agent_id, buyer_ref_hash, offer jsonb, price, currency, terms_hash, anchor_tx_hash, payment_ref, created_at
- `report` — id, agent_id, reason, status, created_at

## Build phases (commit at the end of each, keep the app runnable)
**Phase 0 — spike (before Nov 19):** scaffold monorepo + docker-compose; testnet account; one script each that
(a) reads an agent from the Agent Registry, (b) creates+verifies a proof request, (c) anchors an audit record.
Record exact working API calls in `docs/DECISIONS.md`.

**Phase 1 — onboarding (by Nov 22, checkpoint):** Merchant Console: wallet connect → proof request →
verify → register/link agent → issue verify link, widget snippet, API key.

**Phase 2 — verify layer (Nov 23–29):** `GET /verify`, verdict logic + cache, public Verify page,
embeddable widget with channel binding, MCP server with `verify_agent`, reports.

**Phase 3 — receipts + payments (Nov 30–Dec 5):** receipts API + anchoring, reference seller agent on
web chat that shares its verify link and calls `create_receipt`, x402/stablecoin testnet checkout,
receipt page for disputes, mock escrow adapter.

**Phase 4 — demo (Dec 6–9):** seed data, clone-agent scenario, `docs/DEMO.md` script, README, deploy
(web on Vercel, trust-service in a container), record demo.

## Demo the build must support
1. Merchant verifies in the console, links agent, badge appears.
2. Buyer chats with the agent, taps verify link, sees verdict.
3. A clone agent with a copied badge is flagged (channel mismatch).
4. A buyer agent calls `verify_agent` over MCP, gets `VERIFIED`, pays.
5. Receipt opens with anchored offer, verified merchant, payment reference.

## Testing
- Unit tests for verdict logic (every failure reason) — Vitest.
- Integration tests against testnet behind an env flag; mocks for CI.
- Playwright smoke test for onboarding and the verify page.

## Working style
- Plan each phase as a short checklist before coding; tick it off in `docs/DECISIONS.md`.
- Small commits with clear messages.
- When a Concordium API is unclear, read the docs or the SDK source — don't guess.
