/**
 * EmptyState — Per-tab "no entries yet" CTA card.
 */

import Link from "next/link";
import { TrophyIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";

const CONFIG = {
  builders: {
    label: "builders",
    message: "Be the first to submit a project and climb the leaderboard.",
    link: "/build",
    cta: "Submit a project",
  },
  "proof-builders": {
    label: "proof builders",
    message: "No proof-backed builders yet. Add hackathon evidence to your project and become discoverable.",
    link: "/build",
    cta: "Add proof to a project",
  },
  projects: {
    label: "proven projects",
    message: "No proven projects yet. Submit a project with evidence-backed hackathon claims to attract lenders.",
    link: "/build",
    cta: "Submit a proven project",
  },
  lenders: {
    label: "lenders",
    message: "Be the first to fund a bridge loan and earn your spot.",
    link: "/back",
    cta: "Fund a bridge loan",
  },
  hackathons: {
    label: "hackathons",
    message: "No hackathon data yet. Submit a project with hackathon claims to start ranking.",
    link: "/build",
    cta: "Submit a project",
  },
};

export default function EmptyState({ tab }) {
  const c = CONFIG[tab] || CONFIG.builders;
  return (
    <Card className="p-12 text-center">
      <TrophyIcon className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        No {c.label} yet
      </h3>
      <p className="text-text-secondary mb-6 max-w-md mx-auto">
        {c.message}
      </p>
      <Link href={c.link}>
        <Button>{c.cta}</Button>
      </Link>
    </Card>
  );
}
