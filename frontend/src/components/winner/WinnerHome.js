/**
 * WinnerHome — post-login spine for hackathon winners.
 * Claim status · payout clock · Underwriter packet.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import useWinnerStatus from "@/hooks/useWinnerStatus";
import { Card } from "@/components/common/Card";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import WinnerPacket from "@/components/winner/WinnerPacket";
import {
  CheckCircleIcon,
  ClockIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

function matchPayoutEntry(wins, hackathons) {
  if (!Array.isArray(hackathons) || hackathons.length === 0) return null;
  const names = (wins || [])
    .map((w) => (w.hackathonName || w.name || "").toLowerCase())
    .filter(Boolean);
  if (names.length === 0) {
    return hackathons.find((h) => h.avgPayoutDays != null) || hackathons[0] || null;
  }
  const direct = hackathons.find((h) =>
    names.some((n) => (h.name || "").toLowerCase().includes(n) || n.includes((h.name || "").toLowerCase())),
  );
  return direct || hackathons.find((h) => h.avgPayoutDays != null) || null;
}

export default function WinnerHome() {
  const { currentUser } = useUser();
  const { isVerified, wins, pendingClaim, loading: winnerLoading } = useWinnerStatus();
  const router = useRouter();
  const [hackathons, setHackathons] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  // Deep-link focus: /build?tab=wins&focus=claim scrolls to + flashes the
  // exact action card (pending review or unclaimed win CTA).
  useEffect(() => {
    if (winnerLoading) return;
    if (router.query.focus !== "claim") return;
    const anchor = pendingClaim ? "win-status-card" : !isVerified ? "win-status-card" : null;
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-amber-400", "ring-offset-2", "rounded-xl");
    const timer = setTimeout(() => {
      el.classList.remove("ring-2", "ring-amber-400", "ring-offset-2", "rounded-xl");
    }, 2400);
    return () => {
      clearTimeout(timer);
      el.classList.remove("ring-2", "ring-amber-400", "ring-offset-2", "rounded-xl");
    };
  }, [router.query.focus, winnerLoading, pendingClaim, isVerified]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingExtra(true);
      try {
        const [lbRes] = await Promise.all([
          fetch("/api/hackathons/leaderboard"),
        ]);
        if (lbRes.ok) {
          const data = await lbRes.json();
          if (!cancelled) setHackathons(data.hackathons || []);
        }

        if (currentUser) {
          const { db } = await import("@/lib/firebase/clientApp");
          const { collection, getDocs, query, where, limit: fbLimit } = await import("firebase/firestore");
          const uid = currentUser.uid;
          const snap = await getDocs(
            query(collection(db, "projects"), where("submittedBy", "==", uid), fbLimit(20)),
          );
          let mine = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (mine.length === 0) {
            const ownerSnap = await getDocs(
              query(collection(db, "projects"), where("ownerUid", "==", uid), fbLimit(20)),
            );
            mine = ownerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          }
          if (!cancelled) setProjects(mine);
        }
      } catch (err) {
        console.warn("WinnerHome load failed:", err);
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const payoutMatch = useMemo(
    () => matchPayoutEntry(wins, hackathons),
    [wins, hackathons],
  );

  if (winnerLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary">Your post-win desk</h2>
        <p className="text-sm text-secondary mt-1">
          Claim status, payout clock, and an Underwriter packet — the spine before credit rails.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card id="win-status-card" className="p-5 space-y-3 transition-shadow">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-primary">Win status</h3>
          </div>
          {isVerified ? (
            <div className="flex items-start gap-2 text-sm text-secondary">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-primary">Verified winner</p>
                <ul className="mt-1 space-y-1">
                  {(wins.length ? wins : [{ hackathonName: "Hackathon win on file" }]).map((w, i) => (
                    <li key={i}>
                      {w.hackathonName || w.name || "Win"}
                      {w.outcome ? ` · ${w.outcome}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : pendingClaim ? (
            <div className="flex items-start gap-2 text-sm text-secondary">
              <ClockIcon className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-primary">Claim pending review</p>
                <p className="mt-1">We will notify you when verification completes.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-secondary">
              <ExclamationTriangleIcon className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <p className="font-medium text-primary">No win claimed yet</p>
                <p className="mt-1 mb-3">
                  Claiming is the front door — without it, payout truth and packets stay locked.
                </p>
                <Link
                  href="/projects/new"
                  className="inline-flex items-center justify-center rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2"
                >
                  Claim your win
                </Link>
              </div>
            </div>
          )}
          {(isVerified || pendingClaim) && (
            <Link href="/projects/new" className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline inline-block">
              Submit or continue a project →
            </Link>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-primary">Payout clock</h3>
          </div>
          {loadingExtra ? (
            <LoadingSpinner size="small" />
          ) : payoutMatch && payoutMatch.avgPayoutDays != null ? (
            <div className="text-sm text-secondary space-y-2">
              <p>
                <span className="font-semibold text-primary">{payoutMatch.name}</span>
                {" "}averages{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {payoutMatch.avgPayoutDays} days
                </span>{" "}
                to pay winners
                {payoutMatch.payoutCompletionRate != null
                  ? ` · ${payoutMatch.payoutCompletionRate}% completion`
                  : ""}
                .
              </p>
              <Link href="/leaderboard" className="font-medium text-teal-700 dark:text-teal-300 hover:underline">
                Compare orgs on the payout leaderboard →
              </Link>
            </div>
          ) : (
            <div className="text-sm text-secondary space-y-2">
              <p>No matched payout-speed row yet for your win. Public data still helps you negotiate.</p>
              <Link href="/leaderboard" className="font-medium text-teal-700 dark:text-teal-300 hover:underline">
                See payout speeds →
              </Link>
            </div>
          )}
        </Card>
      </div>

      {(isVerified || pendingClaim || projects.length > 0) && (
        <WinnerPacket wins={wins} projects={projects} payoutMatch={payoutMatch} />
      )}
    </div>
  );
}
