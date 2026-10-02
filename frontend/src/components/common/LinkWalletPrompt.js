/**
 * LinkWalletPrompt — contextual wallet-prompt for payout-bearing actions.
 *
 * Suspenders half of the deferred-wallet flow. Renders instead of the
 * funding/cross-chain body when a signed-in builder has no wallet
 * connected. One-tap link action; user can also dismiss and stay on the
 * tab if they want to read.
 */
import Link from "next/link";
import { useWallet } from "@/stores/walletStore";
import { WalletIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";

export default function LinkWalletPrompt({ reason = "request funding" }) {
  const { connect: connectEvm, connectSolana, evmConnecting, solanaConnecting } = useWallet();

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/40 mb-4">
        <WalletIcon className="w-7 h-7 text-amber-700 dark:text-amber-300" />
      </div>
      <h2 className="text-xl font-bold text-primary mb-2">
        Link a wallet to {reason}
      </h2>
      <p className="text-sm text-secondary mb-6 max-w-md mx-auto">
        Funding requires a wallet to receive USDC payouts. Linking takes a
        moment — you sign one message proving ownership, no on-chain transaction.
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button
          variant="primary"
          onClick={connectEvm}
          disabled={evmConnecting}
          size="md"
        >
          {evmConnecting ? "Opening..." : "Link EVM Wallet"}
        </Button>
        <Button
          variant="outline"
          onClick={connectSolana}
          disabled={solanaConnecting}
          size="md"
        >
          {solanaConnecting ? "Opening..." : "Link Solana Wallet"}
        </Button>
      </div>
      <p className="mt-5 text-xs text-tertiary">
        Or{" "}
        <Link href="/login?role=builder" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">
          open the link flow <ArrowRightIcon className="w-3 h-3" />
        </Link>
      </p>
    </div>
  );
}
