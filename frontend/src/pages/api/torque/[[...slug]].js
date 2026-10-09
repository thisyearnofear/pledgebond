import { db } from "../../../lib/firebase/serverOnly";
import { summarizeClaimProof } from "@/lib/leaderboard/proofScoring";

export default async function handler(req, res) {
  const { slug } = req.query;
  const action = Array.isArray(slug) && slug.length > 0 ? slug[0] : null;

  switch (action) {
    case "leaderboard":
      return handleLeaderboard(req, res);
    case "incentives":
      return handleIncentives(req, res);
    case "events":
      return handleEvents(req, res);
    default:
      if (!action) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}

async function handleLeaderboard(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  try {
    let prevBuilders = null;
    let prevBackers = null;
    try {
      const prevSnap = await db.collection('leaderboardSnapshots').doc('torque').get();
      if (prevSnap.exists) {
        const prev = prevSnap.data();
        prevBuilders = prev.builders || null;
        prevBackers = prev.backers || null;
      }
    } catch (e) {
      console.warn('Could not load previous torque leaderboard snapshot:', e.message);
    }

    const projectsSnap = await db.collection("projects").get();

    const builderMap = new Map();

    for (const doc of projectsSnap.docs) {
      const p = doc.data();
      const owner = p.submittedBy || p.owner || "unknown";

      if (!builderMap.has(owner)) {
        builderMap.set(owner, {
          address: owner,
          name: p.owner || null,
          projectCount: 0,
          milestoneCount: 0,
          ecosystems: new Set(),
          velocity: 0,
          verifiedWins: 0,
        });
      }

      const builder = builderMap.get(owner);
      builder.projectCount++;
      const milestones = Array.isArray(p.milestones) ? p.milestones.length : 0;
      builder.milestoneCount += milestones;
      if (p.ecosystem) builder.ecosystems.add(p.ecosystem);

      // Verified-win count so the share surface (verified wins only) and
      // OG cards can see the same credibility signal as the proof board.
      const claims = Array.isArray(p.hackathons) ? p.hackathons : [];
      for (const claim of claims) {
        if (claim.name && summarizeClaimProof(claim).isVerifiedWin) {
          builder.verifiedWins++;
        }
      }

      builder.velocity = builder.projectCount * 5 + builder.milestoneCount * 10;
    }

    const builders = Array.from(builderMap.values())
      .map((b) => ({
        ...b,
        ecosystems: undefined,
        primaryEcosystem: [...b.ecosystems][0] || null,
      }))
      .sort((a, b) => b.velocity - a.velocity)
      .slice(0, limit);

    let backers = [];
    try {
      const activitiesSnap = await db
        .collection("activities")
        .where("type", "==", "stake_added")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();

      const backerMap = new Map();

      for (const doc of activitiesSnap.docs) {
        const a = doc.data();
        const addr = a.userHandle || a.userPubkey || "unknown";

        if (!backerMap.has(addr)) {
          backerMap.set(addr, {
            address: addr,
            name: a.userName || null,
            totalBacked: 0,
            projectsBacked: new Set(),
            score: 0,
          });
        }

        const backer = backerMap.get(addr);
        const amount = parseFloat(a.amount) || 0;
        backer.totalBacked += amount;
        if (a.projectSlug) backer.projectsBacked.add(a.projectSlug);
        backer.score = Math.round(backer.totalBacked * 0.1 + backer.projectsBacked.size * 10);
      }

      backers = Array.from(backerMap.values())
        .map((b) => ({
          ...b,
          projectsBacked: b.projectsBacked.size,
          // Backers are keyed by wallet, same address space as builders —
          // a lender who is also a verified winner keeps their share surface.
          verifiedWins: builderMap.get(b.address)?.verifiedWins || 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (e) {
      console.warn("Could not load backer activities:", e.message);
    }

    if (process.env.TORQUE_API_KEY) {
      try {
        const torqueRes = await fetch("https://api.torque.so/leaderboard", {
          headers: { "x-api-key": process.env.TORQUE_API_KEY },
        });
        if (torqueRes.ok) {
          const torqueData = await torqueRes.json();
          if (torqueData.builders) {
            for (const tBuilder of torqueData.builders) {
              const local = builders.find((b) => b.address === tBuilder.address);
              if (local) {
                local.velocity += tBuilder.velocity || 0;
                local.source = "torque";
              }
            }
            builders.sort((a, b) => b.velocity - a.velocity);
          }
          if (torqueData.backers) {
            for (const tBacker of torqueData.backers) {
              const local = backers.find((b) => b.address === tBacker.address);
              if (local) {
                local.score += tBacker.score || 0;
                local.source = "torque";
              }
            }
            backers.sort((a, b) => b.score - a.score);
          }
        }
      } catch (e) {
        console.warn("Torque leaderboard enrichment failed (non-blocking):", e.message);
      }
    }

    function computeMovement(entries, prevMap) {
      if (!prevMap) return entries;
      return entries.map((entry, idx) => {
        const id = entry.address;
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

    const buildersWithMovement = computeMovement(builders, prevBuilders);
    const backersWithMovement = computeMovement(backers, prevBackers);

    try {
      await db.collection('leaderboardSnapshots').doc('torque').set({
        builders: Object.fromEntries(builders.map((e, i) => [e.address, i])),
        backers: Object.fromEntries(backers.map((e, i) => [e.address, i])),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not save torque leaderboard snapshot (non-blocking):', e.message);
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ builders: buildersWithMovement, backers: backersWithMovement });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
}

async function handleIncentives(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiToken = process.env.TORQUE_API_TOKEN;
  if (!apiToken) {
    return res.status(200).json({ incentives: [] });
  }

  const projectId = process.env.TORQUE_PROJECT_ID;
  if (!projectId) {
    return res.status(200).json({ incentives: [] });
  }

  try {
    const response = await fetch(
      `https://server.torque.so/projects/${projectId}/incentives`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );

    if (!response.ok) {
      return res.status(200).json({ incentives: [] });
    }

    const { data } = await response.json();
    const active = (data || []).filter(
      (i) => i.status === "ACTIVE" || i.status === "active"
    );

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ incentives: active });
  } catch (err) {
    console.warn("[Torque] incentives fetch failed (non-blocking):", err.message);
    return res.status(200).json({ incentives: [] });
  }
}

async function handleEvents(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.TORQUE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Torque not configured",
      message: "Set TORQUE_API_KEY to enable event tracking",
    });
  }

  try {
    const { eventName, userPubkey, timestamp, data } = req.body;

    if (!eventName || !userPubkey) {
      return res.status(400).json({ error: "eventName and userPubkey required" });
    }

    const response = await fetch("https://ingest.torque.so/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        eventName,
        userPubkey,
        timestamp: timestamp || Date.now(),
        data: data || {},
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn("[Torque API] upstream rejected:", response.status, text);
      return res.status(response.status).json({
        error: "Upstream rejection",
        upstream: text.slice(0, 200),
      });
    }

    return res.status(202).json({ success: true });
  } catch (err) {
    console.error("[Torque API] proxy error:", err);
    return res.status(500).json({ error: "Proxy failed", message: err.message });
  }
}
