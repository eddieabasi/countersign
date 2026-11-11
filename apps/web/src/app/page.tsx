import { VERDICT_SCOPE } from '@countersign/shared';

export default function Home() {
  return (
    <main style={{ maxWidth: 640 }}>
      <h1>Countersign</h1>
      <p>Merchant Console and public Verify page arrive in Phase 1 and Phase 2.</p>
      <p style={{ color: '#555', fontSize: 14 }}>{VERDICT_SCOPE}</p>
    </main>
  );
}
