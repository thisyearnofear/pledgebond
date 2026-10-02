import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@/stores/authStore';
import { Modal } from '../common/Modal';
import {
  SparklesIcon,
  TrophyIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ChevronRightIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline';
import Button from '../common/Button';
import { markTourDismissed } from "@/lib/onboarding/storage";

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'You Won. Now Get Paid.',
    description: 'PledgeBond turns hackathon wins into working capital. We verify your win on a public ledger — and your track record unlocks credit.',
    icon: TrophyIcon,
    color: 'bg-amber-500'
  },
  {
    id: 'claim',
    title: 'Claim Your Win',
    description: 'Submit your project with prize evidence. Verified wins go on the public payout ledger — the record ecosystems and lenders trust.',
    icon: ShieldCheckIcon,
    color: 'bg-teal-500'
  },
  {
    id: 'agents',
    title: 'Agents Do the Underwriting',
    description: 'Underwriter, Scout, and Verifier score your project and confirm payouts — for pennies per call, settled in USDC on Arc.',
    icon: SparklesIcon,
    color: 'bg-indigo-500'
  },
  {
    id: 'credit',
    title: 'Unlock Credit',
    description: 'Your verified track record collateralizes a USDC credit line. Start your next build before the prize check arrives.',
    icon: BanknotesIcon,
    color: 'bg-purple-500'
  }
];

export default function UnifiedOnboarding({ isOpen, onClose, onComplete }) {
  const router = useRouter();
  const { currentUser } = useUser();
  const [currentTourStep, setCurrentTourStep] = useState(0);

  const handleNextTour = () => {
    if (currentTourStep < TOUR_STEPS.length - 1) {
      setCurrentTourStep(currentTourStep + 1);
    } else {
      // Last step — route unauthenticated users to signup, builders to claim a win
      markTourDismissed();
      onClose?.();
      if (!currentUser) {
        router.push('/login?mode=signup');
      } else {
        router.push('/projects/new');
      }
    }
  };

  const handleBackTour = () => {
    if (currentTourStep > 0) {
      setCurrentTourStep(currentTourStep - 1);
    }
  };

  const handleSkipTour = () => {
    markTourDismissed();
    onClose?.();
  };

  if (!isOpen) return null;

  const tourProgress = Math.round(((currentTourStep + 1) / TOUR_STEPS.length) * 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      showCloseButton={true}
      className="overflow-hidden"
    >
      <div className="relative">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col items-center text-center py-8">
            <div className={`mx-auto w-24 h-24 ${TOUR_STEPS[currentTourStep].color} text-white rounded-3xl flex items-center justify-center mb-8 shadow-xl transform transition-transform duration-500 hover:-translate-y-1`}>
              {React.createElement(TOUR_STEPS[currentTourStep].icon, { className: 'w-12 h-12' })}
            </div>

            <h2 className="text-3xl font-black text-primary mb-4 tracking-tight">
              {TOUR_STEPS[currentTourStep].title}
            </h2>

            <p className="text-lg text-secondary mb-10 max-w-2xl leading-relaxed">
              {TOUR_STEPS[currentTourStep].description}
            </p>

            <div className="w-full max-w-2xl">
              <div className="flex items-center justify-between text-sm text-secondary mb-3">
                <span>{`Step ${currentTourStep + 1} of ${TOUR_STEPS.length}`}</span>
                <span>{`${tourProgress}% complete`}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${tourProgress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col w-full gap-4 mt-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-between w-full bg-surface-secondary p-4 rounded-2xl border border-default">
                <Button
                  variant="ghost"
                  onClick={handleBackTour}
                  className={currentTourStep === 0 ? 'invisible' : ''}
                  leftIcon={<ChevronLeftIcon className="w-4 h-4" />}
                >
                  Back
                </Button>

                <div className="flex gap-2">
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === currentTourStep ? 'w-10 bg-primary-500' : 'w-2 bg-gray-200'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  variant="primary"
                  onClick={handleNextTour}
                  rightIcon={<ChevronRightIcon className="w-4 h-4" />}
                  className="shadow-md"
                >
                  {currentTourStep === TOUR_STEPS.length - 1 ? 'Explore the Platform' : 'Next'}
                </Button>
              </div>

              {currentTourStep < TOUR_STEPS.length - 1 && (
                <button
                  onClick={handleSkipTour}
                  className="text-tertiary hover:text-primary text-sm font-medium transition-colors self-start"
                >
                  Skip tour
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
