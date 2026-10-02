/**
 * WalletLinkBanner — persistent awareness for builders with GitHub auth
 * but no linked wallet. Dismissed per-user via localStorage.
 *
 * Belt half of the deferred-wallet flow: the contextual prompt
 * (funding/cross-chain) is the suspenders. This banner is the
 * awareness layer — the user always knows they have one step left
 * before they can request funds.
 */
import Link from "next/link";
import { XMarkIcon, WalletIcon } from "@heroicons/react/24/outline";
import { isWalletLinkDismissed, markWalletLinkDismissed } from "@/lib/onboarding/storage";
import { useEffect, useState } from "react";

export default function WalletLinkBanner({ variant = "warning" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(!isWalletLinkDismissed());
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    markWalletLinkDismissed();
    setVisible(false);
  };

  const tone =
    variant === "info"
      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
      : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200";

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${tone}`}
      role="status"
    >
      <WalletIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Link a wallet to receive payouts
        </p>
        <p className="text-xs mt-0.5 opacity-80">
          You can browse and submit projects now — but a linked wallet is required before requesting funding.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Link
            href="/login?role=builder"
            className="inline-flex items-center text-xs font-semibold underline"
          >
            Link wallet now →
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
