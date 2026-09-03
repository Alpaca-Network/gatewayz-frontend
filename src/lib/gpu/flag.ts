// Feature flag for the GPU marketplace surfaces (public /gpu dashboard +
// /gpu/provider portal). Off until the backend (gatewayz-backend#2262/#2263)
// ships — mirrors the NEXT_PUBLIC_WAYZ_STAKING_PREVIEW pattern in
// src/lib/wayz/addresses.ts.
export function isGpuMarketplaceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GPU_MARKETPLACE === 'true';
}
