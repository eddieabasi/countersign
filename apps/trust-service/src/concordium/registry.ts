import {
  ContractName,
  EntrypointName,
  Parameter,
  ReceiveName,
  ReturnValue,
  deserializeReceiveReturnValue,
  getEmbeddedModuleSchema,
  type ConcordiumGRPCClient,
  type ContractAddress,
} from '@concordium/web-sdk';
import { tokenIdHexToU64 } from './badge.ts';

/** On-chain contract name of the official CIS-8004 Agent Registry (confirmed via CCDScan). */
export const CIS8004_CONTRACT_NAME = 'CIS-8004';

export type AgentStatus = 'Active' | 'Revoked';

/** Normalised result of the CIS-8004 `agentOf(token_id)` view. */
export type AgentRecord = {
  tokenId: bigint;
  owner: string;
  status: AgentStatus;
  agentUri?: string;
  /** SHA-256 of the Agent Card bytes, lowercase hex. */
  metadataHashHex?: string;
  agentWallet?: string;
  registeredAt?: string;
  revokedAt?: string;
  revocationReason?: string;
};

/** Any failure to read the registry. Callers MUST treat this as `registry_unavailable` (fail closed). */
export class RegistryReadError extends Error {
  override name = 'RegistryReadError';
}

type Opt<T> = { None: [] } | { Some: [T] };

function unwrapOption<T>(v: unknown, field: string): T | undefined {
  if (v && typeof v === 'object') {
    if ('None' in v) return undefined;
    if ('Some' in v && Array.isArray((v as { Some: unknown[] }).Some)) {
      return (v as { Some: [T] }).Some[0];
    }
  }
  throw new RegistryReadError(`unexpected Option encoding for ${field}`);
}

function isByte(b: unknown): boolean {
  // The SDK's schema decoder parses numbers with json-bigint, so u8 elements arrive as BigInt.
  if (typeof b === 'bigint') return b >= 0n && b <= 255n;
  return typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 255;
}

function describe(v: unknown): string {
  const json = JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? `${x}n` : x));
  return `${Array.isArray(v) ? 'array' : typeof v}: ${(json ?? String(v)).slice(0, 80)}`;
}

/**
 * Bytes as decoded by web-sdk 12.0.2: `[u8; N]` → array of BigInt (verified against the SDK),
 * `ByteArray`/`ByteList` → hex string. Plain numbers accepted for robustness.
 */
function bytesToHex(v: unknown, field: string): string {
  if (Array.isArray(v) && v.every(isByte)) {
    return Buffer.from(v.map((b) => Number(b as number | bigint))).toString('hex');
  }
  if (typeof v === 'string' && /^(0x)?[0-9a-f]*$/i.test(v))
    return v.replace(/^0x/i, '').toLowerCase();
  throw new RegistryReadError(`unexpected byte encoding for ${field} (${describe(v)})`);
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string') throw new RegistryReadError(`expected string for ${field}`);
  return v;
}

/**
 * Normalise the schema-decoded return value of `agentOf`.
 * The shape is `Option<AgentView>`; field names verified against the deployed module schemas
 * (142462ff… and e69e11fe…), see docs/DECISIONS.md.
 */
export function normalizeAgentOf(decoded: unknown): AgentRecord | null {
  const view = unwrapOption<Record<string, unknown>>(decoded as Opt<unknown>, 'agentOf');
  if (view === undefined) return null;

  const statusObj = view['status'];
  let status: AgentStatus;
  if (statusObj && typeof statusObj === 'object' && 'Active' in statusObj) status = 'Active';
  else if (statusObj && typeof statusObj === 'object' && 'Revoked' in statusObj) status = 'Revoked';
  else throw new RegistryReadError('unknown agent status');

  const agentUri = unwrapOption<string>(view['agent_uri'], 'agent_uri');
  const hash = unwrapOption<unknown>(view['metadata_hash'], 'metadata_hash');
  const wallet = unwrapOption<string>(view['agent_wallet'], 'agent_wallet');
  const revokedAt = unwrapOption<string>(view['revoked_at'], 'revoked_at');
  const revocationReason = unwrapOption<string>(view['revocation_reason'], 'revocation_reason');
  const registeredAt = view['registered_at'];

  const record: AgentRecord = {
    tokenId: tokenIdHexToU64(asString(view['token_id'], 'token_id')),
    owner: asString(view['owner_account'], 'owner_account'),
    status,
  };
  if (agentUri !== undefined) record.agentUri = asString(agentUri, 'agent_uri');
  if (hash !== undefined) record.metadataHashHex = bytesToHex(hash, 'metadata_hash');
  if (wallet !== undefined) record.agentWallet = asString(wallet, 'agent_wallet');
  if (typeof registeredAt === 'string') record.registeredAt = registeredAt;
  if (revokedAt !== undefined) record.revokedAt = asString(revokedAt, 'revoked_at');
  if (revocationReason !== undefined) record.revocationReason = revocationReason;
  return record;
}

/** CIS-2 `TokenIdU64` parameter encoding: 1-byte length prefix (8) + u64 little-endian. */
export function encodeTokenIdU64Param(tokenId: bigint): Uint8Array {
  const buf = Buffer.alloc(9);
  buf.writeUInt8(8, 0);
  buf.writeBigUInt64LE(tokenId, 1);
  return buf;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

const schemaCache = new Map<string, Awaited<ReturnType<typeof getEmbeddedModuleSchema>>>();

/**
 * Read one agent straight from the CIS-8004 contract over gRPC.
 * The schema is taken from the instance's *current* module (the registry has been upgraded at
 * least once), so decoding follows whatever is deployed.
 * Returns `null` when no agent exists for the token id. Throws RegistryReadError otherwise.
 */
export async function readAgentOnChain(
  client: ConcordiumGRPCClient,
  contract: ContractAddress.Type,
  tokenId: bigint,
): Promise<AgentRecord | null> {
  try {
    const info = await client.getInstanceInfo(contract);
    const moduleRef = info.sourceModule.moduleRef;
    let schema = schemaCache.get(moduleRef);
    if (!schema) {
      schema = await getEmbeddedModuleSchema(await client.getModuleSource(info.sourceModule));
      if (!schema) throw new RegistryReadError(`module ${moduleRef} has no embedded schema`);
      schemaCache.set(moduleRef, schema);
    }

    const result = await client.invokeContract({
      contract,
      method: ReceiveName.fromString(`${CIS8004_CONTRACT_NAME}.agentOf`),
      parameter: Parameter.fromBuffer(toArrayBuffer(encodeTokenIdU64Param(tokenId))),
    });
    if (result.tag !== 'success' || !result.returnValue) {
      throw new RegistryReadError(`agentOf invoke failed: ${JSON.stringify(result)}`);
    }

    const decoded: unknown = deserializeReceiveReturnValue(
      toArrayBuffer(ReturnValue.toBuffer(result.returnValue)),
      schema.buffer,
      ContractName.fromString(CIS8004_CONTRACT_NAME),
      EntrypointName.fromString('agentOf'),
      schema.type === 'unversioned' ? schema.version : undefined,
    );
    return normalizeAgentOf(decoded);
  } catch (e) {
    if (e instanceof RegistryReadError) throw e;
    throw new RegistryReadError(`registry read failed: ${(e as Error).message}`);
  }
}
