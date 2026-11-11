import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs';
import type { Config } from '../config.ts';

/** gRPC v2 client for the configured (testnet) node. */
export function createGrpcClient(cfg: Config, timeoutMs = 15_000): ConcordiumGRPCNodeClient {
  return new ConcordiumGRPCNodeClient(
    cfg.CONCORDIUM_GRPC_HOST,
    cfg.CONCORDIUM_GRPC_PORT,
    cfg.CONCORDIUM_GRPC_TLS ? credentials.createSsl() : credentials.createInsecure(),
    { timeout: timeoutMs },
  );
}
