/**
 * OnboardingCoordinator — ensures only one onboarding surface is active.
 * Owns the landing tour; gates banner and privacy modals via context.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import UnifiedOnboarding from "@/components/onboarding/UnifiedOnboarding";
import {
  isTourDismissed,
  markTourDismissed,
  migrateLegacyOnboardingKeys,
} from "@/lib/onboarding/storage";

/** @type {React.Context<{ tourOpen: boolean, surfacesBlocked: boolean } | null>} */
const OnboardingCoordinatorContext = createContext(null);

export function useOnboardingCoordinator() {
  const ctx = useContext(OnboardingCoordinatorContext);
  return ctx || { tourOpen: false, surfacesBlocked: false };
}

export default function OnboardingCoordinator({ children }) {
  const router = useRouter();
  const { currentUser, onboardingComplete, loading } = useUser();
  const [tourOpen, setTourOpen] = useState(false);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    migrateLegacyOnboardingKeys();
    setMigrated(true);
  }, []);

  useEffect(() => {
    if (!migrated || loading || router.pathname !== "/") return;
    if (!currentUser || onboardingComplete) return;
    if (isTourDismissed()) return;

    const timer = setTimeout(() => setTourOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [migrated, loading, router.pathname, currentUser, onboardingComplete]);

  const closeTour = () => {
    setTourOpen(false);
    markTourDismissed();
  };

  const value = useMemo(
    () => ({ tourOpen, surfacesBlocked: tourOpen }),
    [tourOpen],
  );

  return (
    <OnboardingCoordinatorContext.Provider value={value}>
      {children}
      <UnifiedOnboarding isOpen={tourOpen} onClose={closeTour} />
    </OnboardingCoordinatorContext.Provider>
  );
}
