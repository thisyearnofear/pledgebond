/**
 * GET /api/rail/open-wins — the lender order book.
 *
 * Server-side so visitors never trip Arc's public-RPC rate limit themselves,
 * and results are cached briefly per deployment. Reads the same
 * liquidityRailService.listOpenWins the direct client path uses.
 */

import { createPublicClient, http } from "viem";
import { liquidityRailService } from "@/services/liquidityRailService";
import { NETWORK_CONFIGS } from "@/lib/wallet/constants";

export const config = { runtime: "nodejs" };

const CACHE_TTL_MS = 30_000;
const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RAIL_CHAIN_ID || 5042002);

const cache = globalThis.__pledgebondOpenWins ||
  (globalThis.__pledgebondOpenWins = { key: null, at: 0, wins: [] });

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
  if (cache.key === key && cache.wins.length > 0 && Date.now() - cache.at < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=30");
    return res.status(200).json({ wins: cache.wins, cached: true, chainId });
  }

  try {
    const publicClient = createPublicClient({ transport: http(rpc) });
    const wins = await liquidityRailService.listOpenWins(chainId, publicClient);
    cache.key = key;
    cache.at = Date.now();
    cache.wins = wins;
    res.setHeader("Cache-Control", "public, max-age=30");
    return res.status(200).json({ wins, chainId });
  } catch (error) {
    return res.status(502).json({
      error: error?.message || "Could not read open wins from the rail.",
      wins: [],
    });
  }
}
