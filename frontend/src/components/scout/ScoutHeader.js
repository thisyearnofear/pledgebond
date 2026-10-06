/**
 * ScoutHeader — hero band for the scout panel.
 *
 * Title, agent badge with pulse dot, description, Share button.
 * There is no Copy button: the Scout publishes reasoning traces only —
 * it never executes anything on a user's behalf.
 */
import Button from "@/components/common/Button";
import {
  CpuChipIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";

export default function ScoutHeader({ onShare, embedded = false }) {
  const TitleTag = embedded ? "h2" : "h1";
  return (
    <div className="bg-gradient-to-b from-indigo-900/20 to-slate-950 border-b border-slate-800">
      <div className={`max-w-5xl mx-auto px-4 ${embedded ? "py-8" : "py-12"}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <CpuChipIcon className="w-8 h-8 text-cyan-400 dark:text-cyan-500" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse border-2 border-slate-900" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400 dark:text-cyan-500">Autonomous Agent</span>
            </div>
            <TitleTag className={`${embedded ? "text-2xl" : "text-3xl"} font-bold text-white mb-2`}>Proof Scout</TitleTag>
            <p className="text-slate-400 dark:text-slate-500 max-w-xl">
              An AI agent that continuously evaluates builder projects and generates shareable reasoning traces for lenders. It flags candidates — it never stakes or moves capital.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={onShare} variant="outline" className="text-xs">
              <ShareIcon className="w-3.5 h-3.5 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
