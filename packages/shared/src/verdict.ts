import { z } from 'zod';

/** The plain-language scope line shown under every verdict. Never omit it. */
export const VERDICT_SCOPE =
  'Confirms an accountable verified entity stands behind this agent. Does not vouch for goods, prices or agent code.' as const;

export const VERDICT_STATUSES = ['VERIFIED', 'NOT_VERIFIED'] as const;
export type VerdictStatus = (typeof VERDICT_STATUSES)[number];

/**
 * Every reason a verdict can be NOT_VERIFIED. Verdicts fail closed: any of these → NOT_VERIFIED.
 * - not_found: no agent at this badge in the trusted registry
 * - untrusted_registry: badge resolves to a CIS-8004 contract we do not trust
 * - revoked: registry status is Revoked
 * - card_unavailable: Agent Card could not be fetched (so the hash cannot be checked)
 * - card_hash_mismatch: SHA-256 of the served card ≠ on-chain metadata_hash (or either is absent)
 * - suspended: Countersign suspended or revoked the agent (standing)
 * - not_linked: the agent is not linked to a verified Countersign merchant
 * - channel_mismatch: the presenting channel is not one the merchant registered
 * - registry_unavailable: chain/registry read failed — unknown is never shown as verified
 * - invalid_badge: badge string could not be parsed
 */
export const VERDICT_REASONS = [
  'invalid_badge',
  'not_found',
  'untrusted_registry',
  'revoked',
  'card_unavailable',
  'card_hash_mismatch',
  'suspended',
  'not_linked',
  'channel_mismatch',
  'registry_unavailable',
] as const;
export type VerdictReason = (typeof VERDICT_REASONS)[number];

export const VerdictSchema = z.object({
  status: z.enum(VERDICT_STATUSES),
  reasons: z.array(z.enum(VERDICT_REASONS)),
  merchant: z
    .object({
      displayName: z.string(),
      country: z.string().optional(),
      verifiedAt: z.iso.datetime(),
    })
    .optional(),
  agent: z
    .object({
      badgeId: z.string(),
      channels: z.array(z.string()),
      activeSince: z.iso.datetime(),
    })
    .optional(),
  checkedAt: z.iso.datetime(),
  scope: z.literal(VERDICT_SCOPE),
});
export type Verdict = z.infer<typeof VerdictSchema>;
