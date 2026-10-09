/**
 * ShareButton — X (Twitter) + Farcaster share for a leaderboard entry.
 *
 * Builds a shareable URL using the `?ref=` convention that the page uses
 * for highlighting entries (and rendering OG cards). The URL also carries
 * the sharer's referral code (`s=`) and the copy variant (`v=`) so the
 * share → landing → signup funnel is measurable end to end.
 *
 * Guardrail: entries without verified wins don't render a share surface —
 * the credibility mechanic doubles as distribution control. Anonymous
 * sharers get a sign-in prompt first so their share can be credited.
 */

import { useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { getSharerCode } from "@/lib/gamification/referral";
import { generateShareText, pickShareVariant, isShareableEntry } from "./tabs";

export default function ShareButton({ text, url, entryType, entry, rank }) {
  // Which platform's anonymous-share prompt is open, or null.
  const [promptPlatform, setPromptPlatform] = useState(null);

  if (!isShareableEntry(entryType, entry)) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://pledgebond.com";
  const ogRef = entryType && entry && rank ? `${entryType}-${rank}` : null;

  const doShare = (platform) => {
    const shareCode = getSharerCode();
    // An explicit `text` prop means the caller controls the copy — no variant.
    const variant = text ? null : pickShareVariant(entryType);
    const shareText = text || generateShareText(entry, rank, entryType, variant);

    let shareUrl = url;
    if (!shareUrl) {
      const params = new URLSearchParams();
      if (ogRef) params.set("ref", ogRef);
      if (shareCode) params.set("s", shareCode);
      if (variant !== null) params.set("v", String(variant));
      const qs = params.toString();
      shareUrl = `${baseUrl}/leaderboard${qs ? `?${qs}` : ""}`;
    }

    trackEvent("leaderboard_share_clicked", {
      platform,
      entry_type: entryType,
      rank,
      entry_name: entry?.name || entry?.title || null,
      variant,
    });
    trackEvent("funnel_step", {
      funnel: "share",
      step: "clicked",
      funnelId: shareCode || "anon",
      platform,
      entryType,
      rank,
      variant,
      ref: ogRef,
    });

    const intentUrl = platform === "x"
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
      : `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText.replace(/@pledgebond/g, "").trim())}%20${encodeURIComponent(shareUrl)}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
  };

  const handleClick = (e, platform) => {
    e.stopPropagation();
    // Anonymous share → nudge to sign in so the share can be credited.
    // The intent URL still opens via "Share anyway" — never block sharing.
    if (!getSharerCode()) {
      trackEvent("funnel_step", {
        funnel: "share",
        step: "anon_prompt",
        funnelId: "anon",
        platform,
        entryType,
        rank,
        ref: ogRef,
      });
      setPromptPlatform(platform);
      return;
    }
    doShare(platform);
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={(e) => handleClick(e, "x")}
        className="p-1.5 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-blue-500 dark:text-blue-400 transition-colors"
        title="Share on X"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>
      <button
        onClick={(e) => handleClick(e, "farcaster")}
        className="p-1.5 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-purple-500 dark:text-purple-400 transition-colors"
        title="Share on Farcaster"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.336 2.1h11.328l-.84 10.257L12 14.1l-4.824-1.743L6.336 2.1zM4.2 5.556l.672 8.166H8.4l.42 4.176h3.18l.42-4.176h3.528l.672-8.166H4.2z" />
        </svg>
      </button>

      {promptPlatform && (
        <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-xl border border-border-primary bg-surface-primary p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-text-secondary leading-snug">
              Sign in so this share credits your account — referrals earn XP.
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); setPromptPlatform(null); }}
              className="text-text-tertiary hover:text-text-primary text-xs leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              href={`/login?redirect=${encodeURIComponent("/leaderboard")}`}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Sign in
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const platform = promptPlatform;
                setPromptPlatform(null);
                doShare(platform);
              }}
              className="flex-1 rounded-lg border border-border-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover"
            >
              Share anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
