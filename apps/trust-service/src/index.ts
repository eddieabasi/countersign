import { loadConfig } from './config.ts';
import { buildServer } from './server.ts';

const cfg = loadConfig();
const app = buildServer(cfg);

try {
  await app.listen({ port: cfg.TRUST_SERVICE_PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
