/**
 * Ingest hackathons from Devpost's public API — cron-friendly endpoint
 *
 * GET /api/hackathons/ingest-devpost
 *
 * Devpost exposes its public hackathon index at
 * https://devpost.com/api/hackathons (no auth). We fetch the first pages
 * of the feed, normalize each event into the Firestore `hackathons`
 * shape, and upsert keyed on (source, sourceId) so daily runs stay
 * idempotent.
 *
 * Response: { fetched, created, updated, skipped, errors }
 */

import { db } from "../../../lib/firebase/serverOnly";

const FEED = "https://devpost.com/api/hackathons";
const PAGES = 4;
const PER_PAGE = 50;

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

/**
 * Parse one half loosely: { y?, m?, d } — fields may be missing.
 */
function parseHalfLoose(raw) {
  const m = String(raw).match(/([A-Za-z]+)?\s*(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (!m) return null;
  return {
    y: m[3] ? Number(m[3]) : undefined,
    m: m[1] ? MONTHS[m[1].slice(0, 3).toLowerCase()] : undefined,
    d: Number(m[2])
  };
}

/**
 * Devpost writes submission periods in three shapes:
 *   "Aug 31 - Oct 23, 2026"      — shared year
 *   "Oct 05 - 27, 2026"          — shared month + year
 *   "Jul 16, 2026 - Jan 15, 2027" — cross-year, both qualified
 * Returns { startDate, endDate } ISO strings, or null.
 */
function parseSubmissionPeriod(raw) {
  if (!raw || typeof raw !== "string") return null;
  const halves = raw.split(/\s+-\s+/);
  if (halves.length !== 2) return null;
  const a = parseHalfLoose(halves[0]);
  const b = parseHalfLoose(halves[1]);
  if (!a || !b) return null;
  // Fill missing fields from the other half: each half keeps its own
  // year when present (cross-year ranges), else borrows the other's.
  const sy = a.y ?? b.y;
  const ey = b.y ?? a.y;
  const em = b.m ?? a.m;
  const sm = a.m;
  if (sy == null || ey == null || em == null || sm == null) return null;
  const start = { y: sy, m: sm, d: a.d };
  const end = { y: ey, m: em, d: b.d };
  const s = new Date(Date.UTC(start.y, start.m, start.d));
  const e = new Date(Date.UTC(end.y, end.m, end.d));
  if (s.getTime() > e.getTime()) return null;
  return { startDate: s.toISOString(), endDate: e.toISOString() };
}

/**
 * "$<span data-currency-value>138,000</span>" -> 138000
 */
function parsePrizeAmount(raw) {
  if (!raw) return 0;
  const digits = String(raw).replace(/<[^>]*>/g, "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function toStatus(item, endDate) {
  if (item.winners_announced === true) return "completed";
  if (item.open_state === "open") {
    if (endDate && new Date(endDate).getTime() < Date.now()) return "completed";
    return "active";
  }
  return "upcoming";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV === "production") {
    return res.status(503).json({ error: "Cron authentication is not configured" });
  }
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  let fetched = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  try {
    const items = [];
    for (let page = 1; page <= PAGES; page += 1) {
      const r = await fetch(`${FEED}?per_page=${PER_PAGE}&page=${page}`, {
        headers: { Accept: "application/json" }
      });
      if (!r.ok) {
        errors.push(`feed page ${page}: HTTP ${r.status}`);
        break;
      }
      const data = await r.json();
      const batch = Array.isArray(data?.hackathons) ? data.hackathons : [];
      items.push(...batch);
      fetched += batch.length;
      if (batch.length < PER_PAGE) break;
    }

    for (const item of items) {
      try {
        const dates = parseSubmissionPeriod(item.submission_period_dates);
        if (!item.id || !item.title || !dates) {
          skipped += 1;
          continue;
        }

        const doc = {
          name: String(item.title).trim(),
          ecosystem: "general",
          organizerName: item.organization_name || "",
          startDate: dates.startDate,
          endDate: dates.endDate,
          prizePool: parsePrizeAmount(item.prize_amount),
          sponsors: item.organization_name ? [String(item.organization_name)] : [],
          tracks: Array.isArray(item.themes) ? item.themes.map((t) => t?.name).filter(Boolean) : [],
          status: toStatus(item, dates.endDate),
          source: "devpost",
          sourceId: String(item.id),
          sourceUrl: item.url || "",
          registrationCount: Number(item.registrations_count) || 0,
          winnersAnnounced: Boolean(item.winners_announced),
          verificationContract: "",
          updatedAt: new Date().toISOString()
        };

        const existing = await db
          .collection("hackathons")
          .where("source", "==", "devpost")
          .where("sourceId", "==", doc.sourceId)
          .limit(1)
          .get();

        if (existing.empty) {
          await db.collection("hackathons").add({ ...doc, createdAt: doc.updatedAt });
          created += 1;
        } else {
          await existing.docs[0].ref.update(doc);
          updated += 1;
        }
      } catch (e) {
        errors.push(`item ${item?.id}: ${e.message}`);
      }
    }

    return res.status(200).json({ success: true, fetched, created, updated, skipped, errors });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Internal server error", details: error.message });
  }
}

export { parseSubmissionPeriod, parsePrizeAmount };
