/**
 * ShareButton — X (Twitter) + Farcaster share for a leaderboard entry.
 *
 * Builds a shareable URL using the `?ref=` convention that the page uses
 * for highlighting entries (and rendering OG cards). The URL also carries
 * the sharer's referral code (`s=`) and the copy variant (`v=`) so the
 * share → landing → signup funnel is measurable end to end.
 *
 * Guardrail: entries without verified wins don't render a share surface —
 * the credibility mechanic doubles as distribution control.
 */

import { trackEvent } from "@/lib/analytics";
import { getSharerCode } from "@/lib/gamification/referral";
import { generateShareText, pickShareVariant, isShareableEntry } from "./tabs";

export default function ShareButton({ text, url, entryType, entry, rank }) {
  if (!isShareableEntry(entryType, entry)) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://pledgebond.com";
  const ogRef = entryType && entry && rank ? `${entryType}-${rank}` : null;

  const handleShare = (platform) => {
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
    return { shareText, shareUrl };
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          const { shareText, shareUrl } = handleShare("x");
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
        }}
        className="p-1.5 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-blue-500 dark:text-blue-400 transition-colors"
        title="Share on X"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const { shareText, shareUrl } = handleShare("farcaster");
          const fcText = shareText.replace(/@pledgebond/g, "").trim();
          window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(fcText)}%20${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
        }}
        className="p-1.5 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-purple-500 dark:text-purple-400 transition-colors"
        title="Share on Farcaster"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.336 2.1h11.328l-.84 10.257L12 14.1l-4.824-1.743L6.336 2.1zM4.2 5.556l.672 8.166H8.4l.42 4.176h3.18l.42-4.176h3.528l.672-8.166H4.2z" />
        </svg>
      </button>
    </div>
  );
}
