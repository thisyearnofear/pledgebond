/**
 * ProjectEditorStepNav — Wizard step indicator + Continue/Back buttons
 * for the new-project flow.
 */

import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";

const STEPS = ["Basics", "Proof & Polish", "Review & Submit"];

export default function ProjectEditorStepNav({ wizardStep, setWizardStep, showContinue = true }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center justify-center gap-4">
        {STEPS.map((stepName, i) => {
          const stepNum = i + 1;
          const isActive = wizardStep === stepNum;
          const isCompleted = wizardStep > stepNum;
          return (
            <button
              key={stepName}
              type="button"
              onClick={() => {
                if (stepNum < wizardStep) setWizardStep(stepNum);
              }}
              className={`flex items-center gap-2 transition-all ${
                isCompleted ? "cursor-pointer" : isActive ? "" : "cursor-default"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-gray-900 text-white ring-4 ring-gray-900/10"
                    : "bg-gray-200 text-gray-400 dark:text-gray-500"
                }`}
              >
                {isCompleted ? <CheckCircleIcon className="w-5 h-5" /> : stepNum}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-500"}`}>
                {stepName}
              </span>
            </button>
          );
        })}
      </div>

      {showContinue && (
        <div className="flex items-center justify-between w-full">
          <div>
            {wizardStep > 1 && (
              <Button type="button" variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                Back
              </Button>
            )}
          </div>
          <Button type="button" onClick={() => setWizardStep(wizardStep + 1)}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
