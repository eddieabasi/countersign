'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalletApi } from '@concordium/browser-wallet-api-helpers';
import {
  CAIP2,
  TrustServiceError,
  ccdscanTx,
  createTrustServiceClient,
  type MerchantPublic,
} from '@countersign/shared';

const TRUST_SERVICE_URL = process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ?? 'http://localhost:4000';
const api = createTrustServiceClient(TRUST_SERVICE_URL);
/** Wallets report the full genesis hash; CAIP-2 uses its first 32 hex chars. */
const TESTNET_GENESIS_PREFIX = CAIP2.testnet.slice('ccd:'.length);

type Phase =
  | { kind: 'detecting' }
  | { kind: 'no-wallet' }
  | { kind: 'wrong-network' }
  | { kind: 'disconnected' }
  | { kind: 'ready' }
  | { kind: 'anchor-account' }
  | { kind: 'anchoring' }
  | { kind: 'awaiting-wallet'; vraTxHash: string }
  | { kind: 'verifying'; vraTxHash: string }
  | { kind: 'verified'; merchant: MerchantPublic; vraTxHash?: string; vaaTxHash?: string }
  | { kind: 'failed'; message: string; vraTxHash?: string };

function describeError(e: unknown): string {
  if (e instanceof TrustServiceError) return `${e.message} (${e.code})`;
  if (e instanceof Error) return e.message;
  return String(e);
}

export function MerchantVerify() {
  const walletRef = useRef<WalletApi | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'detecting' });
  const [accounts, setAccounts] = useState<string[]>([]);
  const [account, setAccount] = useState<string>('');
  const [displayName, setDisplayName] = useState('');
  const anchorAccountRef = useRef<string | null>(null);

  const loadMerchant = useCallback(async (acct: string) => {
    try {
      const merchant = await api.getMerchant(acct);
      setPhase({ kind: 'verified', merchant });
    } catch (e) {
      if (e instanceof TrustServiceError && e.status === 404) setPhase({ kind: 'ready' });
      else setPhase({ kind: 'failed', message: describeError(e) });
    }
  }, []);

  /** Switch the console to `acct`; never let the anchoring payer account verify as a merchant. */
  const selectAccount = useCallback(
    async (acct: string) => {
      setAccounts((prev) => (prev.includes(acct) ? prev : [...prev, acct]));
      setAccount(acct);
      if (acct === anchorAccountRef.current) {
        setPhase({ kind: 'anchor-account' });
        return;
      }
      await loadMerchant(acct);
    },
    [loadMerchant],
  );

  const checkChain = useCallback(async (wallet: WalletApi) => {
    const genesis = await wallet.getSelectedChain();
    if (!genesis?.startsWith(TESTNET_GENESIS_PREFIX)) {
      setPhase({ kind: 'wrong-network' });
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { detectConcordiumProvider } = await import('@concordium/browser-wallet-api-helpers');
      let wallet: WalletApi;
      try {
        wallet = await detectConcordiumProvider(3000);
      } catch {
        if (!cancelled) setPhase({ kind: 'no-wallet' });
        return;
      }
      if (cancelled) return;
      walletRef.current = wallet;
      anchorAccountRef.current = await api
        .health()
        .then((h) => h.anchorAccount)
        .catch(() => null);
      wallet.on('chainChanged', () => window.location.reload());
      wallet.on('accountDisconnected', () => window.location.reload());
      // Fires when the user selects another (connected) account in the wallet.
      wallet.on('accountChanged', (acct: string) => void selectAccount(acct));
      if (!(await checkChain(wallet))) return;
      const current = await wallet.getMostRecentlySelectedAccount();
      if (current) await selectAccount(current);
      else setPhase({ kind: 'disconnected' });
    })();
    return () => {
      cancelled = true;
    };
  }, [checkChain, selectAccount]);

  const connect = async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    try {
      if (!(await checkChain(wallet))) return;
      const accts = await wallet.requestAccounts();
      if (accts.length === 0) {
        setPhase({ kind: 'failed', message: 'No account was connected in the wallet.' });
        return;
      }
      setAccounts(accts);
      // Prefer an account that is not the anchoring payer.
      const pick = accts.find((a) => a !== anchorAccountRef.current) ?? (accts[0] as string);
      await selectAccount(pick);
    } catch (e) {
      setPhase({ kind: 'failed', message: describeError(e) });
    }
  };

  const verify = async () => {
    const wallet = walletRef.current;
    if (!wallet || !account) return;
    let vraTxHash: string | undefined;
    try {
      setPhase({ kind: 'anchoring' });
      const created = await api.proofRequest({ account, displayName });
      vraTxHash = created.vraTxHash;

      setPhase({ kind: 'awaiting-wallet', vraTxHash });
      // web-sdk (with its inlined WASM) is only loaded here, not on page load.
      const { VerificationRequestV1 } = await import('@concordium/web-sdk');
      const request = VerificationRequestV1.fromJSON(
        created.request as Parameters<typeof VerificationRequestV1.fromJSON>[0],
      );
      const presentation = await wallet.requestVerifiablePresentationV1(request);

      setPhase({ kind: 'verifying', vraTxHash });
      const result = await api.proofVerify({ sessionId: created.sessionId, presentation });
      setPhase({
        kind: 'verified',
        merchant: result.merchant,
        vraTxHash: result.vraTxHash,
        vaaTxHash: result.vaaTxHash,
      });
    } catch (e) {
      setPhase({ kind: 'failed', message: describeError(e), ...(vraTxHash ? { vraTxHash } : {}) });
    }
  };

  return (
    <section className="card" aria-live="polite">
      <h2>1. Verify your business</h2>

      {accounts.length > 0 && (
        <div className="account-bar">
          <label>
            Merchant account
            <select
              value={account}
              onChange={(e) => void selectAccount(e.target.value)}
              disabled={['anchoring', 'awaiting-wallet', 'verifying'].includes(phase.kind)}
            >
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a === anchorAccountRef.current ? `${a} (anchoring account)` : a}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            Don&apos;t see your merchant account? Open the wallet, select that account and connect
            it to this site — the console switches to it automatically.{' '}
            <button type="button" className="link" onClick={connect}>
              Refresh connected accounts
            </button>
          </p>
        </div>
      )}

      {phase.kind === 'detecting' && <p className="muted">Looking for the Concordium wallet…</p>}

      {phase.kind === 'no-wallet' && (
        <p>
          The <strong>Concordium Wallet for Web</strong> extension was not found. Install it from
          the Chrome Web Store, switch it to <strong>Testnet</strong>, then reload this page.
        </p>
      )}

      {phase.kind === 'wrong-network' && (
        <p>
          Your wallet is not on <strong>Testnet</strong>. Open the wallet → Menu → Network →
          Testnet. The page reloads when you switch.
        </p>
      )}

      {phase.kind === 'disconnected' && (
        <button type="button" onClick={connect}>
          Connect wallet
        </button>
      )}

      {(phase.kind === 'ready' || (phase.kind === 'failed' && account)) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <label>
            Business display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
              placeholder="e.g. Ada's Fabrics"
            />
          </label>
          <p className="muted small">
            Your wallet will be asked to prove that this account carries a valid Concordium identity
            and to reveal your <strong>country of residence</strong>. Nothing else is shared. No
            documents are stored.
          </p>
          <button type="submit">Verify with Concordium</button>
        </form>
      )}

      {phase.kind === 'anchor-account' && (
        <div className="err">
          <p>
            <strong>This is Countersign&apos;s anchoring account</strong> — it only pays for
            anchoring and cannot be a merchant. In the wallet, select your merchant account (Account
            B) and connect it to this site.
          </p>
        </div>
      )}

      {phase.kind === 'anchoring' && (
        <p className="muted">Anchoring your verification request on testnet… (a few seconds)</p>
      )}
      {phase.kind === 'awaiting-wallet' && (
        <p>
          <strong>Approve the request in your wallet.</strong>{' '}
          <a href={ccdscanTx(phase.vraTxHash)} target="_blank" rel="noreferrer">
            Request anchor ↗
          </a>
        </p>
      )}
      {phase.kind === 'verifying' && (
        <p className="muted">
          Verifying your proof against the chain and anchoring the audit record…
        </p>
      )}

      {phase.kind === 'verified' && (
        <div className="ok">
          <p>
            <strong>Verified:</strong> {phase.merchant.displayName}
            {phase.merchant.disclosedAttributes.countryOfResidence &&
              ` · ${phase.merchant.disclosedAttributes.countryOfResidence}`}
          </p>
          <p className="muted small mono">{phase.merchant.walletAccount}</p>
          <p className="small">
            {phase.vraTxHash && (
              <a href={ccdscanTx(phase.vraTxHash)} target="_blank" rel="noreferrer">
                Request anchor ↗
              </a>
            )}{' '}
            {(phase.vaaTxHash ?? phase.merchant.auditRecordRef) && (
              <a
                href={ccdscanTx((phase.vaaTxHash ?? phase.merchant.auditRecordRef) as string)}
                target="_blank"
                rel="noreferrer"
              >
                Audit anchor ↗
              </a>
            )}
          </p>
        </div>
      )}

      {phase.kind === 'failed' && (
        <div className="err">
          <p>
            <strong>Not verified.</strong> {phase.message}
          </p>
          {phase.vraTxHash && (
            <a href={ccdscanTx(phase.vraTxHash)} target="_blank" rel="noreferrer" className="small">
              Request anchor ↗
            </a>
          )}
        </div>
      )}
    </section>
  );
}
