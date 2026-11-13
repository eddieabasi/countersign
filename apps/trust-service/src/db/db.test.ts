import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from './client.ts';
import { merchant, verificationSession } from './schema.ts';
import { createTestDb } from './test-db.ts';
import { getMerchant } from '../merchant/verification.ts';

const ACCOUNT = '3k3MRAXGqgS8b6FCa2MjX5adcowmf1LhEnd8xfHT4J7Jnse3k4';
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

describe('schema + migrations (real Postgres via PGlite)', () => {
  it('stores a verification session with a generated id and pending status', async () => {
    const [row] = await db
      .insert(verificationSession)
      .values({
        walletAccount: ACCOUNT,
        displayName: 'Ada Shop',
        request: { type: 'ConcordiumVerificationRequestV1' },
        vraTxHash: 'b14b05179eae32fcfb7ea49da24c15ce93fb2e1ac66dc7beefd0b72248f74ae4',
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();
    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row?.status).toBe('pending');
  });

  it('keeps one merchant per wallet account (upsert)', async () => {
    const values = {
      displayName: 'Ada Shop',
      walletAccount: ACCOUNT,
      verificationMethod: 'individual' as const,
      disclosedAttributes: { countryOfResidence: 'NG' },
      verifiedAt: new Date(),
      auditRecordRef: 'vaa1',
    };
    await db.insert(merchant).values(values);
    await db
      .insert(merchant)
      .values({ ...values, displayName: 'Ada Shop Ltd', auditRecordRef: 'vaa2' })
      .onConflictDoUpdate({
        target: merchant.walletAccount,
        set: { displayName: 'Ada Shop Ltd', auditRecordRef: 'vaa2' },
      });
    const rows = await db.select().from(merchant).where(eq(merchant.walletAccount, ACCOUNT));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayName).toBe('Ada Shop Ltd');
    expect(rows[0]?.disclosedAttributes).toEqual({ countryOfResidence: 'NG' });
  });

  it('getMerchant returns public fields only', async () => {
    const m = await getMerchant(db, ACCOUNT);
    expect(m).toMatchObject({ displayName: 'Ada Shop Ltd', auditRecordRef: 'vaa2' });
    expect(Object.keys(m ?? {})).not.toContain('id');
  });
});
