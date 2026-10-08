/**
 * Leaderboard OG Image Generator — Edge function that renders dynamic
 * Open Graph images for shareable leaderboard entry cards.
 *
 * Usage:
 *   /api/og/leaderboard?type=proof-builder&rank=3&name=Alice&score=85&evidenceCoverage=90&verifiedWins=4&movement=up
 *   /api/og/leaderboard?type=project&rank=1&name=DeFi+Voyager&score=92&evidenceCoverage=88&ecosystem=base&movement=new
 *   /api/og/leaderboard?type=hackathon&rank=2&name=ETHGlobal+SF&avgPayoutDays=11&payoutRate=94&score=78&movement=up
 *   /api/og/leaderboard?type=builder&rank=5&name=Yasin&velocity=320&projectCount=8&movement=stable
 *   /api/og/leaderboard?type=backer&rank=1&name=Backer&totalBacked=125000&projectsBacked=12&movement=up
 *
 * Runs on Vercel Edge Runtime. Cached at CDN edge automatically.
 */

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const FONT_URL =
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff";
const FONT_BOLD_URL =
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff";

const COLORS = {
  indigo: "#4f46e5",
  purple: "#7c3aed",
  pink: "#db2777",
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray900: "#111827",
  emerald: "#059669",
  emeraldLight: "#d1fae5",
  red: "#dc2626",
  redLight: "#fee2e2",
  amber: "#d97706",
  amberLight: "#fef3c7",
  blue: "#2563eb",
  blueLight: "#dbeafe",
};

const ECOSYSTEM_LABELS = {
  celo: "Celo",
  arc: "Arc",
  base: "Base",
  linea: "Linea",
  arbitrum: "Arbitrum",
  ethereum: "Ethereum",
  optimism: "Optimism",
  solana: "Solana",
};

const ECOSYSTEM_COLORS = {
  celo: { bg: "#d1fae5", text: "#065f46" },
  arc: { bg: "#ccfbf1", text: "#0f766e" },
  base: { bg: "#dbeafe", text: "#1e40af" },
  linea: { bg: "#f3e8ff", text: "#6b21a8" },
  arbitrum: { bg: "#e0f2fe", text: "#075985" },
  ethereum: { bg: "#eef2ff", text: "#3730a3" },
  optimism: { bg: "#fef2f2", text: "#991b1b" },
  solana: { bg: "#d1fae5", text: "#065f46" },
};

const TYPE_CONFIG = {
  "proof-builder": {
    label: "Proof Builder",
    icon: "🏆",
    gradient: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)",
  },
  project: {
    label: "Proven Project",
    icon: "🔥",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)",
  },
  hackathon: {
    label: "Hackathon",
    icon: "⚡",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  },
  builder: {
    label: "Top Builder",
    icon: "🚀",
    gradient: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)",
  },
  backer: {
    label: "Top Backer",
    icon: "💰",
    gradient: "linear-gradient(135deg, #451a03 0%, #78350f 40%, #92400e 100%)",
  },
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "proof-builder";
    const rank = parseInt(searchParams.get("rank") || "0");
    const name = searchParams.get("name") || "Builder";
    const score = searchParams.get("score");
    const movement = searchParams.get("movement") || "";
    const evidenceCoverage = searchParams.get("evidenceCoverage");
    const verifiedWins = searchParams.get("verifiedWins");
    const ecosystem = searchParams.get("ecosystem");
    const avgPayoutDays = searchParams.get("avgPayoutDays");
    const payoutRate = searchParams.get("payoutRate");
    const velocity = searchParams.get("velocity");
    const projectCount = searchParams.get("projectCount");
    const totalBacked = searchParams.get("totalBacked");
    const projectsBacked = searchParams.get("projectsBacked");

    const config = TYPE_CONFIG[type] || TYPE_CONFIG["proof-builder"];
    const ecoColors = ECOSYSTEM_COLORS[ecosystem] || null;
    const ecoLabel = ECOSYSTEM_LABELS[ecosystem] || ecosystem || null;

    const [fontRegular, fontBold] = await Promise.all([
      fetch(FONT_URL).then((r) => r.arrayBuffer()),
      fetch(FONT_BOLD_URL).then((r) => r.arrayBuffer()),
    ]);

    // Rank display — giant numeral, Wrapped-style: the rank is the card.
    const rankDisplay = rank > 0 ? `#${rank}` : "";
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
    const rankLabel = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;

    // Movement indicator
    let movementEl = null;
    if (movement === "up") {
      movementEl = (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(5,150,105,0.2)", padding: "10px 22px", borderRadius: 24, border: "1px solid rgba(5,150,105,0.3)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 15l7-7 7 7" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>Moved Up</span>
        </div>
      );
    } else if (movement === "down") {
      movementEl = (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(220,38,38,0.15)", padding: "10px 22px", borderRadius: 24, border: "1px solid rgba(220,38,38,0.25)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 9l-7 7-7-7" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#f87171" }}>Moved Down</span>
        </div>
      );
    } else if (movement === "new") {
      movementEl = (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(37,99,235,0.2)", padding: "10px 22px", borderRadius: 24, border: "1px solid rgba(37,99,235,0.3)" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#60a5fa", letterSpacing: "1px" }}>NEW</span>
        </div>
      );
    }

    // Metrics rows based on type
    let metricsRow = null;
    if (type === "proof-builder") {
      metricsRow = (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {score && <StatBlockSmall label="Proof Score" value={score} color="#f59e0b" />}
          {evidenceCoverage && <StatBlockSmall label="Evidence" value={`${evidenceCoverage}%`} color="#059669" />}
          {verifiedWins && <StatBlockSmall label="Verified Wins" value={verifiedWins} color="#2563eb" />}
        </div>
      );
    } else if (type === "project") {
      metricsRow = (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {score && <StatBlockSmall label="Credibility" value={score} color="#f59e0b" />}
          {evidenceCoverage && <StatBlockSmall label="Evidence" value={`${evidenceCoverage}%`} color="#059669" />}
        </div>
      );
    } else if (type === "hackathon") {
      metricsRow = (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {avgPayoutDays && <StatBlockSmall label="Avg Payout" value={`${avgPayoutDays}d`} color="#059669" />}
          {payoutRate && <StatBlockSmall label="Paid" value={`${payoutRate}%`} color={parseInt(payoutRate) >= 80 ? "#059669" : "#d97706"} />}
          {score && <StatBlockSmall label="Reputation" value={score} color="#f59e0b" />}
        </div>
      );
    } else if (type === "builder") {
      metricsRow = (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {velocity && <StatBlockSmall label="Velocity" value={velocity} color="#06b6d4" />}
          {projectCount && <StatBlockSmall label="Projects" value={projectCount} color="#8b5cf6" />}
        </div>
      );
    } else if (type === "backer") {
      metricsRow = (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {totalBacked && <StatBlockSmall label="Total Backed" value={`$${formatCompact(parseInt(totalBacked))}`} color="#f59e0b" />}
          {projectsBacked && <StatBlockSmall label="Projects" value={projectsBacked} color="#8b5cf6" />}
          {score && <StatBlockSmall label="Score" value={score} color="#06b6d4" />}
        </div>
      );
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: config.gradient,
            fontFamily: '"Inter"',
            color: COLORS.white,
            padding: "48px 56px",
            position: "relative",
          }}
        >
          {/* Top bar: logo + type badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>⚓</span>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", opacity: 0.9 }}>
                PledgeBond
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                padding: "8px 18px",
                borderRadius: 24,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
            </div>
          </div>

          {/* Main card content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 40,
            }}
          >
            {/* Rank hero */}
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {rankDisplay ? (
                <span
                  style={{
                    fontSize: 120,
                    fontWeight: 800,
                    lineHeight: 0.85,
                    letterSpacing: "-6px",
                  }}
                >
                  {rankDisplay}
                </span>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {medal && <span style={{ fontSize: 40, lineHeight: 1 }}>{medal}</span>}
                {movementEl}
              </div>
            </div>

            {/* Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  letterSpacing: "-1.5px",
                  lineHeight: 1.1,
                  maxWidth: "80%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
              {ecoLabel && ecoColors && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 700,
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: ecoColors.bg,
                    color: ecoColors.text,
                  }}
                >
                  <span>{ecoLabel}</span>
                </div>
              )}
            </div>

            {/* Subtitle */}
            <span style={{ fontSize: 20, opacity: 0.75, marginTop: 4 }}>
              {rank > 0 ? `${rankLabel} in ${config.label}s` : `${config.label}s`}
              {ecoLabel ? ` · ${ecoLabel} Ecosystem` : ""}
            </span>

            {/* Metrics */}
            {metricsRow}
          </div>

          {/* Bottom decoration */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "35%",
              background:
                "radial-gradient(ellipse at 20% 100%, rgba(255,255,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(255,255,255,0.06) 0%, transparent 60%)",
            }}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: "Inter", data: fontRegular, weight: 400 },
          { name: "Inter", data: fontBold, weight: 700 },
        ],
      }
    );
  } catch (e) {
    console.error("Leaderboard OG image error:", e);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)",
            fontFamily: "sans-serif",
            color: "#ffffff",
            padding: 48,
          }}
        >
          <span style={{ fontSize: 64, marginBottom: 24 }}>⚓</span>
          <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-1px" }}>
            PledgeBond
          </span>
          <span style={{ fontSize: 22, opacity: 0.75, marginTop: 12 }}>
            Leaderboard — Build. Ship. Get Backed.
          </span>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}

function StatBlockSmall({ label, value, color }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 18px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <span style={{ fontSize: 28, fontWeight: 800, color: color || COLORS.white, letterSpacing: "-0.5px" }}>
        {value}
      </span>
      <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function formatCompact(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}
