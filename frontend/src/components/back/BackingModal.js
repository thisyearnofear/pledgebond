/**
 * BackingModal — stake USDC on a builder project (extracted from DiscoverTab).
 */

import { useState, useEffect, useRef } from "react";
import { ShareIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/common/Card";
import Confetti from "@/components/common/Confetti";
import SnsIdentityBadge from "@/components/common/SnsIdentityBadge";
import { isValidSolanaAddress } from "@/utils/common";
import { trackFunnelStep } from "@/lib/funnel";

/**
 * Fire-and-forget: notify the builder that they just got backed.
 * Best-effort — never blocks the UI.
 */
function notifyBuilderBacked(developerAddress, amount, multiplier) {
  if (!developerAddress) return;
  try {
    const { auth } = require("@/lib/firebase/clientApp");
    const user = auth?.currentUser;
    if (!user) return;
    user.getIdToken().then((token) => {
      fetch("/api/activity/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "backing_received",
          walletAddress: developerAddress,
          amount,
          multiplier,
        }),
      }).catch(() => {});
    }).catch(() => {});
  } catch {
    // non-fatal
  }
}

/**
 * @param {{
 *   project: object,
 *   wallet: object,
 *   onClose: () => void,
 *   onSuccess: () => void,
 * }} props
 */
export default function BackingModal({ project, wallet, onClose, onSuccess }) {
  const { connected, account, chainId, publicClient, walletClient } = wallet;
  const [backingAmount, setBackingAmount] = useState("");
  const [backingMultiplier, setBackingMultiplier] = useState("150");
  const [backingStatus, setBackingStatus] = useState(null);
  const [backingError, setBackingError] = useState(null);
  const amountTrackedRef = useRef(false);

  // Funnel: modal_opened fires once per mount (per project).
  useEffect(() => {
    if (project?.id) trackFunnelStep("backing", "modal_opened", { projectId: project.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const showsSolName = !!project?.developer
    && (project?.ecosystem === "solana" || isValidSolanaAddress(project.developer));

  const submitBacking = async () => {
    if (!project || !backingAmount || parseFloat(backingAmount) <= 0) return;
    try {
      setBackingStatus("pending");
      setBackingError(null);
      const { creditService } = await import("@/services/creditService");
      await creditService.backProject(
        chainId,
        publicClient,
        walletClient,
        project.id,
        parseInt(backingMultiplier, 10),
        parseFloat(backingAmount),
      );
      setBackingStatus("success");
      trackFunnelStep("backing", "tx_confirmed", { projectId: project.id });
      onSuccess?.();

      // Fire-and-forget: notify the builder they got backed
      notifyBuilderBacked(project.developer, backingAmount, parseInt(backingMultiplier, 10));
    } catch (err) {
      setBackingStatus("error");
      setBackingError(err.message || "Transaction failed");
      trackFunnelStep("backing", "tx_failed", { projectId: project.id, error: String(err.message || err).slice(0, 120) });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => !backingStatus && onClose()}
    >
      <Card className="w-full max-w-md p-6 bg-white dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        {backingStatus === "success" ? (
          <div className="text-center py-4">
            <Confetti duration={3000} count={60} />
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-bold text-green-700 dark:text-green-300 text-lg">Backed successfully!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {backingAmount} USDC at {parseInt(backingMultiplier, 10) / 100}x on {project.name}
            </p>
            <div className="mt-4 flex flex-col gap-2 items-center">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `Just backed ${project.name} on PledgeBond! Stake USDC, earn when builders win prizes. 🚢`
                )}&url=${encodeURIComponent(
                  typeof window !== "undefined" ? `${window.location.origin}/projects/${project.ecosystem || "base"}/${project.slug || project.id}` : ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <ShareIcon className="w-4 h-4" /> Share your backing
              </a>
              <button type="button" onClick={onClose} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Back {project.name}</h3>
            {showsSolName && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                You&apos;re backing{" "}
                <SnsIdentityBadge
                  address={project.developer}
                  snsNameOverride={project.builderSnsDomain || null}
                  chainFamily="solana"
                  showFallback={true}
                  showLoading={true}
                  className="text-sm"
                />{" "}
                on {project.name}.
              </p>
            )}
            {connected && account?.toLowerCase() === project.developer?.toLowerCase() ? (
              <div className="flex items-center gap-2 mb-4 p-2 bg-green-50 border border-green-100 rounded-lg">
                <span className="text-lg">💎</span>
                <div>
                  <p className="text-xs font-bold text-green-800 dark:text-green-300 uppercase">Self-Staking Mode</p>
                  <p className="text-[10px] text-green-600 dark:text-green-400 italic">
                    Your stake provides a reputation boost + 2x credit limit boost.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Stake USDC with a multiplier. Returns paid when the builder wins prizes.
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (USDC)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={backingAmount}
                  onChange={(e) => {
                    setBackingAmount(e.target.value);
                    if (parseFloat(e.target.value) > 0 && !amountTrackedRef.current) {
                      amountTrackedRef.current = true;
                      trackFunnelStep("backing", "amount_entered", { projectId: project.id });
                    }
                  }}
                  placeholder="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Multiplier</label>
                <div className="flex gap-2">
                  {[{ v: "150", l: "1.5x" }, { v: "200", l: "2x" }, { v: "300", l: "3x" }].map(({ v, l }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setBackingMultiplier(v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                        backingMultiplier === v
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {backingAmount && parseFloat(backingAmount) > 0 && (
                <div className="bg-green-50 rounded-lg p-3 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Potential return: </span>
                  <span className="font-bold text-green-700 dark:text-green-300">
                    ${(parseFloat(backingAmount) * parseInt(backingMultiplier, 10) / 100).toFixed(2)} USDC
                  </span>
                </div>
              )}

              {backingError && <p className="text-sm text-red-600 dark:text-red-400">{backingError}</p>}

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-800 dark:text-purple-300">
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="font-medium">Your stake amount is shielded — other users won&apos;t see your position</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={backingStatus === "pending"}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitBacking}
                  disabled={!backingAmount || parseFloat(backingAmount) <= 0 || backingStatus === "pending"}
                  className="flex-1 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {backingStatus === "pending" ? "Confirming..." : "Confirm Backing"}
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
