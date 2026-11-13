import { sql } from 'drizzle-orm';
import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const verificationMethod = pgEnum('verification_method', ['individual', 'lei']);
export const agentStatus = pgEnum('agent_status', ['active', 'suspended', 'revoked']);
export const sessionStatus = pgEnum('verification_session_status', [
  'pending',
  'verified',
  'failed',
]);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** A verified business (or individual) behind one or more agents. Holds disclosed attributes only. */
export const merchant = pgTable('merchant', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  /** Concordium account the merchant proved control of (account-credential proof). */
  walletAccount: text('wallet_account').notNull().unique(),
  verificationMethod: verificationMethod('verification_method').notNull(),
  /** Only what the merchant chose to reveal, e.g. { countryOfResidence: "NG" }. Never documents. */
  disclosedAttributes: jsonb('disclosed_attributes')
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  /** Transaction hash of the Verification Audit Anchor (VAA) on testnet. */
  auditRecordRef: text('audit_record_ref'),
  createdAt: createdAt(),
});

export const agent = pgTable(
  'agent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchant.id),
    /** Short Base58Check CIS-8004 token address. */
    badgeId: text('badge_id').notNull().unique(),
    agentCardUri: text('agent_card_uri'),
    channels: text('channels')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: agentStatus('status').notNull().default('active'),
    createdAt: createdAt(),
  },
  (t) => [index('agent_merchant_idx').on(t.merchantId)],
);

export const receipt = pgTable('receipt', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agent.id),
  buyerRefHash: text('buyer_ref_hash'),
  offer: jsonb('offer').notNull(),
  price: numeric('price').notNull(),
  currency: text('currency').notNull(),
  termsHash: text('terms_hash'),
  anchorTxHash: text('anchor_tx_hash'),
  paymentRef: text('payment_ref'),
  createdAt: createdAt(),
});

export const report = pgTable('report', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agent.id),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: createdAt(),
});

/**
 * One merchant proof attempt: the anchored request (VRA) and, on success, the private
 * Verification Audit Record (VAR) and its on-chain anchor (VAA). Not in the brief's data model;
 * needed to tie a presentation back to the exact request that was anchored.
 */
export const verificationSession = pgTable('verification_session', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAccount: text('wallet_account').notNull(),
  displayName: text('display_name').notNull(),
  request: jsonb('request').notNull(),
  vraTxHash: text('vra_tx_hash').notNull(),
  status: sessionStatus('status').notNull().default('pending'),
  /** Private audit record (request + presentation). Contains revealed attributes, no documents. */
  auditRecord: jsonb('audit_record'),
  vaaTxHash: text('vaa_tx_hash'),
  failureReason: text('failure_reason'),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** API keys for merchants. Only a SHA-256 hash is stored; the key is shown once. */
export const apiKey = pgTable('api_key', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id')
    .notNull()
    .references(() => merchant.id),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  createdAt: createdAt(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
