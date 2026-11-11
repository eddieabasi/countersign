/**
 * Spike (a): read an agent from the Concordium Agent Registry (CIS-8004) on testnet.
 *
 *   pnpm spike:registry [badge | tokenId] [--via grpc|hosted|both]
 *
 * Two independent paths:
 *  - grpc:   web-sdk → getInstanceInfo → embedded schema → invokeContract(CIS-8004.agentOf)
 *            → fetch Agent Card → SHA-256 vs on-chain metadata_hash   (the trust-service path)
 *  - hosted: Concordium's hosted registry REST `/v1/check-badge` + MCP `agent_of` (cross-check)
 */
import { parseArgs } from 'node:util';
import { ContractAddress } from '@concordium/web-sdk';
import { badgeFor, isRegistry, parseBadge } from '../../src/concordium/badge.ts';
import { fetchCardSha256 } from '../../src/concordium/card.ts';
import { HostedRegistryClient } from '../../src/concordium/hosted-registry.ts';
import { readAgentOnChain } from '../../src/concordium/registry.ts';
import { cfg, connectGrpc, heading, kv } from './_lib.ts';

type Checks = { found: boolean; active: boolean; cardHashMatches: boolean | null };

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { via: { type: 'string', default: 'both' } },
});
const registry = { index: cfg.CIS8004_CONTRACT_INDEX, subindex: cfg.CIS8004_CONTRACT_SUBINDEX };
const input = positionals[0] ?? 'JyP9VYjZYJcQebdQ7ypD5'; // testnet token 1112, card verifies
const badge = /^\d+$/.test(input) ? badgeFor(registry, BigInt(input)) : input;
const results: Record<string, Checks> = {};

heading('Badge (offline decode, web-sdk tokenAddressFromBase58)');
const parsed = parseBadge(badge);
kv('badge', parsed.short);
kv('contract', `<${parsed.contract.index},${parsed.contract.subindex}>`);
kv('token id', parsed.tokenId);
kv('trusted registry', isRegistry(parsed, registry) ? 'yes (official testnet CIS-8004)' : 'NO');

if (values.via !== 'grpc') {
  heading('Hosted Concordium registry (REST + MCP)');
  const hosted = new HostedRegistryClient(cfg.AGENT_REGISTRY_API_URL);
  try {
    const check = (await hosted.checkBadge(parsed.short)) as {
      on_chain?: { status?: string; owner_account?: string; metadata_hash_hex?: string };
      checks?: Record<string, boolean>;
      badge_valid?: boolean;
      issues?: { message: string }[];
    };
    kv('GET /v1/check-badge', 'ok');
    kv('owner', check.on_chain?.owner_account);
    kv('status', check.on_chain?.status);
    kv('checks', check.checks);
    kv(
      'badge_valid',
      `${check.badge_valid} ${check.issues?.map((i) => i.message).join('; ') ?? ''}`,
    );
    results.hosted = {
      found: !!check.checks?.on_chain_agent_found,
      active: !!check.checks?.status_active,
      cardHashMatches: check.checks?.hash_matches_on_chain ?? null,
    };
    const agentOf = (await hosted.callTool('agent_of', {
      token_id: parsed.tokenId.toString(),
      network: cfg.CONCORDIUM_NETWORK,
    })) as { registered_at?: string } | null;
    kv('MCP agent_of', agentOf ? `registered_at=${agentOf.registered_at}` : 'null → not_found');
  } catch (e) {
    console.log(`  ✗ hosted registry failed: ${(e as Error).message}`);
  }
}

if (values.via !== 'hosted') {
  heading('Direct chain read (gRPC, web-sdk invokeContract)');
  const client = await connectGrpc();
  if (client) {
    try {
      const contract = ContractAddress.create(registry.index, registry.subindex);
      const agent = await readAgentOnChain(client, contract, parsed.tokenId);
      if (!agent) {
        kv('agentOf', 'None → not_found');
        results.grpc = { found: false, active: false, cardHashMatches: null };
      } else {
        kv('owner', agent.owner);
        kv('status', agent.status);
        kv('agent_uri', agent.agentUri ?? '(none)');
        kv('metadata_hash', agent.metadataHashHex ?? '(none)');
        kv('registered_at', agent.registeredAt);
        let cardHashMatches: boolean | null = null;
        if (agent.agentUri && agent.metadataHashHex) {
          const card = await fetchCardSha256(agent.agentUri);
          kv(
            'card fetch',
            card.ok ? `HTTP ${card.httpStatus}, sha256 ${card.sha256Hex}` : card.error,
          );
          cardHashMatches = card.ok && card.sha256Hex === agent.metadataHashHex;
        }
        results.grpc = { found: true, active: agent.status === 'Active', cardHashMatches };
      }
    } catch (e) {
      console.log(`  ✗ ${(e as Error).message}`);
    }
  }
}

heading('Summary (inputs to the verdict; NOT a verdict)');
for (const [src, c] of Object.entries(results)) kv(src, c);
const sources = Object.values(results);
if (sources.length === 2) {
  kv('sources agree', JSON.stringify(sources[0]) === JSON.stringify(sources[1]));
}
process.exit(sources.length > 0 ? 0 : 1);
