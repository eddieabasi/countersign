import Link from 'next/link';
import { VERDICT_SCOPE } from '@countersign/shared';

export default function Home() {
  return (
    <main className="container">
      <h1>Countersign</h1>
      <p>Proof that an accountable, verified business stands behind an AI sales agent.</p>
      <p>
        <Link href="/console">Open the Merchant Console →</Link>
      </p>
      <p className="muted small">{VERDICT_SCOPE}</p>
    </main>
  );
}
