/**
 * Hackathon / proof leaderboard API
 *
 * Returns proof-backed rankings for:
 * - Hackathons
 * - Builders
 * - Projects
 *
 * All three are derived from structured hackathon proof attached to projects.
 */

import { db } from "../../../lib/firebase/serverOnly";
import { summarizeClaimProof } from "@/lib/leaderboard/proofScoring";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Load previous snapshot for rank movement tracking
    let prevHackathons = null;
    let prevBuilders = null;
    let prevProjects = null;
    try {
      const prevSnap = await db.collection('leaderboardSnapshots').doc('hackathons').get();
      if (prevSnap.exists) {
        const prev = prevSnap.data();
        prevHackathons = prev.hackathons || null;
        prevBuilders = prev.builders || null;
        prevProjects = prev.projects || null;
      }
    } catch (e) {
      // First run or Firestore not ready — no movement data yet
      console.warn('Could not load previous leaderboard snapshot:', e.message);
    }

    // Paginated read (S1): cursor batches instead of an unbounded
    // collection get() — bounds read cost per request and avoids the
    // 60s serverless timeout as the projects collection grows.
    const PAGE_SIZE = 500;
    let projectsSnap = { docs: [] };
    try {
      let query = db.collection("projects").orderBy("__name__").limit(PAGE_SIZE);
      let allDocs = [];
      // Cursor loop: keep pulling pages until short/empty. Implicit
      // orderBy on __name__ keeps the cursor stable across pages.
      for (;;) {
        const snap = await query.get();
        allDocs = allDocs.concat(snap.docs);
        if (snap.docs.length < PAGE_SIZE) break;
        const last = snap.docs[snap.docs.length - 1];
        query = db.collection("projects").orderBy("__name__").startAfter(last).limit(PAGE_SIZE);
      }
      projectsSnap = { docs: allDocs };
    } catch (e) {
      console.warn("Paginated projects read failed, trying single read:", e.message);
      projectsSnap = await db.collection("projects").get();
    }

    const hackathonMap = new Map();
    const builderMap = new Map();
    const projectMap = new Map();

    for (const doc of projectsSnap.docs) {
      const project = doc.data();
      const projectId = project.slug || doc.id;
      const hackathons = Array.isArray(project.hackathons) ? project.hackathons : [];
      if (hackathons.length === 0) continue;

      const projectEntry = projectMap.get(projectId) || {
        slug: project.slug || doc.id,
        name: project.name || project.slug || doc.id,
        ecosystem: project.ecosystem || null,
        githubUrl: project.githubUrl || null,
        imageUrl: project.imageUrl || null,
        ownerName: project.owner || null,
        totalClaims: 0,
        evidenceBackedClaims: 0,
        verifiedWins: 0,
        totalProofScore: 0,
        bestProofScore: 0,
        createdAt: project.createdAt || null,
      };

      const builderKey = project.submittedBy || project.owner || project.slug || doc.id;
      const builderEntry = builderMap.get(builderKey) || {
        id: builderKey,
        name: project.builderName || project.owner || project.submittedBy || "Builder",
        ecosystems: new Set(),
        projectCount: 0,
        proofBackedProjects: new Set(),
        verifiedWins: 0,
        evidenceBackedClaims: 0,
        totalClaims: 0,
        totalProofScore: 0,
        bestProofScore: 0,
        lastActivity: null,
      };
      builderEntry.ecosystems.add(project.ecosystem || 'unknown');
      builderEntry.projectCount += 1;
      if (project.createdAt && (!builderEntry.lastActivity || project.createdAt > builderEntry.lastActivity)) {
        builderEntry.lastActivity = project.createdAt;
      }

      for (const claim of hackathons) {
        if (!claim.name) continue;

        // Trust gate: only surface verified claims on the public leaderboard.
        // Claims must either be payout_verified, or have evidence attached
        // with a real evidenceUrl. "pending" claims are excluded entirely
        // so unverified self-attested wins never appear publicly.
        const status = claim.verificationStatus;
        if (status === "pending" || (!status && !claim.evidenceUrl)) {
          continue;
        }
        if (status === "evidence_attached" && !claim.evidenceUrl) {
          continue;
        }

        const proof = summarizeClaimProof(claim);
        const key = claim.name.trim().toLowerCase();

        if (!hackathonMap.has(key)) {
          hackathonMap.set(key, {
            name: claim.name.trim(),
            ecosystem: project.ecosystem || null,
            totalProjects: 0,
            winners: 0,
            finalists: 0,
            payoutsRecorded: 0,
            payoutSpeedCount: 0,
            totalPayoutDays: 0,
            totalPrizeAmount: 0,
            uniqueBuilders: new Set(),
            lastActivity: null,
            totalProofScore: 0,
            evidenceBackedClaims: 0,
            verifiedWins: 0,
            strongProofClaims: 0,
            totalClaims: 0,
          });
        }

        const entry = hackathonMap.get(key);
        entry.totalProjects++;
        entry.totalClaims++;
        entry.totalProofScore += proof.proofScore;
        if (proof.evidenceCount > 0) entry.evidenceBackedClaims++;
        if (proof.hasStrongProof) entry.strongProofClaims++;
        if (proof.isVerifiedWin) entry.verifiedWins++;

        if (project.submittedBy) {
          entry.uniqueBuilders.add(project.submittedBy);
        }

        if (claim.outcome === 'winner' || claim.outcome === 'bounty winner') {
          entry.winners++;
        } else if (claim.outcome === 'finalist') {
          entry.finalists++;
        }

        const hasPayout = claim.payoutVerifiedAt || claim.payoutAt;
        if (hasPayout) {
          entry.payoutsRecorded++;
          const amount = Number(claim.payoutActualAmount) || Number(claim.prizeAmount) || 0;
          if (amount > 0) entry.totalPrizeAmount += amount;
        }

        const payoutDateStr = claim.payoutVerifiedAt || claim.payoutAt;
        const endDateStr = claim.hackathonEndDate;
        if (payoutDateStr && endDateStr) {
          const payoutDate = new Date(payoutDateStr);
          const endDate = new Date(endDateStr);
          if (!isNaN(payoutDate.getTime()) && !isNaN(endDate.getTime())) {
            const diffMs = payoutDate.getTime() - endDate.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) {
              entry.payoutSpeedCount++;
              entry.totalPayoutDays += diffDays;
            }
          }
        }

        if (project.createdAt && (!entry.lastActivity || project.createdAt > entry.lastActivity)) {
          entry.lastActivity = project.createdAt;
        }

        projectEntry.totalClaims++;
        projectEntry.totalProofScore += proof.proofScore;
        projectEntry.bestProofScore = Math.max(projectEntry.bestProofScore, proof.proofScore);
        if (proof.evidenceCount > 0) projectEntry.evidenceBackedClaims++;
        if (proof.isVerifiedWin) projectEntry.verifiedWins++;

        builderEntry.totalClaims++;
        builderEntry.totalProofScore += proof.proofScore;
        builderEntry.bestProofScore = Math.max(builderEntry.bestProofScore, proof.proofScore);
        if (proof.evidenceCount > 0) builderEntry.evidenceBackedClaims++;
        if (proof.isVerifiedWin) builderEntry.verifiedWins++;
        if (proof.evidenceCount > 0) builderEntry.proofBackedProjects.add(projectId);
      }

      projectMap.set(projectId, projectEntry);
      builderMap.set(builderKey, builderEntry);
    }

    const hackathons = Array.from(hackathonMap.values()).map((entry) => {
      const payoutCompletionRate = entry.winners > 0
        ? Math.round((entry.payoutsRecorded / entry.winners) * 100)
        : 0;
      const avgPayoutDays = entry.payoutSpeedCount > 0
        ? Math.round(entry.totalPayoutDays / entry.payoutSpeedCount)
        : null;
      const builderCount = entry.uniqueBuilders.size;
      const avgProofScore = entry.totalClaims > 0 ? Math.round(entry.totalProofScore / entry.totalClaims) : 0;
      const evidenceCoverage = entry.totalClaims > 0 ? Math.round((entry.evidenceBackedClaims / entry.totalClaims) * 100) : 0;
      const strongProofRate = entry.totalClaims > 0 ? Math.round((entry.strongProofClaims / entry.totalClaims) * 100) : 0;
      const payoutSpeedScore = avgPayoutDays !== null
        ? Math.max(0, 100 - Math.round((avgPayoutDays / 365) * 100))
        : null;
      const builderScore = Math.min(100, builderCount * 20);
      const volumeScore = Math.min(100, entry.totalProjects * 15);

      let score;
      if (payoutSpeedScore !== null) {
        score = Math.round(
          payoutSpeedScore * 0.25 +
          payoutCompletionRate * 0.20 +
          avgProofScore * 0.25 +
          evidenceCoverage * 0.15 +
          builderScore * 0.10 +
          volumeScore * 0.05
        );
      } else {
        score = Math.round(
          avgProofScore * 0.35 +
          evidenceCoverage * 0.25 +
          payoutCompletionRate * 0.20 +
          builderScore * 0.12 +
          volumeScore * 0.08
        );
      }

      return {
        name: entry.name,
        ecosystem: entry.ecosystem,
        totalProjects: entry.totalProjects,
        winners: entry.winners,
        finalists: entry.finalists,
        payoutsRecorded: entry.payoutsRecorded,
        payoutCompletionRate,
        avgPayoutDays,
        totalPrizeAmount: Math.round(entry.totalPrizeAmount),
        builderCount,
        verifiedWins: entry.verifiedWins,
        avgProofScore,
        evidenceCoverage,
        strongProofRate,
        lastActivity: entry.lastActivity || null,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    const builders = Array.from(builderMap.values()).map((entry) => {
      const avgProofScore = entry.totalClaims > 0 ? Math.round(entry.totalProofScore / entry.totalClaims) : 0;
      const evidenceCoverage = entry.totalClaims > 0 ? Math.round((entry.evidenceBackedClaims / entry.totalClaims) * 100) : 0;
      const proofBackedProjectCount = entry.proofBackedProjects.size;
      const score = Math.round(
        avgProofScore * 0.35 +
        Math.min(100, proofBackedProjectCount * 20) * 0.25 +
        Math.min(100, entry.verifiedWins * 30) * 0.25 +
        evidenceCoverage * 0.15
      );

      return {
        id: entry.id,
        name: entry.name,
        ecosystem: Array.from(entry.ecosystems).filter(Boolean).join(', '),
        projectCount: entry.projectCount,
        proofBackedProjectCount,
        totalClaims: entry.totalClaims,
        evidenceBackedClaims: entry.evidenceBackedClaims,
        verifiedWins: entry.verifiedWins,
        avgProofScore,
        bestProofScore: entry.bestProofScore,
        evidenceCoverage,
        lastActivity: entry.lastActivity,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    const projects = Array.from(projectMap.values()).map((entry) => {
      const avgProofScore = entry.totalClaims > 0 ? Math.round(entry.totalProofScore / entry.totalClaims) : 0;
      const evidenceCoverage = entry.totalClaims > 0 ? Math.round((entry.evidenceBackedClaims / entry.totalClaims) * 100) : 0;
      const score = Math.round(
        avgProofScore * 0.45 +
        Math.min(100, entry.verifiedWins * 35) * 0.30 +
        evidenceCoverage * 0.15 +
        Math.min(100, entry.totalClaims * 15) * 0.10
      );

      return {
        slug: entry.slug,
        name: entry.name,
        ecosystem: entry.ecosystem,
        githubUrl: entry.githubUrl,
        imageUrl: entry.imageUrl,
        ownerName: entry.ownerName,
        totalClaims: entry.totalClaims,
        evidenceBackedClaims: entry.evidenceBackedClaims,
        verifiedWins: entry.verifiedWins,
        avgProofScore,
        bestProofScore: entry.bestProofScore,
        evidenceCoverage,
        createdAt: entry.createdAt,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    const topHackathons = hackathons.slice(0, 100);
    const topBuilders = builders.slice(0, 100);
    const topProjects = projects.slice(0, 100);

    // Compute movement by comparing current rank against previous snapshot
    function computeMovement(entries, prevMap) {
      if (!prevMap) return entries;
      return entries.map((entry, idx) => {
        const id = entry.slug || entry.id || entry.name;
        const prevIdx = prevMap[id];
        let movement = undefined;
        if (prevIdx === undefined) {
          movement = 'new';
        } else if (idx < prevIdx) {
          movement = 'up';
        } else if (idx > prevIdx) {
          movement = 'down';
        }
        return { ...entry, movement };
      });
    }

    const result = {
      hackathons: computeMovement(topHackathons, prevHackathons),
      builders: computeMovement(topBuilders, prevBuilders),
      projects: computeMovement(topProjects, prevProjects),
      total: {
        hackathons: hackathons.length,
        builders: builders.length,
        projects: projects.length,
      },
    };

    // Save current rankings as snapshot for next comparison
    try {
      await db.collection('leaderboardSnapshots').doc('hackathons').set({
        hackathons: Object.fromEntries(topHackathons.map((e, i) => [e.name, i])),
        builders: Object.fromEntries(topBuilders.map((e, i) => [e.id || e.name, i])),
        projects: Object.fromEntries(topProjects.map((e, i) => [e.slug, i])),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not save leaderboard snapshot (non-blocking):', e.message);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("Hackathon leaderboard error:", err);
    return res.status(500).json({ error: "Failed to load hackathon leaderboard" });
  }
}
