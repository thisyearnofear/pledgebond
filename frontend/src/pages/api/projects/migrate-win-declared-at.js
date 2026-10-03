/**
 * Backfill `winDeclaredAt` on existing hackathon claims.
 *
 * Latency used to be measured from `hackathonEndDate`, which conflates a
 * hackathon running long with an organizer paying late. New claims set
 * `winDeclaredAt` at intake; this backfills older rows so historical latency
 * doesn't silently jump when the basis changes.
 *
 * Migration rule: `winDeclaredAt = hackathonEndDate` where absent. That is the
 * most conservative choice — it leaves every existing number exactly where it
 * was, rather than inventing a date that would move published metrics.
 *
 * Idempotent: claims that already have the field are skipped.
 *
 * GET /api/projects/migrate-win-declared-at
 */

import { db } from '@/lib/firebase/serverOnly';

const BATCH_SIZE = 400;

/**
 * @returns {{ scanned: number, backfilled: number, skipped: number, failed: number }}
 */
export async function backfillWinDeclaredAt({ limit = 5000 } = {}) {
  let scanned = 0;
  let backfilled = 0;
  let skipped = 0;
  let failed = 0;

  try {
    let cursor = null;

    do {
      let q = db.collection('projects').limit(BATCH_SIZE);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      let pending = 0;

      for (const doc of snap.docs) {
        scanned++;
        const data = doc.data();
        const claims = Array.isArray(data.hackathons) ? data.hackathons : [];
        if (claims.length === 0) continue;

        let changed = false;
        const next = claims.map((claim) => {
          if (!claim || typeof claim !== 'object') return claim;
          if (claim.winDeclaredAt) return claim;
          const fallback = claim.hackathonEndDate || claim.submittedAt || null;
          if (!fallback) return claim;
          changed = true;
          return { ...claim, winDeclaredAt: fallback, winDeclaredAtMigrated: true };
        });

        if (!changed) {
          skipped++;
          continue;
        }

        batch.update(doc.ref, { hackathons: next });
        pending++;
      }

      if (pending > 0) {
        await batch.commit();
        backfilled += pending;
      }

      cursor = snap.docs[snap.docs.length - 1];
      if (scanned >= limit) break;
    } while (cursor);

    return { scanned, backfilled, skipped, failed };
  } catch (error) {
    console.error('[migrate-win-declared-at] failed:', error);
    return { scanned, backfilled, skipped, failed: failed + 1 };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await backfillWinDeclaredAt();
  return res.status(200).json({
    success: result.failed === 0,
    data: {
      ...result,
      note:
        'winDeclaredAt backfilled from hackathonEndDate. Existing latency numbers are unchanged; new claims measure from first evidence.',
    },
  });
}