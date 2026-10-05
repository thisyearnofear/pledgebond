/**
 * Solana connection helpers.
 *
 * Single source of truth for Solana RPC endpoint resolution and Connection
 * construction. Previously duplicated in 4 files (SolanaBagsService.ts,
 * pages/api/bags/market.js, pages/api/agent/verify.js,
 * components/back/PortfolioTab.js). All of them now import from here.
 *
 * The historical location `lib/wallet/constants.ts` re-exports these
 * symbols for backward compatibility — no need to migrate existing wallet
 * imports in this pass.
 *
 * `rpcUrl` override exists because server-side code may use a private RPC
 * URL (e.g. `SOLANA_RPC_URL`) distinct from the public `NEXT_PUBLIC_SOLANA_RPC_URL`.
 */

import { Connection, clusterApiUrl } from "@solana/web3.js";

type SolanaCluster = "devnet" | "testnet" | "mainnet-beta" | "mainnet";

export function getSolanaEndpoint(): string {
  const explicit = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (explicit) return explicit;
  const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet").toLowerCase() as SolanaCluster;
  if (cluster === "mainnet-beta" || cluster === "mainnet") return clusterApiUrl("mainnet-beta");
  if (cluster === "testnet") return clusterApiUrl("testnet");
  return clusterApiUrl("devnet");
}

export interface SolanaConnectionOptions {
  commitment?: "processed" | "confirmed" | "finalized";
  rpcUrl?: string;
}

export function getSolanaConnection(opts: SolanaConnectionOptions = {}): Connection {
  const url = opts.rpcUrl ?? getSolanaEndpoint();
  return new Connection(url, { commitment: opts.commitment ?? "confirmed" });
}
