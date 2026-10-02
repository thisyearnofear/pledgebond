/**
 * useEcosystemPreference — derived ecosystem ranking hook
 *
 * Combines signals from existing contexts (no new state) to produce a single
 * ranked list of ecosystems for "preference-aware" UI surfaces. Drives:
 *  - Hero / featured-rail ordering
 *  - Default chain selection in submit/back flows
 *  - Agent recommendation ordering
 *
 * Signals (in descending priority):
 *   1. primaryEcosystem  — explicit user pin from onboarding/profile
 *   2. activeChainFamily + chainId  — connected wallet right now
 *   3. favoriteEcosystems — implicit, derived from repeat usage
 *   4. lastVisitedEcosystem — most recent ecosystem detail page
 *   5. SUPPORTED_ECOSYSTEMS default order — fallback
 *
 * NEVER hides ecosystems. Returns the full list, just re-ranked.
 */

import { useMemo } from 'react';
import { useApp } from '@/stores/profileStore';
import { useWallet } from '@/stores/walletStore';

// Canonical list of every ecosystem we support. Keep in sync with explore page filter.
export const SUPPORTED_ECOSYSTEMS = [
  'arc',
  'solana',
  'celo',
  'base',
  'linea',
  'arbitrum',
  'ethereum',
  'optimism',
] as const;

export type EcosystemId = typeof SUPPORTED_ECOSYSTEMS[number];

const EVM_CHAIN_ID_TO_ECOSYSTEM: Record<number, EcosystemId> = {
  1: 'ethereum',
  10: 'optimism',
  42161: 'arbitrum',
  8453: 'base',
  59144: 'linea',
  42220: 'celo',
  1993: 'arc',
  5042: 'arc',
  5042002: 'arc',
};

interface EcosystemPreferenceResult {
  /** Full ranked list — primary first, never filtered. */
  ranked: EcosystemId[];
  /** The single most-preferred ecosystem (ranked[0]). */
  primary: EcosystemId;
  /** True iff the user explicitly pinned a primary in onboarding/profile. */
  hasExplicitPrimary: boolean;
  /** True iff the user has completed/dismissed the ecosystem onboarding step. */
  onboardingComplete: boolean;
  /** True iff a Bags-relevant surface should be featured (Solana primary). */
  bagsFeatured: boolean;
  /** True iff x402/Arc-relevant surfaces should be featured. */
  arcFeatured: boolean;
  /** Set the user's pinned primary ecosystem (also marks onboarding complete). */
  setPrimaryEcosystem: (id: EcosystemId) => void;
  /** Mark onboarding as complete without picking a primary. */
  dismissOnboarding: () => void;
}

function isSupported(id: string | undefined | null): id is EcosystemId {
  return !!id && (SUPPORTED_ECOSYSTEMS as readonly string[]).includes(id);
}

function inferFromWallet(
  activeChainFamily: 'evm' | 'solana',
  solanaConnected: boolean,
  evmConnected: boolean,
  chainId: number | string | null,
): EcosystemId | null {
  if (activeChainFamily === 'solana' && solanaConnected) return 'solana';
  if (activeChainFamily === 'evm' && evmConnected) {
    const numeric = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
    if (typeof numeric === 'number' && EVM_CHAIN_ID_TO_ECOSYSTEM[numeric]) {
      return EVM_CHAIN_ID_TO_ECOSYSTEM[numeric];
    }
    // Generic EVM fallback when chainId unknown — Arc is our flagship EVM rail.
    return 'arc';
  }
  return null;
}

export function useEcosystemPreference(): EcosystemPreferenceResult {
  const { preferences, updatePreference } = useApp();
  const wallet = useWallet();

  return useMemo(() => {
    const explicit = isSupported(preferences.primaryEcosystem)
      ? (preferences.primaryEcosystem as EcosystemId)
      : null;

    const fromWallet = inferFromWallet(
      wallet.activeChainFamily,
      wallet.solanaConnected,
      wallet.connected,
      wallet.chainId ?? null,
    );

    const fromFavorites = (preferences.favoriteEcosystems || []).filter(isSupported) as EcosystemId[];

    const fromLastVisit = isSupported(preferences.lastVisitedEcosystem)
      ? (preferences.lastVisitedEcosystem as EcosystemId)
      : null;

    // Build ranking — earlier sources win, deduped, then pad with the canonical list.
    const seed: (EcosystemId | null)[] = [
      explicit,
      fromWallet,
      ...fromFavorites,
      fromLastVisit,
    ];
    const ranked: EcosystemId[] = [];
    for (const id of seed) {
      if (id && !ranked.includes(id)) ranked.push(id);
    }
    for (const id of SUPPORTED_ECOSYSTEMS) {
      if (!ranked.includes(id)) ranked.push(id);
    }

    const primary = ranked[0];

    const setPrimaryEcosystem = (id: EcosystemId) => {
      updatePreference('primaryEcosystem', id);
      updatePreference('ecosystemOnboardingComplete', true);
    };

    const dismissOnboarding = () => {
      updatePreference('ecosystemOnboardingComplete', true);
    };

    return {
      ranked,
      primary,
      hasExplicitPrimary: !!explicit,
      onboardingComplete: !!preferences.ecosystemOnboardingComplete,
      bagsFeatured: primary === 'solana',
      arcFeatured: primary === 'arc',
      setPrimaryEcosystem,
      dismissOnboarding,
    };
  }, [
    preferences.primaryEcosystem,
    preferences.favoriteEcosystems,
    preferences.lastVisitedEcosystem,
    preferences.ecosystemOnboardingComplete,
    wallet.activeChainFamily,
    wallet.solanaConnected,
    wallet.connected,
    wallet.chainId,
    updatePreference,
  ]);
}

export default useEcosystemPreference;
