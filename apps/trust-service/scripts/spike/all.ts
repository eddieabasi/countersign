/**
 * Run all Phase 0 spikes in order and print a summary.
 *
 *   pnpm spike            (from the repo root)
 *
 * Each spike runs in its own process (they call process.exit), inherits this process's env
 * (already loaded from .env), and a failure does not stop the next one.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const spikes: { name: string; file: string; args: string[] }[] = [
  { name: '(a) registry read via gRPC', file: 'registry.ts', args: ['1112', '--via', 'grpc'] },
  { name: '(c) anchor Trust Receipt', file: 'anchor.ts', args: [] },
  { name: '(b) proof request create', file: 'proof.ts', args: ['create'] },
];

const results: { name: string; ok: boolean; seconds: string }[] = [];

for (const s of spikes) {
  console.log(`\n\n######## ${s.name} ${'#'.repeat(Math.max(0, 60 - s.name.length))}`);
  const started = Date.now();
  const run = spawnSync(process.execPath, ['--import', 'tsx', join(here, s.file), ...s.args], {
    stdio: 'inherit',
    env: process.env,
  });
  results.push({
    name: s.name,
    ok: run.status === 0,
    seconds: ((Date.now() - started) / 1000).toFixed(1),
  });
}

console.log('\n\n######## Summary ' + '#'.repeat(55));
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(30)} ${r.seconds}s`);
}
console.log('\nPaste everything above (from the first ######## line) back to Claude.');
process.exit(results.every((r) => r.ok) ? 0 : 1);
