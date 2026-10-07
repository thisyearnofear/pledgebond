/**
 * GET /api/rail/history — every declared win and its real outcome.
 *
 * Server-side + cached for the same reason as /api/rail/open-wins: Arc's
 * public RPC rate-limits browser bursts, and this scan reads more per win
 * than the order book does.
 */

import { createPublicClient, http } from "viem";
import { liquidityRailService } from "@/services/liquidityRailService";
import { NETWORK_CONFIGS } from "@/lib/wallet/constants";

export const config = { runtime: "nodejs" };

const CACHE_TTL_MS = 60_000;
const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RAIL_CHAIN_ID || 5042002);

const cache = globalThis.__pledgebondRailHistory ||
  (globalThis.__pledgebondRailHistory = { key: null, at: 0, wins: [] });

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const chainId = Number(req.query.chainId || DEFAULT_CHAIN_ID);
  const rpc = NETWORK_CONFIGS[chainId]?.rpcUrls?.[0];
  if (!rpc) {
    return res.status(400).json({ error: `No RPC configured for chain ${chainId}`, wins: [] });
  }

  const key = `${chainId}`;
  const explorer = NETWORK_CONFIGS[chainId]?.blockExplorerUrls?.[0] || null;
  if (cache.key === key && cache.wins.length > 0 && Date.now() - cache.at < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json({ wins: cache.wins, cached: true, chainId, explorer });
  }

  try {
    const publicClient = createPublicClient({ transport: http(rpc) });
    const wins = await liquidityRailService.listWinHistory(chainId, publicClient);
    cache.key = key;
    cache.at = Date.now();
    cache.wins = wins;
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json({ wins, chainId, explorer: NETWORK_CONFIGS[chainId]?.blockExplorerUrls?.[0] });
  } catch (error) {
    return res.status(502).json({
      error: error?.message || "Could not read win history from the rail.",
      wins: [],
    });
  }
}
