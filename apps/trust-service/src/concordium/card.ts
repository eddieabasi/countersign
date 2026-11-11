import { createHash } from 'node:crypto';

export type CardFetchResult =
  | { ok: true; httpStatus: number; sha256Hex: string; bytes: Uint8Array }
  | { ok: false; error: string; httpStatus?: number };

/**
 * Fetch an Agent Card and hash the *raw response bytes* (what the registry's metadata_hash commits
 * to). HTTPS only, bounded size and time.
 * TODO(Phase 2): SSRF hardening — resolve the host and refuse private/link-local addresses.
 */
export async function fetchCardSha256(
  uri: string,
  { timeoutMs = 5_000, maxBytes = 256 * 1024 }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<CardFetchResult> {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return { ok: false, error: 'agent_uri is not a URL' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'agent_uri must be https' };

  try {
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, httpStatus: res.status };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) return { ok: false, error: 'card too large', httpStatus: 200 };
    return {
      ok: true,
      httpStatus: res.status,
      bytes: buf,
      sha256Hex: createHash('sha256').update(buf).digest('hex'),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
