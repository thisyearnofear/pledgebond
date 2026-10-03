/**
 * Hero — landing above-the-fold for the post-win wedge.
 * One job: claim a win or see payout speeds.
 */
import Button from "@/components/common/Button";
import {
  ArrowRightIcon,
  ClockIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

export default function Hero({ onClaimWin, onSeePayouts }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-16 left-[8%] w-72 h-72 bg-amber-300/40 rounded-full blur-[110px]" />
        <div className="absolute bottom-10 right-[12%] w-80 h-80 bg-teal-300/30 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 sm:pb-16 relative">
        <div className="max-w-3xl relative z-10">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-4">
            Post-win layer for hackathon builders
          </p>

          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary mb-4 sm:mb-5 leading-tight tracking-tight">
            You won. Now get paid — and keep building.
          </h1>

          <p className="text-base sm:text-lg text-secondary mb-8 max-w-2xl">
            Hackathon payout timing is opaque. PledgeBond makes time-to-pay public,
            verifies your win, and packages underwriting signal you can send to ecosystems
            and angels — so a trophy becomes leverage, not a waiting room.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Button
              onClick={onClaimWin}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 sm:px-8 py-3 text-base font-semibold shadow-md min-h-touch w-full sm:w-auto"
            >
              <TrophyIcon className="w-5 h-5 mr-2" />
              Claim your win
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </Button>

            <Button
              onClick={onSeePayouts}
              variant="outline"
              className="px-6 sm:px-8 py-3 text-base font-semibold min-h-touch w-full sm:w-auto"
            >
              <ClockIcon className="w-5 h-5 mr-2" />
              See payout speeds
            </Button>
          </div>

          <p className="mt-6 text-sm text-tertiary">
            Verifier confirms payouts. The win anchors on-chain. Liquidity follows once it's real.
          </p>
        </div>
      </div>
    </div>
  );
}
