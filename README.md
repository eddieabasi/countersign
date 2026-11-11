# Countersign

A trust layer for conversational commerce. Every business AI agent carries proof that a verified,
accountable entity stands behind it. Any buyer or buyer-agent can check that proof in one tap or one
API call before paying, and every checkout leaves an anchored Trust Receipt for disputes. Built on
Concordium's Agent Registry (CIS-8004) and zero-knowledge identity layer, **testnet only**.

> A Countersign verdict confirms an accountable verified entity stands behind the agent. It does not
> vouch for goods, prices or agent code.

- Product spec: [`docs/SPEC.md`](docs/SPEC.md)
- Build brief: [`CLAUDE.md`](CLAUDE.md)
- Decisions, verified Concordium calls, phase checklists: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Layout

```
apps/web            Next.js — Merchant Console, public Verify page (Phase 1–2)
apps/trust-service  Fastify — Verify API, MCP server, proofs, receipts (@concordium/web-sdk)
apps/seller-agent   Reference sales agent (Phase 3)
packages/shared     Verdict types, zod schemas, Concordium constants
packages/widget     Embeddable verify widget (Phase 2)
infra/              docker-compose: Postgres + Redis
```

## Quick start

Requires Node ≥ 22.12 and pnpm 10.

```bash
pnpm install
cp .env.example .env
pnpm infra:up                  # Postgres + Redis (Docker)
pnpm --filter @countersign/trust-service dev   # http://localhost:4000/healthz
pnpm --filter @countersign/web dev             # http://localhost:3000
pnpm check                     # format, lint, typecheck, test
```

Phase 0 spikes against testnet are described in `docs/DECISIONS.md` (`pnpm spike:registry`,
`pnpm spike:proof`, `pnpm spike:anchor`).
