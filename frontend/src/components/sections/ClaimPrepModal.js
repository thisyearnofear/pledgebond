/**
 * ClaimPrepModal — sets expectations before an anonymous visitor hits signup.
 * What you'll need, what happens, then one clear path forward.
 */
import { Modal } from "@/components/common/Modal";
import Button from "@/components/common/Button";
import {
  TrophyIcon,
  WalletIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

const NEEDS = [
  {
    icon: TrophyIcon,
    title: "Your win",
    body: "Which hackathon, and how you placed — a Devpost link or project URL is enough to start."
  },
  {
    icon: WalletIcon,
    title: "A wallet",
    body: "Your win anchors on-chain and any bridge pays out in USDC — you'll connect or create one at signup."
  },
  {
    icon: BanknotesIcon,
    title: "The prize amount",
    body: "What the organizer owes you. A public market then forms on whether they pay."
  }
];

export default function ClaimPrepModal({ isOpen, onClose, onContinue, onExplore }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Claim your win" size="lg">
      <p className="text-sm text-secondary mb-5">
        Takes about two minutes. Here's what you'll need:
      </p>
      <div className="space-y-4 mb-6">
        {NEEDS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <Icon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-primary">{title}</div>
              <div className="text-sm text-secondary">{body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onContinue}
          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 font-semibold min-h-touch w-full sm:w-auto"
        >
          Continue — free account
        </Button>
        <Button
          onClick={onExplore}
          variant="outline"
          className="px-6 py-3 font-semibold min-h-touch w-full sm:w-auto"
        >
          Just exploring? See payouts
        </Button>
      </div>
    </Modal>
  );
}
