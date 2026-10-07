/**
 * VerificationMomentOverlay
 *
 * Full-screen celebratory overlay shown when a builder is verified as a
 * hackathon winner. Fires on the next session open after the admin approves
 * the claim, driven by the `winner_verified` activity in the notification feed.
 *
 * Design: dark gradient, gold shimmer, badge rising in center, hackathon name,
 * exclusive-group copy, CTA to profile. Respects prefers-reduced-motion.
 * Shows once per verification (gated by localStorage).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useNotifications } from "@/stores/notificationStore";

const SEEN_KEY = "pos_verification_moment_seen";

export default function VerificationMomentOverlay() {
  const { notifications, markAsRead } = useNotifications();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [hackathonName, setHackathonName] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Look for an unread winner_verified notification we haven't shown yet
  useEffect(() => {
    if (typeof window === "undefined") return;

    const winnerNotif = notifications.find(
      (n) => n.type === "badge_earned" && n.title?.includes("Verified Winner") && !n.read
    );
    if (!winnerNotif) return;

    // Extract hackathon name from description if present
    const match = winnerNotif.description?.match(/winner of (.+)/i);
    const name = match ? match[1].replace(/!$/, "") : null;

    // Check if we've already shown this specific notification
    try {
      const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
      if (seen.includes(winnerNotif.id)) return;
    } catch {
      // Corrupted storage — proceed
    }

    setHackathonName(name);
    setVisible(true);
  }, [notifications]);

  const dismiss = () => {
    // Mark the notification as read
    const winnerNotif = notifications.find(
      (n) => n.type === "badge_earned" && n.title?.includes("Verified Winner") && !n.read
    );
    if (winnerNotif) {
      markAsRead(winnerNotif.id);
      // Record in localStorage so it doesn't re-show
      try {
        const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
        seen.push(winnerNotif.id);
        // Keep only the last 50 entries
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-50)));
      } catch {
        // noop
      }
    }
    setVisible(false);
  };

  const goToProfile = () => {
    dismiss();
    router.push("/profile");
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at center, rgba(30,20,5,0.97) 0%, rgba(10,8,5,0.98) 60%, rgba(0,0,0,0.99) 100%)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="You are now a verified hackathon winner"
    >
      {/* Shimmer background */}
      {!reducedMotion && (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(251,191,36,0.15) 90deg, transparent 180deg, rgba(251,191,36,0.1) 270deg, transparent 360deg)",
            animation: "pledgebond-verification-shimmer 4s linear infinite",
          }}
        />
      )}

      {/* Gold glow */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-col items-center px-6 max-w-lg text-center">
        {/* Trophy / Badge */}
        <div
          className={reducedMotion ? "" : "pledgebond-verification-badge-rise"}
          style={{ marginBottom: "2rem" }}
        >
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center text-6xl"
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%)",
              boxShadow: "0 0 60px rgba(251,191,36,0.5), inset 0 2px 8px rgba(255,255,255,0.3)",
              border: "3px solid rgba(255,255,255,0.2)",
            }}
          >
            🏆
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-4xl sm:text-5xl font-bold mb-3"
          style={{
            background: "linear-gradient(135deg, #fbbf24 0%, #fcd34d 50%, #f59e0b 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          You're a Verified Winner
        </h1>

        {/* Hackathon name */}
        {hackathonName && (
          <p className="text-lg sm:text-xl text-amber-200/80 font-medium mb-4">
            {hackathonName}
          </p>
        )}

        {/* Copy */}
        <p className="text-base sm:text-lg text-gray-300 mb-2 leading-relaxed max-w-md">
          You're now part of an exclusive group of proven builders.
        </p>
        <p className="text-sm text-gray-400 mb-8 leading-relaxed max-w-md">
          Your track record is verified. Lenders can now fund you based on proof, not promises.
          This is where capital meets credibility.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <button
            onClick={goToProfile}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
              color: "#1c1410",
              boxShadow: "0 4px 20px rgba(251,191,36,0.3)",
            }}
          >
            View My Profile
          </button>
          <button
            onClick={dismiss}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-sm text-gray-300 border border-gray-700 hover:border-gray-500 hover:text-gray-100 transition-all"
          >
            Explore First
          </button>
        </div>
      </div>

      {/* Inline keyframes (scoped to avoid depending on global CSS) */}
      <style jsx>{`
        @keyframes pledgebond-verification-shimmer {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pledgebond-verification-badge-rise {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.8);
          }
          60% {
            opacity: 1;
            transform: translateY(-5px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .pledgebond-verification-badge-rise {
          animation: pledgebond-verification-badge-rise 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
