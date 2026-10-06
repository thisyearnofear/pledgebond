/**
 * Onboarding Banner — role-based guide for authenticated users only.
 *
 * Shows a quick three-step guide (builder or backer) after completing onboarding.
 * Dismissible via localStorage.
 *
 * Guest/unauthenticated visitors see the landing page hero — this banner
 * would only duplicate that content, so we skip it entirely.
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import { trackEvent } from "@/lib/analytics";
import { agentsHref } from "@/config/navigation";
import { isBannerDismissed, markBannerDismissed } from "@/lib/onboarding/storage";
import { useOnboardingCoordinator } from "@/components/onboarding/OnboardingCoordinator";
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  TrophyIcon,
  BanknotesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";


export default function OnboardingBanner() {
  const router = useRouter();
  const { currentUser, userRole, onboardingComplete, loading } = useUser();
  const { surfacesBlocked } = useOnboardingCoordinator();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolved = !loading;

  useEffect(() => {
    if (!resolved) return;

    if (currentUser && onboardingComplete && !surfacesBlocked) {
      const dismissed = isBannerDismissed();
      if (!dismissed) {
        setVisible(true);
      }
    } else {
      setVisible(false);
    }
  }, [resolved, currentUser, onboardingComplete, router.pathname, surfacesBlocked]);

  useEffect(() => {
    if (visible) {
      if (prefersReducedMotion) {
        setMounted(true);
      } else {
        const t = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(t);
      }
    } else {
      setMounted(false);
    }
  }, [visible, prefersReducedMotion]);

  if (!resolved || !visible) return null;

  const transitionClass = prefersReducedMotion
    ? ""
    : "transition-all duration-500 ease-out";
  const containerClass = mounted
    ? `opacity-100 translate-y-0 ${transitionClass}`
    : `opacity-0 -translate-y-2 ${transitionClass}`;

  return (
    <div className={containerClass}>
      <AuthBanner
        userRole={userRole}
        onDismiss={() => {
          setVisible(false);
          markBannerDismissed();
          trackEvent("onboarding_banner_dismissed", { mode: "auth", role: userRole });
        }}
        router={router}
      />
    </div>
  );
}

/* ===================================================================
 * Auth Banner — role-based step-by-step for authenticated users
 * =================================================================== */
function AuthBanner({ userRole, onDismiss, router }) {
  const builderSteps = [
    {
      icon: TrophyIcon,
      title: "1. Claim Your Win",
      desc: "Submit your project with prize evidence — we verify it on the public ledger",
      action: () => router.push("/projects/new"),
      cta: "Claim \u2192",
    },
    {
      icon: SparklesIcon,
      title: "2. Get Verified",
      desc: "AI agents score your project and confirm payouts on-chain for pennies",
      action: () => router.push(agentsHref("analyze")),
      cta: "Run Agents \u2192",
    },
    {
      icon: BanknotesIcon,
      title: "3. Bridge Your Prize",
      desc: "Fund a USDC bridge loan against your unpaid prize — paid in hours, not 90 days",
      action: () => router.push("/build"),
      cta: "Bridge \u2192",
    },
  ];

  const backerSteps = [
    {
      icon: MagnifyingGlassIcon,
      title: "1. Explore Builders",
      desc: "Find builders with verified wins and shipping momentum",
      action: () => router.push("/explore"),
      cta: "Explore \u2192",
    },
    {
      icon: SparklesIcon,
      title: "2. Analyze with AI",
      desc: "Agents score project health, risk, and payout history for pennies",
      action: () => router.push(agentsHref("analyze")),
      cta: "Analyze \u2192",
    },
    {
      icon: BanknotesIcon,
      title: "3. Fund a Bridge Loan",
      desc: "Lend USDC against a confirmed win — principal + your rate repaid when the organizer pays",
      action: () => router.push("/back?tab=discover"),
      cta: "Fund \u2192",
    },
  ];

  const steps = userRole === "backer" ? backerSteps : builderSteps;

  return (
    <div className="bg-gradient-to-r from-blue-50 via-teal-50 to-purple-50 dark:from-blue-900/20 dark:via-teal-900/20 dark:to-purple-900/20 border-b border-blue-100 dark:border-blue-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {userRole === "backer"
                ? "\uD83D\uDC4B Welcome back — here's how to start backing builders:"
                : "\uD83D\uDC4B Welcome back — here's how to turn wins into working capital:"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {steps.map((step) => (
                <button
                  key={step.title}
                  onClick={step.action}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors text-left"
                >
                  <step.icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.desc}</p>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 inline-block">
                      {step.cta}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
