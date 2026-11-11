# Verified Commerce Agents — E2E Build Spec

Nov 9, 2026 · @Eddie Otudor

> Exported from the Claude Doc <https://claude.ai/artifact/LErH7RxQxAKcmEqW8FhJp1> (rev 13) on 2026-11-11.
> Two embedded diagrams (architecture, hackathon timeline) do not export to Markdown and are shown as
> placeholders; open the doc to see them.

## Executive summary

Countersign (working name) is a trust layer for conversational commerce: every business AI agent carries proof that a verified, accountable entity stands behind it, and every buyer or buyer-agent can check that proof in one tap or one API call before money moves.

- **Who it serves:** businesses selling through AI agents on WhatsApp, Instagram, web chat and email; their customers; the buyer-side agents now shopping on people's behalf; and the platforms that host both.
- **What it does:** onboards a business, verifies it with Concordium's zero-knowledge identity layer, registers its agent in the Concordium Agent Registry, and exposes a public verify page, widget and API. Every checkout leaves an anchored audit record for disputes.
- **Why now:** agents already search, compare, buy and pay, and none of that works at scale until a counterparty can prove who it acts for. Concordium shipped the registry and badge; nobody has packaged them into a commerce product.
- **Market:** global from day one. No feature depends on one country; identity providers, channels and payment rails are all pluggable.
- **Goal:** win a grant in the Concordium Trusted Agents Hackathon (submissions close 9 Dec 2026), then sell it as a B2B SaaS to commerce platforms and agent builders.

## Problem and market

Commerce is moving into conversations run by agents, and none of those conversations can prove who stands behind the agent. McKinsey estimates agentic commerce could orchestrate $3–5 trillion of global commerce by 2030 ([Concordium, 5 Nov 2026](https://concordium.substack.com/p/the-agentic-economy-arrived-autumn)); every one of those transactions needs a trustworthy counterparty.

Three problems compound:

1. **Impersonation is free.** Anyone can spin up a chat agent with a brand's name and logo on WhatsApp, Instagram, Telegram or a lookalike site. Buyers have no reliable way to tell the real seller from a clone before they pay.
2. **Buyer agents can't judge sellers.** Shopping agents increasingly negotiate and pay on a person's behalf. They need a machine-readable answer to "is this seller's agent real and accountable?" in milliseconds, not a human squinting at a profile.
3. **Disputes have no evidence.** When an agent-led sale goes wrong, there is no tamper-proof record of which verified entity's agent made the offer, at what price, under what terms.

The infrastructure to fix this now exists but sits unused at the commerce layer. Concordium's Agent Registry reached 5,040 registered agents and 738,000+ agent-related transactions by 28 Oct 2026, with six platforms checking it ([source](https://concordium.substack.com/p/the-agentic-economy-arrived-autumn)). What is missing is the product that puts that proof in front of a buyer at the moment of purchase.

## Solution and value proposition

Countersign gives each side of an agent-led sale one thing it cannot get today: proof of who it is dealing with, at the moment it matters. It has four product surfaces:

1. **Merchant Console** — a business connects a Concordium wallet, proves its identity once with zero-knowledge proofs (individual ID or company LEI), registers its sales agent, and receives a Verified by Concordium badge plus an embeddable trust mark.
2. **Verify Page and Widget** — a public link and drop-in widget any buyer can tap from inside a chat: "Verified business · registered agent · active since \<date\>", without exposing the owner's documents.
3. **Verify API and MCP tool** — the same check for buyer agents and platforms, returning a signed verdict in one call before an agent pays or hands over data.
4. **Trust Receipts** — every quote and checkout produces an anchored audit record tying the offer, price and terms to the verified agent. This is the evidence for disputes and chargebacks.

| Who | Pain today | What Countersign gives them | Business value |
| --- | --- | --- | --- |
| Merchants | Clones steal sales and reputation | Portable trust mark on every channel | Higher conversion, fewer impersonation losses |
| Buyers | Can't tell real sellers from scams | One-tap proof before paying | Confidence to buy through chat |
| Buyer agents | No machine-readable seller trust | Verify API / MCP check in one call | Safe autonomous purchasing |
| Platforms and marketplaces | Liability for fraud on their rails | Verification layer they can require | Lower fraud, a compliance story |
| Payment providers | Disputes with no evidence | Trust Receipts per transaction | Faster, cheaper dispute resolution |

The badge says who is accountable; Countersign adds the commerce context around it — what was offered, when, and whether the agent is still in good standing.

## Concordium primitives used

Every core feature rides on a shipped Concordium component, so the build is integration work, not protocol work.

| Concordium component | What it guarantees | Countersign feature | Integration path |
| --- | --- | --- | --- |
| [Verified by Concordium badge](https://www.concordium.com/article/the-verified-by-concordium-badge-the-trust-mark-that-travels-with-your-agent) | A real, verified entity stands behind the agent and can be identified if something goes wrong | Trust mark shown on every channel | Agent Registry DApp / API |
| Agent Registry (CIS-8004, ERC-8004 Agent Card) | Agent is registered, active, and its card hash matches on-chain | Verify Page, Verify API | `@concordium/web-sdk` gRPC + contract reads |
| Zero-knowledge identity proofs | Selected attributes (e.g. country of residence) proven without revealing documents | Merchant onboarding with selective disclosure | `VerificationRequestV1` + `VerifiablePresentationV1` in web-sdk; `@concordium/verification-web-ui` |
| Corporate identity via LEI ([Global FinReg](https://concordium.substack.com/p/the-agentic-economy-arrived-autumn)) | A company's Legal Entity Identifier becomes an on-chain identity | Business-grade merchant verification | Global FinReg flow |
| Verifiable audit records | Private/public record pair tying a proof request to its response | Trust Receipts | web-sdk audit record helpers |
| Concordium MCP server | Agents check a counterparty's badge before interacting | Buyer-agent pre-payment checks | MCP |
| x402 integration, stablecoins (EURQ on testnet) | Agent payments with identity attached | Checkout | x402 SDK; PLT stablecoins |
| Wallets (browser extension, WalletConnect) | Users sign and prove from their own wallet | Merchant console login and signing | Browser Wallet API, WalletConnect |

Protocol-Level Locks (funds held until conditions are met) are still in development; escrow is planned for them but mocked in the MVP.

**What the badge does not do:** it does not review the agent's code, audit its behaviour, or approve its use case ([Concordium](https://www.concordium.com/article/the-verified-by-concordium-badge-the-trust-mark-that-travels-with-your-agent)). Countersign's own value sits in that gap: standing, transaction context and receipts.

## System architecture

Countersign is three layers: the people and agents who use it, a thin Countersign core, and Concordium underneath. One trust service owns every registry, proof and receipt call, so channels and agents never touch the chain directly.

> [embedded content: Countersign architecture · 3 layers, 13 components — see the Claude Doc]

Merchants and buyers come in through the web app; buyer and seller agents call the trust service directly over REST or MCP. The trust service fans out to identity, the registry, anchoring and payments, while the merchant's wallet signs proofs on their own device.

## End-to-end flows

Five flows cover the whole product, from a merchant's first sign-up to a dispute months later.

**1. Merchant onboarding (once, about 10 minutes)**

1. Merchant opens the console and connects a Concordium wallet (browser extension or WalletConnect).
2. Console requests a proof: the trust service creates and anchors a verification request; the merchant approves it in their wallet, disclosing only chosen attributes (e.g. country of residence) or proving their company LEI.
3. Trust service verifies the presentation against the node and stores the outcome and audit record.
4. Merchant registers their sales agent in the Agent Registry (ERC-8004 Agent Card) and links the badge in the console, listing the channels the agent runs on.
5. Console issues the verify link, widget snippet and API key.

**2. Buyer checks a seller in chat**

1. The agent shares its verify link, or the buyer taps the widget on the merchant's site.
2. Verify page calls `GET /verify/{badge}`; the trust service reads the registry (found, active, card hash) and Countersign standing.
3. Buyer sees the verdict: merchant name, disclosed country, agent channels, active since, plus the scope line. A channel mismatch or `NOT_VERIFIED` shows a clear warning.

**3. Buyer agent checks before paying**

1. A shopping agent receives an offer from a seller agent carrying a badge id.
2. It calls `verify_agent` over MCP (or the REST API, paid per call via x402).
3. On `VERIFIED` it proceeds; on anything else it walks away and tells its user why.

**4. Checkout with a Trust Receipt**

1. The seller agent makes an offer; it calls `create_receipt` with offer, price, currency and terms.
2. The trust service anchors the receipt and returns a receipt id and link.
3. Payment runs over x402 or stablecoin on testnet; the receipt records the payment reference.
4. Buyer and merchant both get the receipt link.

**5. Dispute**

1. Buyer or payment provider opens the receipt link.
2. Countersign shows the anchored offer, the verified merchant behind the agent, and the payment reference.
3. If fraud is confirmed, the agent is suspended and every future verify call returns `NOT_VERIFIED`; the accountable entity can be identified through Concordium's identity framework under its terms.

## Technical spec

The Concordium layer is TypeScript end to end (`@concordium/web-sdk`); the commerce agent stays framework-agnostic and talks to it over REST and MCP.

**Stack**

| Layer | Choice | Why |
| --- | --- | --- |
| Web app (console, verify page) | Next.js + React, `@concordium/verification-web-ui` | Prebuilt proof screens, one codebase for console and public pages |
| Trust service | Node.js (TypeScript) + `@concordium/web-sdk` | Native SDK for gRPC, registry reads, proofs, audit records |
| Database | Postgres | Merchants, agents, receipts, verdict cache |
| Cache | Redis | Verdict cache (short TTL) and rate limits |
| Sales agent (reference) | Claude Agent SDK, any LLM swappable | Calls the trust service as tools |
| Channels | Web chat first; WhatsApp Business API next | Web chat is fastest to demo |
| Payments | x402 on testnet; stablecoin settlement | Identity-aware agent payments |
| Hosting | Vercel (web) + a container host (trust service) | Fast deploys for the demo |

**Trust service API**

| Endpoint | Purpose | Caller |
| --- | --- | --- |
| `POST /merchants/proof-request` | Create and anchor a verification request | Console |
| `POST /merchants/proof-verify` | Verify the presentation, store the outcome | Console |
| `POST /agents` | Link a registered agent (badge id, Agent Card URI) to a merchant | Console |
| `GET /verify/{badgeOrHandle}` | Public verdict: verified, active, card match, merchant display name, country (if disclosed), standing | Verify page, buyers, platforms |
| `POST /receipts` | Create a Trust Receipt for a quote or checkout | Sales agent |
| `GET /receipts/{id}` | Fetch a receipt and its anchor for a dispute | Buyer, merchant, payment provider |
| `POST /reports` | Buyer flags an agent; feeds standing | Verify page |

The same `verify` and `receipts` calls are exposed as MCP tools (`verify_agent`, `create_receipt`, `get_receipt`) so any MCP-capable agent can use them.

**Data model**

- `merchant` — id, display name, wallet account, verification method (individual / LEI), disclosed attributes, verified_at.
- `agent` — id, merchant_id, badge id (CIS-2), Agent Card URI, channels, status (active / suspended / revoked).
- `verdict_cache` — badge id, found, active, card_hash_matches, checked_at.
- `receipt` — id, agent_id, buyer reference (hashed), offer, price, currency, terms hash, anchor tx hash, created_at.
- `report` — id, agent_id, reason, status.

**Verdict logic**

A verify call returns `VERIFIED` only when the agent is found in the registry, active (not revoked), its Agent Card hash matches on-chain, and Countersign has not suspended it. Anything else returns `NOT_VERIFIED` with reasons. Registry errors fail closed: unknown is never shown as verified.

## Security, privacy and trust model

Countersign proves accountability, not good behaviour, and the product says so plainly everywhere it shows a verdict.

**What a Countersign verdict means:** a verified person or company is accountable for this agent, the agent is registered and active, its published card matches what was committed on-chain, and it has not been suspended for abuse.

**What it does not mean:** that the goods are good, the price is fair, or the agent's code was audited. The verify page states this in one line under every verdict.

Controls:

- **Privacy by default.** No identity documents are stored by Countersign or put on-chain; merchants disclose only the attributes they choose. Buyer references on receipts are hashed.
- **Fail closed.** Registry outages, mismatched card hashes or revoked badges always return `NOT_VERIFIED`.
- **Badge binding.** A badge id alone proves nothing about who is presenting it. The verify page and widget are served from Countersign's domain and show the agent's registered channels, so a clone pasting a stolen badge on another channel is flagged as a channel mismatch.
- **Lookalike resistance.** Verify links are short, branded and on one domain; the widget shows the merchant's disclosed name, not the agent's self-description.
- **Standing.** Buyer reports and merchant suspensions feed an agent status that the verdict checks on every call.
- **Key hygiene.** Wallet keys never touch the trust service; merchants sign from their own wallet. Service keys live in a secrets manager, with a low-balance account for anchoring.
- **Rate limits and caching.** Short-TTL verdict cache plus per-key limits keep the API fast and abuse-resistant.

## Business model and go-to-market

Countersign makes money where trust has a price: merchants pay to be trusted, platforms pay to check at volume, and payment providers pay for dispute evidence.

**Revenue streams (pricing is a hypothesis to test with design partners)**

| Stream | Who pays | Model | Starting hypothesis |
| --- | --- | --- | --- |
| Verified Merchant plan | Merchants | Monthly subscription per verified agent | Low monthly fee; free tier for one agent on web chat |
| Verify API | Platforms, buyer-agent builders | Usage-based, per verification call | Free tier, then per-call; x402 pay-per-call for agents |
| Trust Receipts | Merchants, payment providers | Per receipt, bundled in higher plans | Included quota, overage per receipt |
| Platform license | Marketplaces, commerce SaaS | Annual white-label contract | Custom |

**Go-to-market, global from day one**

1. **Agent builders first.** Developers already shipping sales agents (Shopify apps, WhatsApp and Instagram automation tools, agent frameworks) add Countersign through an SDK and MCP tool in under an hour. They bring the merchants.
2. **Commerce platforms second.** Marketplaces and chat-commerce SaaS make "Verified by Countersign" a requirement or a premium badge for their sellers.
3. **Payment and dispute partners third.** Trust Receipts plug into chargeback and dispute workflows.

No feature is market-specific: identity runs through Concordium's identity providers and LEI, channels are adapters, and payments are stablecoin and x402 based.

**Competition and moat**

| Alternative | What it does | Gap Countersign fills |
| --- | --- | --- |
| [AgentGate](https://glama.ai/mcp/connectors/io.github.agentgate-builder/agentgate) | Checks a badge's registry status (MCP + paid API) | No merchant onboarding, no buyer UX, no receipts or standing |
| World ID AgentKit ([Browserbase docs](https://docs.browserbase.com/integrations/agentkit/introduction.md)) | Links agent wallets to unique verified humans | Proves personhood, not business accountability or commerce context |
| Traditional KYB vendors | Verify businesses for one platform | Not portable across channels; nothing for agents |
| Platform blue ticks | Verified badge inside one app | Doesn't travel; nothing machine-readable for buyer agents |

The moat is the receipts and standing data: every verified transaction makes the network more useful to the next platform that plugs in.

## Hackathon MVP and plan

The MVP proves the whole loop on testnet in one demo: a merchant gets verified, a buyer and a buyer agent check the seller, and a checkout leaves a Trust Receipt.

> [embedded content: Hackathon plan · 2 Nov to 9 Dec 2026 — see the Claude Doc]

Workshops, the 19 Nov build start, the 22 Nov checkpoint and the 9 Dec deadline are the programme's dates ([Concordium](https://concordium.substack.com/p/the-agentic-economy-arrived-autumn), [Web3 Voyager](https://web3voyager.com/blog/web3-hackathons-november-2026)); the build phases between them are our plan.

**In scope for the MVP**

- [ ] Merchant Console: wallet connect, ZK proof request and verification, agent linking
- [ ] Agent registered in the Agent Registry with a Verified by Concordium badge (testnet)
- [ ] Public Verify Page and embeddable widget with channel binding
- [ ] Verify API plus MCP tools (`verify_agent`, `create_receipt`, `get_receipt`)
- [ ] Reference seller agent on web chat that shares its verify link and issues receipts
- [ ] Checkout over x402 or stablecoin on testnet, with an anchored Trust Receipt
- [ ] Clone demo: a fake agent with a copied badge gets flagged

**Out of scope (post-hackathon):** WhatsApp and Instagram adapters, escrow on Protocol-Level Locks, standing scores, billing.

**Demo script (3 minutes)**

1. A merchant verifies in the console and links their agent; the badge appears.
2. A buyer chats with the agent, taps the verify link and sees the verdict.
3. A clone agent with the same name tries it; the verify page flags it.
4. A buyer agent calls `verify_agent` over MCP, gets `VERIFIED`, and pays.
5. The receipt opens with the anchored offer, the verified merchant and the payment reference.

**How it maps to what the programme asks for**

| Programme focus | Where Countersign shows it |
| --- | --- |
| Verified by Concordium badge | Every merchant agent carries one; the verify page renders it |
| ERC-8004 Agent Card in the Agent Registry | Registration in onboarding; card hash checked on every verify |
| MCP or A2A integration | Verify and receipt tools exposed over MCP |
| Agent payments | x402 / stablecoin checkout with identity attached |
| Real-world accountability | Trust Receipts and dispute flow |

**Sources:** [Concordium autumn update](https://concordium.substack.com/p/the-agentic-economy-arrived-autumn) · [Verified by Concordium badge](https://www.concordium.com/article/the-verified-by-concordium-badge-the-trust-mark-that-travels-with-your-agent) · [Concordium wallet developers](https://www.concordium.com/wallet/developers) · [Concordium JS SDK: verifiable presentations](https://docs.concordium.com/concordium-node-sdk-js/12.0.0/pages/verifiable-presentations.html) · [Verify-access UI tutorial](https://docs.concordium.com/en/mainnet/tutorials/verify-access/ui-integration.html) · [Hackathon launch announcement](https://www.kucoin.com/news/community/CCD/6ae85b25bbcb5200074585a9)

## Success metrics, risks and roadmap

Success is measured by whether buyers check before they pay and whether merchants see that it pays off.

**Metrics**

| Metric | What it shows |
| --- | --- |
| Verified agents live | Merchant adoption |
| Verify calls per week (human vs agent) | Buyer and buyer-agent demand |
| Verify-to-checkout rate | Whether trust lifts conversion |
| Trust Receipts issued | Transaction volume flowing through the layer |
| Impersonation reports resolved | Real fraud prevented |
| Platforms integrated | Distribution beyond direct merchants |

**Risks and mitigations**

| Risk | Mitigation |
| --- | --- |
| Merchants find wallet + ID onboarding too heavy | Guided console, LEI path for companies, one-time verification |
| Buyers ignore the trust mark | Put the check where they already are: inline widget, link previews, buyer-agent auto-checks |
| Badge copied onto a clone channel | Channel binding plus mismatch warnings on the verify page |
| Dependence on one identity network | Abstract the verifier behind our API; Concordium is the first provider, not the only one |
| Testnet/SDK changes during the hackathon | Pin SDK versions; mock adapters for anything not yet live (escrow) |
| "Verified" read as "safe" | Plain-language scope line under every verdict |

**Roadmap after the hackathon**

1. Mainnet launch with 10 design-partner merchants across at least three countries.
2. WhatsApp Business and Instagram adapters; Shopify app.
3. Escrowed checkout on Protocol-Level Locks once they ship.
4. Standing scores from receipts and reports; dispute-partner integrations.
5. Platform license and white-label widget.
