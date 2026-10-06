import { withNanopayment } from "@/lib/nanopayment";
import { getAisaFetch, AISA_BASE_URL, isAisaConfigured } from "@/server/aisaClient";
import { getCachedResult, setCachedResult } from "@/lib/agentCache";
import { agentIdentityResponse, getAgentIdentity } from "@/lib/agentIdentity";
import { withAgentAuth } from "@/lib/agentAuth";
import { db } from "@/lib/firebase/serverOnly";
import { computeScore, getRecommendation, MIN_SCORE_TO_BACK } from "@/lib/scoringEngine";
import { getAttestcoinClient } from "@/lib/attestcoin";

export default async function handler(req, res) {
  const { slug } = req.query;
  const action = Array.isArray(slug) && slug.length > 0 ? slug[0] : null;

  switch (action) {
    case "chat":
      return handleChat(req, res);
    case "underwrite":
      return handleUnderwrite(req, res);
    case "verify":
      return handleVerify(req, res);
    case "scout":
      return handleScout(req, res);
    case "peek":
      return handlePeek(req, res);
    case "execute":
      // Removed in Phase 0: this route let a 0.01 USDC toll authorize the
      // agent wallet to stake platform capital at leveraged multipliers.
      // The platform does not underwrite, so it does not back projects.
      return res.status(410).json({
        error: "Agent-backed project staking has been removed",
        removed: "platform-agent-staking",
      });
    case "copy":
      return handleCopy(req, res);
    default:
      if (!action) return res.status(404).json({ error: "Not found" });
      return res.status(404).json({ error: `Unknown agent: ${action}` });
  }
}

/**
 * Peek — free, unauthenticated read of cached agent results.
 *
 * The surfacing half of the agent economy: the first caller pays for an
 * Underwriter run; everyone else reads the cached summary for free.
 * This endpoint never runs inference and never charges — it only reads
 * the agentCache collection. Returns 204 when nothing is cached yet so
 * cards can silently skip the badge.
 */
async function handlePeek(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query parameter is required" });

  try {
    const cached = await getCachedResult("underwrite", { projectId });
    if (!cached) return res.status(204).end();

    const d = cached.data || {};
    // getRecommendation returns {priority, label, note} or null (below MIN_SCORE_TO_BACK).
    const rec = d.recommendation || null;
    return res.status(200).json({
      success: true,
      cached: true,
      cachedAt: cached.cachedAt,
      cachedAge: cached.ageHuman,
      projectId,
      summary: {
        healthScore: d.healthScore ?? null,
        // Derive the tier verdict from the score the same way the card badge does.
        recommendation: rec ? `bridge-loan candidate — ${rec.label}` : d.healthScore != null && d.healthScore < MIN_SCORE_TO_BACK ? "below candidate threshold" : null,
        healthVerdict: rec ? "fundable" : "watch",
        aiAnalysis: typeof d.aiAnalysis === "string" ? d.aiAnalysis.slice(0, 280) : null,
      },
    });
  } catch (err) {
    console.warn("Peek failed:", err.message);
    return res.status(204).end();
  }
}

const FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY || "";
const FEATHERLESS_MODEL = "deepseek-ai/DeepSeek-V3-0324";
const FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GOOGLE_MODEL = "gemini-2.0-flash";
const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const SYSTEM_PROMPT = `You are the PledgeBond AI Assistant — a helpful guide for a platform that tracks and funds blockchain projects using x402 nanopayments settled in USDC.

Key platform features you should help users with:
- **Explore**: Browse projects across 7 ecosystems (Arc, Celo, Base, Linea, Arbitrum, Ethereum, Optimism)
- **Back**: Use AI agents (Underwriter, Scout, Verifier) to analyze projects. Each agent costs a small USDC micropayment via x402.
- **Submit**: Add your own project — just needs a name, description, GitHub URL, ecosystem, and category.
- **AI Agents**: The Underwriter ($0.05) scores project health, the Scout ($0.01) finds top projects, the Verifier ($0.01) checks code quality.
- **x402 Nanopayments**: Sub-cent USDC payments settled via Circle Gateway. Users deposit USDC, then each AI query deducts from their balance.

Keep responses concise (2-4 sentences). Be friendly and actionable. If asked about something outside the platform, briefly answer but guide back to platform features.`;

async function handleChat(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history = [], modelTier = "free" } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (message.length > 500) {
    return res.status(400).json({ error: "Message too long (max 500 chars)" });
  }

  try {
    let reply;
    let aiPayment = null;
    let resultSource = "contextual";
    let status = "ok";
    const usePremiumModel = modelTier === "premium";

    if (!reply && FEATHERLESS_API_KEY) {
      try {
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, 300) })),
          { role: "user", content: message },
        ];

        const featherlessRes = await fetch(`${FEATHERLESS_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FEATHERLESS_API_KEY}` },
          body: JSON.stringify({ model: FEATHERLESS_MODEL, messages, max_tokens: 300 }),
        });

        if (featherlessRes.ok) {
          const data = await featherlessRes.json();
          reply = data.choices?.[0]?.message?.content || null;
          aiPayment = { provider: "featherless", model: FEATHERLESS_MODEL, status: "ok" };
          resultSource = "live_ai";
        }
      } catch (err) {
        console.warn("Featherless AI chat failed, trying Google Gemini:", err.message);
      }
    }

    if (!reply && GOOGLE_API_KEY) {
      try {
        const contents = [
          ...history.slice(-6).map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 300) }] })),
          { role: "user", parts: [{ text: message }] },
        ];

        const googleRes = await fetch(
          `${GOOGLE_BASE_URL}/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ system_instruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig: { maxOutputTokens: 300 } }),
          }
        );

        if (googleRes.ok) {
          const data = await googleRes.json();
          reply = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
          aiPayment = { provider: "google", model: GOOGLE_MODEL, status: "ok" };
          resultSource = "live_ai";
        }
      } catch (err) {
        console.warn("Google Gemini chat failed, trying AIsa:", err.message);
      }
    }

    if (!reply && isAisaConfigured()) {
      try {
        const aisaFetch = getAisaFetch();
        const msgs = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, 300) })),
          { role: "user", content: message },
        ];
        const aisaRes = await aisaFetch(`${AISA_BASE_URL}/perplexity/sonar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "sonar", messages: msgs, max_tokens: 300 }),
        });
        if (aisaRes.ok) {
          const data = await aisaRes.json();
          reply = data.choices?.[0]?.message?.content || null;
          aiPayment = { provider: "aisa-x402", model: "perplexity/sonar", status: "paid" };
          resultSource = "live_ai";
        }
      } catch (err) {
        console.warn("AIsa chat also failed, using contextual fallback:", err.message);
      }
    }

    if (!reply) {
      reply = getContextualReply(message);
      aiPayment = { provider: "contextual", model: usePremiumModel ? "premium-fallback" : "free-guide", status: usePremiumModel ? "fallback" : "free" };
      resultSource = usePremiumModel ? "fallback" : "free_guide";
      status = usePremiumModel ? "fallback" : "ok";
    }

    const cost = !usePremiumModel
      ? "free"
      : resultSource === "fallback" ? "0.005 USDC (fallback)" : "0.005 USDC";

    return res.status(200).json({
      agent: { type: "assistant", snsDomain: "pledgebond-scout.sol", displayName: "pledgebond-scout.sol", humanName: "Platform Assistant", icon: "🔭", description: "Platform helper assistant" },
      success: true,
      status,
      resultSource,
      nextAction: "Use one of the AI agent actions on the Back page when you're ready to analyze a project.",
      reply,
      agentInfo: { name: "pledgebond-scout.sol", humanName: "Platform Assistant", cost, txHash: req.nanopayment?.txHash, network: "arc", paymentStatus: req.nanopayment?.testMode ? "test_mode" : (req.nanopayment?.verificationStatus || "unverified"), ...(aiPayment && { aiPayment }) },
    });
  } catch (error) {
    console.error("Chat agent error:", error);
    return res.status(500).json({ error: "Assistant unavailable. Please try again.", status: "error" });
  }
}

function getContextualReply(message) {
  const lower = message.toLowerCase();
  if (lower.match(/hello|hi|hey|sup|what's up/)) return "Hey! 👋 I'm the PledgeBond assistant. I can help you explore projects, understand AI agents, or submit your own project. What would you like to do?";
  if (lower.match(/submit|add|create|new project/)) return "To submit a project, click **Submit Project** in the nav or go to /projects/new. You'll need a project name, description, GitHub URL, ecosystem, and category. Contract address is optional!";
  if (lower.match(/agent|underwrite|scout|verify|ai/)) return "We have 3 AI agents: **Underwriter** ($0.05) scores project health, **Scout** ($0.01) finds top projects across ecosystems, and **Verifier** ($0.01) checks code quality. Try them on the **Back** page → Economy tab!";
  if (lower.match(/x402|nanopay|payment|usdc|cost|price/)) return "x402 nanopayments let you pay small USDC amounts for AI analysis. Set up your payment wallet on the **Back** page to unlock agent flows.";
  if (lower.match(/explore|browse|find|search|project/)) return "Head to the **Explore** page to browse projects across 7 ecosystems. Use the search bar to filter by name or category. Click any project for details and AI analysis!";
  if (lower.match(/arc|circle|ecosystem/)) return "Arc is Circle's USDC-native EVM network for fast stablecoin settlement. We use it so small AI analysis payments can settle cleanly in USDC.";
  if (lower.match(/back|fund|invest|support/)) return "The **Back** page lets you discover and support projects. Use AI agents to analyze projects before backing them. Your payment balance is shown there when you set it up.";
  if (lower.match(/how|work|explain|what is/)) return "PledgeBond helps you explore projects, run AI analysis, and decide what to back. The core flow is: pick a project → run analysis → review the result → back with confidence.";
  return "I can help you explore projects, use AI agents, submit your own project, or understand AI analysis payments. What would you like to do next?";
}

async function handleUnderwrite(req, res) {
  // Sponsored first calls: a per-user free budget (default 3) lets new
  // backers read a real packet before setting up x402 payments. When the
  // budget is spent, the standard paid path runs unchanged.
  // Identity: verified Firebase ID token when present; otherwise the
  // caller is anonymous and gets a single IP-keyed sponsored call
  // (client-supplied uid headers are never trusted).
  const { consumeSponsoredCall } = await import("@/lib/agentSponsorship");
  let sponsorUid = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { auth } = await import("@/lib/firebase/serverOnly");
      const decoded = await auth.verifyIdToken(authHeader.slice(7));
      sponsorUid = decoded.uid;
    } catch {
      sponsorUid = null; // invalid token → anonymous budget path
    }
  }
  const sponsor = await consumeSponsoredCall({
    uid: sponsorUid,
    ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null,
  });
  if (sponsor) {
    req.nanopayment = {
      amount: 0.05,
      sponsored: true,
      txHash: null,
      network: "arc",
      verificationStatus: "sponsored",
      testMode: false,
    };
    return underwriteHandler(req, res);
  }
  const { withAgentAuth } = await import("@/lib/agentAuth");
  return withAgentAuth(withNanopayment(underwriteHandler, 0.05))(req, res);
}

async function underwriteHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { projectId, fresh } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query parameter is required" });

  try {
    const identity = getAgentIdentity('underwrite');
    if (fresh !== "1") {
      const cached = await getCachedResult("underwrite", { projectId });
      if (cached) {
        return res.status(200).json({ ...cached.data, status: "ok", resultSource: "cached", nextAction: "Review the health score and decide whether to back this project.", cached: true, cachedAt: cached.cachedAt, cachedAge: cached.ageHuman });
      }
    }

    const docRef = db.collection("projects").doc(projectId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: "Project not found", status: "error" });

    const project = { id: snapshot.id, ...snapshot.data() };

    let attestcoin = null;
    try {
      const attestcoinClient = getAttestcoinClient();
      const attestations = await attestcoinClient.getMilestoneAttestations(project.id, 0);
      attestcoin = { attestations, verified: attestations.some((a) => a.status === "verified") };
    } catch (attestErr) { console.warn("Attestcoin read skipped:", attestErr.message); }

    const { total, breakdown } = computeScore(project);
    const recommendation = getRecommendation(total);
    const { computeStrategicAdvice } = await import("@/lib/scoringEngine");
    const strategicAdvice = computeStrategicAdvice(project);

    let aiAnalysis = null;
    let aisaPayment = null;
    let resultSource = "rule_based";

    if (isAisaConfigured()) {
      try {
        const aisaFetch = getAisaFetch();
        const aisaRes = await aisaFetch(`${AISA_BASE_URL}/perplexity/sonar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: `Analyze this blockchain project for investment potential in 3 sentences. Project: ${project.name}. Ecosystem: ${project.ecosystem || 'unknown'}. Description: ${project.description || "N/A"}. GitHub stats: ${JSON.stringify(project.stats || {})}. Score: ${total}/100. Also provide a brief recommendation on whether they should launch a token on Solana via Bags or bridge their unpaid prize with the EVM liquidity rail, based on their GitHub activity.` }] }),
        });

        if (aisaRes.ok) {
          const data = await aisaRes.json();
          aiAnalysis = data.choices?.[0]?.message?.content || null;
          aisaPayment = { provider: "AIsa x402", model: "perplexity/sonar", estimatedCost: "~0.012 USDC", paymentHeader: aisaRes.headers.get("x-402-receipt"), paymentVerified: !!aisaRes.headers.get("x-402-receipt") };
          resultSource = "live_ai";
        }
      } catch (aisaErr) { console.error("AIsa enrichment error:", aisaErr.message); }
    }

    const result = { ...agentIdentityResponse('underwrite'), success: true, status: "ok", resultSource, nextAction: "Review the health score — a bridge loan still requires a declared win before it can be funded.", agentInfo: { name: identity.domain, humanName: identity.displayName, feePaid: req.nanopayment.amount, txHash: req.nanopayment.txHash, network: "arc", paymentStatus: req.nanopayment.testMode ? "test_mode" : (req.nanopayment.verificationStatus || "unverified"), aisaPayment }, project: { id: project.id, name: project.name }, healthScore: total, breakdown, recommendation, strategicAdvice, aiAnalysis, attestcoin, timestamp: new Date().toISOString() };

    try {
      await db.collection("agent_runs").doc(`underwrite_${Date.now()}`).set({
        type: "underwrite", timestamp: result.timestamp, projectId: project.id,
        project: { id: project.id, name: project.name, ecosystem: project.ecosystem },
        healthScore: total, breakdown, recommendation: recommendation || null, resultSource,
        reasoningTrace: aiAnalysis ? [{ project: project.name, trace: aiAnalysis }] : [{ project: project.name, trace: `Rule-based score: ${total}/100. ${strategicAdvice?.[0] || "Analyzed project health."}` }],
        strategicAdvice: strategicAdvice || null, ecosystemAnalysis: aiAnalysis || null,
      });
    } catch (logErr) { console.warn("Failed to log underwrite run:", logErr.message); }

    await setCachedResult("underwrite", { projectId }, result);

    if (result.attestcoin) {
      try {
        await db.collection("projects").doc(projectId).set(
          { attestcoin: result.attestcoin, attestedAt: result.timestamp },
          { merge: true }
        );
      } catch (attestWriteErr) { console.warn("Failed to write attestcoin to project:", attestWriteErr.message); }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Underwriter agent error:", error);
    return res.status(500).json({ error: "Underwriter agent failed", details: error.message, status: "error" });
  }
}

async function handleVerify(req, res) {
  const { withAgentAuth } = await import("@/lib/agentAuth");
  return withAgentAuth(withNanopayment(verifyHandler, 0.01))(req, res);
}

async function verifyHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { prId, lines = 100, fresh, network, projectPda, developerTokenAccount, milestoneIndex } = req.query;
  if (!prId) return res.status(400).json({ error: "prId query parameter is required" });

  try {
    const identity = getAgentIdentity('verify');
    if (fresh !== "1") {
      const cached = await getCachedResult("verify", { prId });
      if (cached) return res.status(200).json({ ...cached.data, status: cached.status || "ok", resultSource: cached.resultSource || "cached", nextAction: cached.nextAction || "Review the verification summary before releasing any milestone funds.", cached: true, cachedAt: cached.cachedAt, cachedAge: cached.ageHuman });
    }

    let verification;
    let aisaPayment = null;
    let resultSource = "fallback";
    let status = "fallback";

    if (isAisaConfigured()) {
      try {
        const aisaFetch = getAisaFetch();
        const aiResponse = await aisaFetch(`${AISA_BASE_URL}/perplexity/sonar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: `Analyze GitHub pull request #${prId}. Check code quality, test coverage, and security. Respond ONLY with JSON: {"approved": boolean, "confidence": number between 0 and 1, "summary": "one sentence", "issues": number}. Note: If this is a Solana/Rust project, evaluate Anchor framework usage and Rust safety. If EVM, evaluate Solidity security.` }] }),
        });

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (parsed && typeof parsed.approved === "boolean") {
          verification = { prId, linesAnalyzed: lines, approved: parsed.approved, confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)), summary: parsed.summary || "AI analysis complete.", issuesFound: parsed.issues || 0 };
          aisaPayment = { provider: "aisa-x402", model: "perplexity-sonar" };
          resultSource = "live_ai";
          status = "ok";
        }
      } catch (aisaErr) { console.warn("AIsa verification failed, returning explicit fallback state:", aisaErr.message); }
    }

    if (!verification) {
      verification = { prId, linesAnalyzed: lines, approved: null, confidence: 0, summary: "Automated verification is currently unavailable. No approval decision was made.", issuesFound: null };
    }

    let onChainContext = null;
    if (network === "solana" && projectPda) {
      // The legacy Solana credit-line program is retired; milestone
      // settlement lives on the EVM LiquidityRail. Read-only preview only.
      onChainContext = { projectPda, milestoneIndex: milestoneIndex || "0", network: "solana", note: "The legacy Solana credit-line program was retired with the liquidity-rail pivot. Milestone settlement now happens on the EVM rail. This is only a preview of what would be verified." };
    }

    let attestcoin = null;
    try {
      const attestcoinClient = getAttestcoinClient();
      const projectId = projectPda || prId;
      attestcoin = await attestcoinClient.attestMilestone(
        projectId,
        parseInt(milestoneIndex || "0", 10),
        { prId, approved: verification.approved, sourceChain: network || "unknown", confidence: verification.confidence }
      );
    } catch (attestErr) { console.warn("Attestcoin attestation skipped:", attestErr.message); }

    const result = { ...agentIdentityResponse('verify'), success: status === "ok", status, resultSource, nextAction: verification.approved === true ? "Review the verification summary before releasing any milestone funds." : "Review the verification summary and retry later if you need an automated approval decision.", agentInfo: { name: identity.domain, humanName: identity.displayName, feePaid: req.nanopayment.amount, txHash: req.nanopayment.txHash, network: network || "arc", paymentStatus: req.nanopayment.testMode ? "test_mode" : (req.nanopayment.verificationStatus || "unverified"), ...(aisaPayment && { aisaPayment }) }, verification, onChainContext, attestcoin, timestamp: new Date().toISOString() };

    await setCachedResult("verify", { prId }, result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Verification agent error:", error);
    return res.status(500).json({ error: "Verification agent failed", details: error.message, status: "error" });
  }
}

async function handleScout(req, res) {
  const { withAgentAuth } = await import("@/lib/agentAuth");
  return withAgentAuth(withNanopayment(scoutHandler, 0.01))(req, res);
}

async function scoutHandler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const identity = getAgentIdentity('scout');
    if (req.method === "GET" && req.query.fresh !== "1") {
      const cached = await getCachedResult("scout", { ecosystem: req.query.ecosystem || "all" });
      if (cached) return res.status(200).json({ ...cached.data, status: "ok", resultSource: "cached", nextAction: "Review the recommended projects and run deeper analysis on the best candidates.", cached: true, cachedAt: cached.cachedAt, cachedAge: cached.ageHuman });
    }

    const SCOUT_PAGE_LIMIT = 200;
    let projects = [];
    try {
      let query = db.collection("projects").orderBy("submittedAt", "desc").limit(SCOUT_PAGE_LIMIT);
      if (req.query.ecosystem && req.query.ecosystem !== "all") query = query.where("ecosystem", "==", req.query.ecosystem);
      const snapshot = await query.get();
      projects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      if (err.code === "failed-precondition" || err.message?.includes("index")) {
        try {
          const snapshot = await db.collection("projects").limit(SCOUT_PAGE_LIMIT).get();
          projects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (fallbackErr) {
          return res.status(500).json({ ...agentIdentityResponse('scout'), success: false, status: 'error', error: 'Failed to fetch projects', details: fallbackErr.message, projects: [], summary: { evaluated: 0, recommended: 0 } });
        }
      } else {
        return res.status(500).json({ ...agentIdentityResponse('scout'), success: false, status: 'error', error: 'Failed to fetch projects', details: err.message, projects: [], summary: { evaluated: 0, recommended: 0 } });
      }
    }

    let scored = [];
    try {
      scored = projects.map((project) => {
        try {
          const { total, breakdown } = computeScore(project);
          const recommendation = getRecommendation(total);
          return { id: project.id, name: project.name || project.slug || "Unnamed Project", ecosystem: project.ecosystem, slug: project.slug, score: total, breakdown, recommendation, flagged: total >= MIN_SCORE_TO_BACK };
        } catch (projectErr) { return null; }
      }).filter(Boolean).sort((a, b) => b.score - a.score);
    } catch (scoringErr) {
      return res.status(500).json({ ...agentIdentityResponse('scout'), success: false, status: 'error', error: 'Scoring engine failed', details: scoringErr.message });
    }

    const candidates = scored.filter((p) => p.flagged);

    let ecosystemAnalysis = null;
    let reasoningTrace = null;
    let aisaPayment = null;
    let resultSource = "rule_based";
    let runId = null;

    try {
      runId = `scout_${Date.now()}`;
      await db.collection("agent_runs").doc(runId).set({
        type: "scout", timestamp: new Date().toISOString(), projectsEvaluated: scored.length, projectsFlagged: candidates.length, reasoningTrace, ecosystemAnalysis, resultSource, results: candidates.map((p) => ({ id: p.id, name: p.name, score: p.score, priority: p.recommendation?.priority || null })),
      });
    } catch (logErr) { console.warn("Failed to log scout run to Firestore:", logErr.message); }

    if (isAisaConfigured()) {
      try {
        const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : 0;
        const topNames = candidates.slice(0, 3).map((p) => `${p.name} (${p.ecosystem || 'unknown'})`).join(", ");

        const prompt = `You are an analyst for a blockchain scouting platform. SCOUTED PROJECTS: ${scored.length} TOP FLAGGED CANDIDATES: ${topNames} AVERAGE ECOSYSTEM SCORE: ${avgScore}/100. For EACH of the top 3 flagged candidates, provide a 2-3 sentence reasoning trace explaining WHY the scout flagged it as a bridge-loan candidate for lenders. Break down by: GitHub velocity, project completeness, and community signals. Be specific — mention actual project names and what makes them stand out. Then summarize the overall funding landscape in 1 sentence. Respond in this exact JSON format: { "reasoningTraces": [{"project": "Name", "trace": "Detailed reasoning..."}], "ecosystemSummary": "One sentence landscape summary." }`;

        const aisaFetch = getAisaFetch();
        const aisaRes = await aisaFetch(`${AISA_BASE_URL}/perplexity/sonar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: prompt }] }),
        });
        const aisaData = await aisaRes.json();
        const aiContent = aisaData.choices?.[0]?.message?.content || null;

        if (aiContent) {
          try {
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              reasoningTrace = parsed.reasoningTraces || null;
              ecosystemAnalysis = parsed.ecosystemSummary || aiContent;
            } else { ecosystemAnalysis = aiContent; }
          } catch { ecosystemAnalysis = aiContent; }
        }

        aisaPayment = { provider: "aisa", model: "perplexity/sonar", status: "paid" };
        resultSource = "live_ai";
      } catch (err) { console.warn("AIsa ecosystem analysis failed (non-fatal):", err.message); }
    }

    if (!reasoningTrace && candidates.length > 0) {
      reasoningTrace = candidates.slice(0, 3).map((p) => ({ project: p.name, trace: `Scored ${p.score}/100. GitHub velocity: ${p.breakdown?.velocity || '?'}%, completeness: ${p.breakdown?.completeness || '?'}%, community: ${p.breakdown?.community || '?'}%. Flagged as ${p.recommendation?.label || 'watch'} — ${p.recommendation?.note || 'fund only against a declared win'}.` }));
    }

    const result = { ...agentIdentityResponse('scout'), success: true, status: "ok", resultSource, nextAction: "Review the flagged candidates and run deeper analysis on the best ones — funding still requires a declared on-chain win.", agentInfo: { name: identity.domain, humanName: identity.displayName, feePaid: req.nanopayment?.amount || 0, txHash: req.nanopayment?.txHash, network: "arc", paymentStatus: req.nanopayment?.testMode ? "test_mode" : (req.nanopayment?.verificationStatus || "unverified"), ...(aisaPayment && { aisaPayment }) }, runId, summary: { evaluated: scored.length, recommended: candidates.length }, reasoningTrace, ecosystemAnalysis, projects: scored };

    if (req.method === "GET") await setCachedResult("scout", { ecosystem: req.query.ecosystem || "all" }, result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Scout agent error:", error);
    return res.status(500).json({ error: "Scout agent failed", details: error.message, status: "error" });
  }
}

async function handleCopy(req, res) {
  const { withAgentAuth } = await import("@/lib/agentAuth");
  return withAgentAuth(copyHandler)(req, res);
}

async function copyHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, depositAmount } = req.body;
  const userId = req.user?.uid || req.body.userId;

  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const docRef = db.collection("copy_scout_subscriptions").doc(userId);

  try {
    if (action === "subscribe") {
      await docRef.set({ userId, subscribed: true, depositAmount: depositAmount || 0, subscribedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), totalBacked: 0, totalStaked: 0, status: "active" }, { merge: true });
      return res.status(200).json({ success: true, message: "Subscribed to Proof Scout copy-trading", subscribed: true });
    }

    if (action === "unsubscribe") {
      await docRef.set({ subscribed: false, unsubscribedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "inactive" }, { merge: true });
      return res.status(200).json({ success: true, message: "Unsubscribed from Proof Scout copy-trading", subscribed: false });
    }

    if (action === "status") {
      const doc = await docRef.get();
      if (!doc.exists) return res.status(200).json({ success: true, subscribed: false, depositAmount: 0 });
      const data = doc.data();
      return res.status(200).json({ success: true, subscribed: data.subscribed || false, depositAmount: data.depositAmount || 0, totalBacked: data.totalBacked || 0, totalStaked: data.totalStaked || 0, status: data.status || "inactive", subscribedAt: data.subscribedAt || null });
    }

    return res.status(400).json({ error: "Invalid action. Use subscribe, unsubscribe, or status." });
  } catch (err) {
    console.error("Copy Scout API error:", err.message);
    return res.status(500).json({ success: false, error: "Copy Scout operation failed", details: err.message });
  }
}
