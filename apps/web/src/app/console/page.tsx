import type { Metadata } from 'next';
import { MerchantVerify } from './merchant-verify';

export const metadata: Metadata = { title: 'Merchant Console · Countersign' };

export default function ConsolePage() {
  return (
    <main className="container">
      <h1>Merchant Console</h1>
      <p className="muted">
        Prove once that an accountable, verified entity stands behind your sales agent. Testnet
        only.
      </p>
      <MerchantVerify />
      <section className="card disabled">
        <h2>2. Link your agent</h2>
        <p className="muted">Next: paste your agent&apos;s Verified by Concordium badge.</p>
      </section>
    </main>
  );
}
