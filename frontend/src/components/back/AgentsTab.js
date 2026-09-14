/**
 * AgentsTab — underwriting-first hub for winners; Scout stays available but secondary.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { Card } from "@/components/common/Card";
import TabBar from "@/components/common/TabBar";
import { AGENTS, AGENTS_INTRO } from "@/config/agents";
import { AGENTS_CAPITAL_HINT } from "@/config/capitalStack";
import AgentsSetupPanel from "./AgentsSetupPanel";

const GenlayerDemoPanel = dynamic(() => import("@/components/genlayer/GenlayerDemoPanel"), { ssr: false, loading: () => null });
const AnalyzePanel = dynamic(() => import("./AnalyzePanel"), { ssr: false, loading: () => null });
const ScoutPanel = dynamic(() => import("./ScoutPanel"), { ssr: false, loading: () => null });
const ComparePanel = dynamic(() => import("./ComparePanel"), { ssr: false, loading: () => null });

const MODE_TABS = [
  { id: "jury", label: "⚖️ Jury" },
  { id: "analyze", label: "Underwrite" },
  { id: "scout", label: "Scout" },
  { id: "compare", label: "Compare" },
  { id: "setup", label: "Wallet" },
];

/** Winner-facing agents first; Scout last in the roster strip. */
const WINNER_AGENT_ORDER = ["verify", "underwrite", "scout"];

/** Agent modes incl. the GenLayer jury demo — keep in sync with MODE_TABS. */
const AGENT_MODES = ["jury", "analyze", "scout", "compare", "setup"];

/**
 * @param {string | string[] | undefined} mode
 * @returns {string}
 */
function resolveMode(mode) {
  const value = Array.isArray(mode) ? mode[0] : mode;
  if (value && AGENT_MODES.includes(value)) return value;
  return "jury";
}

export default function AgentsTab() {
  const router = useRouter();
  const mode = resolveMode(router.query.mode);
  const orderedAgents = [...AGENTS].sort(
    (a, b) => WINNER_AGENT_ORDER.indexOf(a.id) - WINNER_AGENT_ORDER.indexOf(b.id),
  );

  const setMode = (nextMode) => {
    const query = { tab: "agents", mode: nextMode };
    if (router.query.project) query.project = router.query.project;
    router.replace({ pathname: "/back", query }, undefined, { shallow: true });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Agents</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{AGENTS_INTRO}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {AGENTS_CAPITAL_HINT}{" "}
              <Link href="/build?tab=wins" className="text-teal-600 dark:text-teal-400 underline">
                Open your winner desk
              </Link>
              .
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:min-w-[420px]">
            {orderedAgents.map((agent) => (
              <div
                key={agent.id}
                className={`bg-white dark:bg-gray-800 rounded-lg p-3 border ${
                  agent.id === "scout"
                    ? "border-gray-200 dark:border-gray-700 opacity-80"
                    : "border-teal-200 dark:border-teal-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{agent.icon}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{agent.name}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{agent.description}</p>
                <span className="text-xs font-bold text-teal-600">{agent.priceLabel} USDC</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <TabBar tabs={MODE_TABS} activeTab={mode} onChange={setMode} variant="pill" />

      {mode === "jury" && <GenlayerDemoPanel />}
      {mode === "analyze" && <AnalyzePanel />}
      {mode === "scout" && <ScoutPanel />}
      {mode === "compare" && <ComparePanel />}
      {mode === "setup" && <AgentsSetupPanel />}
    </div>
  );
}
