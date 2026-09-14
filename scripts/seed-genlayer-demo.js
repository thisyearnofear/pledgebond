/**
 * Seed GenLayer demo project
 *
 * Creates/updates a Firestore project with a hackathon claim carrying a
 * public evidence URL, so the GenLayer jury demo resolves end-to-end.
 *
 * Usage: node scripts/seed-genlayer-demo.js [--confirm]
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
const dryRun = !process.argv.includes("--confirm");

const DEMO = {
  slug: "genlayer-milestone-jury-demo",
  name: "Milestone Jury Demo",
  description:
    "PledgeBond milestone resolved by a GenLayer Intelligent Contract jury — validators fetch the evidence and reach consensus, no oracle.",
  ecosystem: "ethereum",
  githubUrl: "https://github.com/thisyearnofear/pledgebond",
  website: "https://pledgebond.vercel.app",
  status: "active",
  verificationStatus: "self_attested",
  hackathons: [
    {
      name: "GenLayer Agent Tank",
      outcome: "finalist",
      track: "Future of Work",
      url: "https://portal.genlayer.foundation/agent-tank/hackathon/",
      evidenceUrl: "https://github.com/thisyearnofear/pledgebond/pulls?q=is%3Apr+is%3Amerged",
      verificationStatus: "pending",
      payoutAt: null,
    },
  ],
  milestones: [
    { title: "Milestone escrow UI", description: "Merged PR with escrow release path", status: "completed" },
  ],
  updatedAt: new Date().toISOString(),
};

async function main() {
  console.log(dryRun ? "[dry-run] would write:" : "[live] writing demo project…");
  console.log(JSON.stringify(DEMO, null, 2));
  if (dryRun) {
    console.log('\nRun with --confirm to write to Firestore.');
    return;
  }
  await db.collection("projects").doc(DEMO.slug).set(DEMO, { merge: true });
  console.log(`Wrote projects/${DEMO.slug}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
