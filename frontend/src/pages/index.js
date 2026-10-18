import React from "react";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";

import LiveAgentTicker from "@/components/common/LiveAgentTicker";
import Hero from "@/components/sections/Hero";
import LandingPayoutStrip from "@/components/sections/LandingPayoutStrip";
import HowItWorks from "@/components/sections/HowItWorks";
import CTASection from "@/components/sections/CTASection";

LandingPage.fullWidth = true;

export default function LandingPage() {
  const router = useRouter();
  const { currentUser } = useUser();

  const handleClaimWin = () => {
    if (currentUser) {
      router.push("/projects/new");
    } else {
      router.push("/login?mode=signup&redirect=/projects/new");
    }
  };

  const handleSeePayouts = () => router.push("/leaderboard");

  return (
    <div className="min-h-screen bg-surface-secondary wave-pattern overflow-x-hidden">
      <LiveAgentTicker />
      <Hero
        onClaimWin={handleClaimWin}
        onSeePayouts={handleSeePayouts}
      />
      <HowItWorks />
      <LandingPayoutStrip />
      <CTASection onClaimWin={handleClaimWin} onSeePayouts={handleSeePayouts} />
    </div>
  );
}
