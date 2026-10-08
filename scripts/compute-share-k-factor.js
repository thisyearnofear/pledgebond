/**
 * Compute Share K-Factor
 *
 * The virality worksheet for leaderboard shares (Nikita Bier playbook):
 *
 *   K = (invites sent per user) × (invite → signup conversion)
 *   K > 1 means the loop compounds on its own.
 *
 * Data sources (Firestore):
 *   funnelEvents  — funnel="share", step="clicked" | "landing"
 *                   funnelId = sharer's referral code, variant = copy index
 *   referrals     — docs with source="leaderboard_share" carry shareCode,
 *                   shareVariant, shareRef captured at signup
 *
 * Usage: node scripts/compute-share-k-factor.js [--days=N]   (default: all time)
 *
 * Read-only — no writes, no --confirm needed.
 */

require("dotenv").config({ path: ".env.local" });

const admin = require("firebase-admin");

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const daysArg = process.argv.find((a) => a.startsWith("--days="));
const days = daysArg ? parseInt(daysArg.split("=")[1], 10) : null;
const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null;

const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
const num = (n) => (Number.isFinite(n) ? n.toFixed(3) : "—");

async function main() {
  let query = db.collection("funnelEvents").where("funnel", "==", "share");
  if (cutoff) query = query.where("serverTimestamp", ">=", cutoff);

  const [eventsSnap, referralsSnap] = await Promise.all([
    query.get(),
    db.collection("referrals").where("source", "==", "leaderboard_share").get(),
  ]);

  const clicked = [];
  const landed = [];
  for (const docSnap of eventsSnap.docs) {
    const d = docSnap.data();
    if (cutoff && (!d.serverTimestamp || d.serverTimestamp < cutoff)) continue;
    if (d.step === "clicked") clicked.push(d);
    else if (d.step === "landing") landed.push(d);
  }

  const signups = referralsSnap.docs
    .map((d) => d.data())
    .filter((r) => !cutoff || (r.referredAt && r.referredAt >= cutoff));

  const uniqueSharers = new Set(clicked.map((e) => e.funnelId).filter((f) => f && f !== "anon"));
  const invitesPerSharer = uniqueSharers.size > 0 ? clicked.length / uniqueSharers.size : 0;
  const conversion = landed.length > 0 ? signups.length / landed.length : 0;
  const kFactor = invitesPerSharer * conversion;

  console.log(`\nShare K-factor worksheet${days ? ` (last ${days} days)` : ""}\n${"─".repeat(46)}`);
  console.log(`Shares clicked (invites sent)   ${clicked.length}`);
  console.log(`Unique sharers                  ${uniqueSharers.size}`);
  console.log(`Invites per sharer              ${num(invitesPerSharer)}`);
  console.log(`Landings from shared links      ${landed.length}`);
  console.log(`Share → landing rate            ${pct(landed.length, clicked.length)}`);
  console.log(`Attributed signups              ${signups.length}`);
  console.log(`Landing → signup conversion     ${pct(signups.length, landed.length)}`);
  console.log(`${"─".repeat(46)}`);
  console.log(`K-factor                        ${num(kFactor)} ${kFactor > 1 ? "(compounds)" : kFactor > 0 ? "(sub-1: needs push)" : ""}\n`);

  // Per-variant breakdown — this is what the 48h copy test is scored on.
  const variants = new Map();
  const bucket = (m, key) => {
    if (!m.has(key)) m.set(key, { clicked: 0, landed: 0, signups: 0 });
    return m.get(key);
  };
  for (const e of clicked) bucket(variants, e.variant ?? "none").clicked++;
  for (const e of landed) bucket(variants, e.variant ?? "none").landed++;
  for (const r of signups) bucket(variants, r.shareVariant ?? "none").signups++;

  if (variants.size > 0) {
    console.log("Per-variant:");
    console.log(`${"variant".padEnd(10)}${"clicked".padStart(9)}${"landed".padStart(9)}${"signups".padStart(9)}${"conv".padStart(8)}`);
    for (const [v, s] of [...variants.entries()].sort()) {
      console.log(`${String(v).padEnd(10)}${String(s.clicked).padStart(9)}${String(s.landed).padStart(9)}${String(s.signups).padStart(9)}${pct(s.signups, s.landed).padStart(8)}`);
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
