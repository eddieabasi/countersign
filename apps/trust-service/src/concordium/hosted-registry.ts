/**
 * Thin client for Concordium's hosted Agent Registry service (REST + MCP JSON-RPC).
 * https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/mcp-service.html
 *
 * This is a convenience and a cross-check, not the trust root: the badge docs state that a hosted
 * resolver "returns chain-derived data the consumer can re-check". Countersign's verdict reads the
 * chain itself (see registry.ts).
 */
export class HostedRegistryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 10_000,
  ) {}

  /** `GET /v1/check-badge/{badge}` — on-chain record, card hash, badge-block conformance. */
  async checkBadge(badge: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/v1/check-badge/${encodeURIComponent(badge)}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body: unknown = await res.json();
    if (!res.ok) throw new Error(`check-badge HTTP ${res.status}: ${JSON.stringify(body)}`);
    return body;
  }

  /** Call an MCP tool (e.g. `contract_info`, `agent_of`, `verify_agent_card`). */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = (await res.json()) as {
      result?: { content?: { type: string; text: string }[]; isError?: boolean };
      error?: unknown;
    };
    if (body.error || body.result?.isError) {
      throw new Error(`MCP ${name} failed: ${JSON.stringify(body.error ?? body.result)}`);
    }
    const text = body.result?.content?.find((c) => c.type === 'text')?.text;
    if (text === undefined) throw new Error(`MCP ${name}: no text content`);
    return JSON.parse(text) as unknown;
  }
}
