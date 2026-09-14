/**
 * computeBadges
 *
 * Derives badge eligibility from existing data (portfolio, projects, stats).
 * No backend changes needed — these are inferred client-side from data
 * that the API already returns.
 *
 * Each badge has:
 *   id          — unique badge identifier
 *   label       — display label
 *   description — tooltip text explaining how it was earned
 *   tier        — "gold" | "silver" | "bronze" | "default"
 *   icon        — icon component reference (resolved in ProofBadge)
 */

/**
 * Compute badges for a builder from their portfolio data.
 *
 * @param {object} portfolio   — portfolio API response (user, projects, stats)
 * @returns {object[]} Array of badge objects the builder has earned
 */
export function computeBuilderBadges(portfolio) {
  if (!portfolio) return [];

  const { user, projects, stats } = portfolio;
  if (!user || !projects) return [];

  const badges = [];

  // ── Verified Winner ──
  // Awarded when the hackathonWinners collection has a verified entry
  if (user.verifiedWinner) {
    const winCount = user.winnerData?.totalWins || 0;
    badges.push({
      id: "verified-winner",
      label: winCount > 1 ? `${winCount}x Verified Winner` : "Verified Winner",
      description: winCount > 0
        ? `Verified hackathon winner — ${winCount} win${winCount !== 1 ? "s" : ""} confirmed`
        : "Verified hackathon winner — on-chain payout confirmed",
      tier: "gold",
      category: "achievement",
    });
  }

  // ── Multi-Ecosystem ──
  // Builder has shipped on 2+ different ecosystems
  const ecosystems = new Set(
    projects.map((p) => p.ecosystem).filter(Boolean)
  );
  if (ecosystems.size >= 2) {
    badges.push({
      id: "multi-ecosystem",
      label: `${ecosystems.size}x Ecosystems`,
      description: `Shipped on ${ecosystems.size} different ecosystems: ${[...ecosystems].join(", ")}`,
      tier: ecosystems.size >= 4 ? "gold" : ecosystems.size >= 3 ? "silver" : "bronze",
      category: "reach",
    });
  }

  // ── Prolific Builder ──
  // Builder has 5+ projects
  const projectCount = projects.length;
  if (projectCount >= 3) {
    badges.push({
      id: "prolific",
      label: `${projectCount} Projects`,
      description: `Published ${projectCount} projects on PledgeBond`,
      tier: projectCount >= 10 ? "gold" : projectCount >= 5 ? "silver" : "bronze",
      category: "achievement",
    });
  }

  // ── Proof Builder ──
  // Builder has proof-backed claims (derived from hackathons with evidence)
  const hasProof = projects.some(
    (p) =>
      Array.isArray(p.hackathons) &&
      p.hackathons.some(
        (h) =>
          h.announcementUrl || h.submissionUrl || h.payoutTxHash || h.evidenceUrl
      )
  );
  if (hasProof) {
    badges.push({
      id: "proof-builder",
      label: "Proof-Backed",
      description: "At least one project has attached evidence to their claims",
      tier: "silver",
      category: "reputation",
    });
  }

  // ── Community Trust ──
  // Builder has received tester feedback or has followers
  const hasFeedback = projects.some(
    (p) => Array.isArray(p.testerTasks) && p.testerTasks.length > 0
  );
  const followerCount = portfolio.followerCount || 0;
  if (hasFeedback || followerCount >= 3) {
    badges.push({
      id: "community-trusted",
      label: "Community Trusted",
      description: followerCount >= 3
        ? `${followerCount} followers on PledgeBond`
        : "Runs tester tasks — trusted by the community",
      tier: followerCount >= 10 ? "gold" : followerCount >= 5 ? "silver" : "bronze",
      category: "social",
    });
  }

  // ── High Velocity ──
  // Average velocity across projects is high
  if (stats?.avgHealth) {
    const health = stats.avgHealth;
    if (health >= 80) {
      badges.push({
        id: "high-velocity",
        label: "High Velocity",
        description: `Average project health of ${health}% — consistently shipping quality work`,
        tier: "gold",
        category: "performance",
      });
    }
  }

  // ── Early Builder ──
  // One of the first to join
  const hasEarlyProject = projects.some((p) => {
    if (!p.createdAt && !p.submittedAt) return false;
    const date = new Date(p.createdAt || p.submittedAt);
    return date < new Date("2024-10-01");
  });
  if (hasEarlyProject) {
    badges.push({
      id: "early-builder",
      label: "Early Builder",
      description: "One of the first builders on PledgeBond",
      tier: "gold",
      category: "special",
    });
  }

  // ── Verified Payouts ──
  // Has on-chain verified payouts
  const hasPayouts = projects.some(
    (p) =>
      Array.isArray(p.hackathons) &&
      p.hackathons.some((h) => h.payoutVerifiedAt || h.payoutTxHash)
  );
  if (hasPayouts) {
    badges.push({
      id: "verified-payouts",
      label: "Verified Payouts",
      description: "At least one hackathon payout has been verified on-chain",
      tier: "silver",
      category: "reputation",
    });
  }

  return badges;
}

/**
 * Compute badges for a project from its data.
 *
 * @param {object} project — project document from Firestore
 * @returns {object[]} Array of badge objects the project has earned
 */
export function computeProjectBadges(project) {
  if (!project) return [];

  const badges = [];

  const hackathons = Array.isArray(project.hackathons) ? project.hackathons : [];

  // ── Proof Complete ──
  // Every claim has evidence attached
  if (hackathons.length > 0) {
    const allWithEvidence = hackathons.every(
      (h) =>
        h.announcementUrl || h.submissionUrl || h.payoutTxHash || h.payoutWallet || h.evidenceUrl
    );
    const someWithEvidence = hackathons.some(
      (h) =>
        h.announcementUrl || h.submissionUrl || h.payoutTxHash || h.payoutWallet || h.evidenceUrl
    );

    if (allWithEvidence && hackathons.length >= 2) {
      badges.push({
        id: "proof-complete",
        label: `${hackathons.length}/${hackathons.length} Evidence`,
        description: `All ${hackathons.length} claim${hackathons.length !== 1 ? "s" : ""} have attached evidence — fully provable`,
        tier: "gold",
        category: "proof",
      });
    } else if (allWithEvidence && hackathons.length === 1) {
      badges.push({
        id: "proof-complete",
        label: "Evidence Attached",
        description: "The claim for this project has supporting evidence",
        tier: "gold",
        category: "proof",
      });
    } else if (someWithEvidence) {
      const evidenceCount = hackathons.filter(
        (h) =>
          h.announcementUrl || h.submissionUrl || h.payoutTxHash || h.payoutWallet || h.evidenceUrl
      ).length;
      badges.push({
        id: "partial-proof",
        label: `${evidenceCount}/${hackathons.length} Evidence`,
        description: `${evidenceCount} of ${hackathons.length} claim${hackathons.length !== 1 ? "s" : ""} have attached evidence`,
        tier: evidenceCount >= hackathons.length / 2 ? "silver" : "bronze",
        category: "proof",
      });
    }
  }

  // ── Verified Win ──
  // Project has a verified hackathon win
  const hasVerifiedWin = hackathons.some(
    (h) =>
      (h.outcome === "winner" || h.outcome === "bounty winner") &&
      (h.payoutVerifiedAt || h.payoutTxHash || h.payoutWallet)
  );
  if (hasVerifiedWin) {
    badges.push({
      id: "verified-win",
      label: "Verified Win",
      description: "Won a hackathon with verified payout — outcome confirmed",
      tier: "gold",
      category: "achievement",
    });
  }

  // ── Community Tested ──
  // Has tester tasks with feedback
  const testerTasks = Array.isArray(project.testerTasks) ? project.testerTasks : [];
  if (testerTasks.length > 0) {
    badges.push({
      id: "community-tested",
      label: `${testerTasks.length} Tester Task${testerTasks.length !== 1 ? "s" : ""}`,
      description: "Open for community testing and feedback",
      tier: "silver",
      category: "social",
    });
  }

  // ── High Health ──
  // GitHub health score is excellent
  if (project.stats?.healthScore) {
    const health = project.stats.healthScore;
    if (health >= 80) {
      badges.push({
        id: "high-health",
        label: `${health}% Health`,
        description: "GitHub health score is excellent — active, maintained, and well-structured",
        tier: "gold",
        category: "performance",
      });
    }
  }

  // ── Jury Verified (GenLayer) ──
  // A decentralized jury reached consensus on at least one claim.
  // Fields are persisted by claim_verification (analyze.js) so this reads
  // consensus without re-resolving.
  const juryClaim = hackathons.find((h) => h.juryVerdict);
  if (juryClaim) {
    const delivered = juryClaim.juryVerdict === "DELIVERED";
    const humanVerdict = String(juryClaim.juryVerdict).toLowerCase().replace(/_/g, " ");
    badges.push({
      id: "jury-verified",
      label: delivered ? "Jury: Delivered" : `Jury: ${humanVerdict}`,
      description: delivered
        ? `GenLayer jury confirmed delivery${juryClaim.juryConfidence ? ` (${juryClaim.juryConfidence} confidence)` : ""}${juryClaim.juryReason ? ` — ${juryClaim.juryReason}` : ""}`
        : `GenLayer jury verdict: ${juryClaim.juryVerdict}${juryClaim.juryReason ? ` — ${juryClaim.juryReason}` : ""}`,
      tier: delivered && juryClaim.juryConfidence === "HIGH" ? "gold" : delivered ? "silver" : "bronze",
      category: "proof",
    });
  }

  return badges;
}

/**
 * Compute badges for a leaderboard entry from its limited data.
 *
 * Each leaderboard type has different fields available:
 *   proof-builder: verifiedWins, evidenceCoverage, proofBackedProjectCount, totalClaims, avgProofScore
 *   project: verifiedWins, evidenceBackedClaims, totalClaims, evidenceCoverage
 *   builder: projectCount, milestoneCount, velocity
 *   backer: totalBacked, projectsBacked
 *   hackathon: payoutCompletionRate, avgPayoutDays, totalProjects, winners
 *
 * @param {object} entry — leaderboard entry object
 * @param {string} type — "proof-builder" | "project" | "builder" | "backer" | "hackathon"
 * @returns {object[]} Array of badge objects
 */
export function computeLeaderboardBadges(entry, type) {
  if (!entry || !type) return [];

  const badges = [];

  switch (type) {
    case "proof-builder": {
      if (entry.verifiedWins > 0) {
        badges.push({
          id: "verified-win",
          label: `${entry.verifiedWins} Verified Win${entry.verifiedWins > 1 ? "s" : ""}`,
          description: `${entry.verifiedWins} hackathon win${entry.verifiedWins > 1 ? "s" : ""} with on-chain payout evidence`,
          tier: entry.verifiedWins >= 3 ? "gold" : "silver",
        });
      }
      if (entry.evidenceCoverage >= 80) {
        badges.push({
          id: "proof-complete",
          label: `${entry.evidenceCoverage}% Evidence`,
          description: `${entry.evidenceCoverage}% of claims have supporting evidence attached`,
          tier: entry.evidenceCoverage >= 95 ? "gold" : "silver",
        });
      }
      if (entry.proofBackedProjectCount >= 3) {
        badges.push({
          id: "prolific",
          label: `${entry.proofBackedProjectCount} Projects`,
          description: `${entry.proofBackedProjectCount} proof-backed projects on the platform`,
          tier: entry.proofBackedProjectCount >= 10 ? "gold" : entry.proofBackedProjectCount >= 5 ? "silver" : "bronze",
        });
      }
      break;
    }

    case "project": {
      if (entry.verifiedWins > 0) {
        badges.push({
          id: "verified-win",
          label: "Verified Win",
          description: "Hackathon win with verified on-chain payout — outcome confirmed",
          tier: "gold",
        });
      }
      if (entry.evidenceCoverage >= 90) {
        badges.push({
          id: "proof-complete",
          label: `${entry.evidenceBackedClaims || "All"}/${entry.totalClaims || "?"} Evidenced`,
          description: "All claims have supporting evidence — fully provable",
          tier: "gold",
        });
      } else if (entry.evidenceCoverage >= 50) {
        badges.push({
          id: "partial-proof",
          label: `${entry.evidenceBackedClaims || 0}/${entry.totalClaims || 0} Evidenced`,
          description: `${entry.evidenceBackedClaims} of ${entry.totalClaims} claims have attached evidence`,
          tier: "silver",
        });
      }
      break;
    }

    case "builder": {
      if (entry.projectCount >= 5) {
        badges.push({
          id: "prolific",
          label: `${entry.projectCount} Projects`,
          description: `${entry.projectCount} projects submitted to the platform`,
          tier: entry.projectCount >= 15 ? "gold" : entry.projectCount >= 10 ? "silver" : "bronze",
        });
      }
      if (entry.velocity >= 200) {
        badges.push({
          id: "high-velocity",
          label: `${entry.velocity} Velocity`,
          description: `Shipping velocity of ${entry.velocity} — consistently delivering`,
          tier: entry.velocity >= 500 ? "gold" : "silver",
        });
      }
      break;
    }

    case "backer": {
      if (entry.totalBacked >= 50000) {
        badges.push({
          id: "verified-payouts",
          label: `$${formatCompact(entry.totalBacked)} Backed`,
          description: `Total backing volume of $${formatCompact(entry.totalBacked)} across all projects`,
          tier: entry.totalBacked >= 100000 ? "gold" : "silver",
        });
      }
      if (entry.projectsBacked >= 10) {
        badges.push({
          id: "community-trusted",
          label: `${entry.projectsBacked} Projects`,
          description: `Backed ${entry.projectsBacked} unique projects — diversified supporter`,
          tier: entry.projectsBacked >= 25 ? "gold" : entry.projectsBacked >= 15 ? "silver" : "bronze",
        });
      }
      break;
    }

    case "hackathon": {
      if (entry.avgPayoutDays !== null && entry.avgPayoutDays <= 7) {
        badges.push({
          id: "verified-payouts",
          label: `${entry.avgPayoutDays}d Payout`,
          description: `Average payout time of ${entry.avgPayoutDays} days — lightning fast`,
          tier: "gold",
        });
      }
      if (entry.payoutCompletionRate >= 90) {
        badges.push({
          id: "proof-complete",
          label: `${entry.payoutCompletionRate}% Paid`,
          description: `${entry.payoutCompletionRate}% of winners received their payouts`,
          tier: entry.payoutCompletionRate >= 98 ? "gold" : "silver",
        });
      }
      break;
    }
  }

  return badges;
}

function formatCompact(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

/**
 * Resolve the tier color classes for a given tier name.
 */
export function getTierStyles(tier) {
  switch (tier) {
    case "gold":
      return {
        bg: "bg-amber-50 dark:bg-amber-900/20",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-700",
        icon: "text-amber-500",
      };
    case "silver":
      return {
        bg: "bg-slate-50 dark:bg-slate-800/60",
        text: "text-slate-700 dark:text-slate-300",
        border: "border-slate-200 dark:border-slate-600",
        icon: "text-slate-400",
      };
    case "bronze":
      return {
        bg: "bg-orange-50 dark:bg-orange-900/20",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-200 dark:border-orange-700",
        icon: "text-orange-400",
      };
    default:
      return {
        bg: "bg-gray-50 dark:bg-gray-800/60",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-200 dark:border-gray-600",
        icon: "text-gray-400",
      };
  }
}
