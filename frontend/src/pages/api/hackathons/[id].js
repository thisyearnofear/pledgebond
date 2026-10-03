import { db } from "../../../lib/firebase/serverOnly";

const ECOSYSTEM_COLLECTIONS = ['projects'];

export default async function handler(req, res) {
  const { id, sub } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid hackathon ID' });
  }

  if (sub === "participants") {
    return handleParticipants(req, res, id);
  }

  if (sub === "payout-timeline") {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    return handlePayoutTimeline(req, res, id);
  }

  switch (req.method) {
    case 'GET':
      return handleGetHackathon(req, res, id);
    case 'PUT':
      return handleUpdateHackathon(req, res, id);
    case 'DELETE':
      return handleDeleteHackathon(req, res, id);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetHackathon(req, res, id) {
  try {
    const hackathonRef = db.collection('hackathons').doc(id);
    const hackathonDoc = await hackathonRef.get();

    if (!hackathonDoc.exists) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const hackathonData = hackathonDoc.data();

    const participantsSnapshot = await hackathonRef
      .collection('participants')
      .get();

    const participants = participantsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({
      success: true,
      data: {
        id: hackathonDoc.id,
        ...hackathonData,
        participants: participants
      }
    });

  } catch (error) {
    console.error(`Error fetching hackathon ${id}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function handleUpdateHackathon(req, res, id) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    const hackathonRef = db.collection('hackathons').doc(id);
    const hackathonDoc = await hackathonRef.get();

    if (!hackathonDoc.exists) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    const allowedFields = [
      'name', 'ecosystem', 'startDate', 'endDate', 'prizePool',
      'sponsors', 'tracks', 'verificationContract', 'status'
    ];

    const sanitizedData = Object.fromEntries(
      Object.entries(updateData).filter(([key]) =>
        allowedFields.includes(key)
      )
    );

    await hackathonRef.update(sanitizedData);

    const updatedDoc = await hackathonRef.get();

    res.status(200).json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    console.error(`Error updating hackathon ${id}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function handleDeleteHackathon(req, res, id) {
  try {
    const hackathonRef = db.collection('hackathons').doc(id);
    const hackathonDoc = await hackathonRef.get();

    if (!hackathonDoc.exists) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    await hackathonRef.delete();

    res.status(200).json({
      success: true,
      message: 'Hackathon deleted successfully'
    });

  } catch (error) {
    console.error(`Error deleting hackathon ${id}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function handleParticipants(req, res, hackathonId) {
  const hackathonRef = db.collection('hackathons').doc(hackathonId);

  switch (req.method) {
    case 'GET':
      return handleGetParticipants(req, res, hackathonRef, hackathonId);
    case 'POST':
      return handleAddParticipant(req, res, hackathonRef, hackathonId);
    case 'PUT':
      return handleUpdateParticipant(req, res, hackathonRef, hackathonId);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetParticipants(req, res, hackathonRef, hackathonId) {
  try {
    const { status } = req.query;
    const participantsRef = hackathonRef.collection('participants');

    let query = participantsRef.orderBy('participationStatus', 'desc');

    if (status) {
      query = query.where('participationStatus', '==', status);
    }

    const snapshot = await query.get();

    const participants = await Promise.all(snapshot.docs.map(async doc => {
      const participantData = doc.data();
      const userRef = db.collection('users').doc(participantData.userId);
      const userDoc = await userRef.get();

      return {
        id: doc.id,
        ...participantData,
        user: userDoc.exists ? userDoc.data() : null
      };
    }));

    res.status(200).json({
      success: true,
      data: participants,
      count: participants.length
    });

  } catch (error) {
    console.error(`Error fetching participants for hackathon ${hackathonId}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function handleAddParticipant(req, res, hackathonRef, hackathonId) {
  try {
    const { userId, projectId } = req.body;

    if (!userId || !projectId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'projectId']
      });
    }

    const hackathonDoc = await hackathonRef.get();

    if (!hackathonDoc.exists) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const participantData = {
      userId: String(userId).trim(),
      projectId: String(projectId).trim(),
      participationStatus: req.body.participationStatus || 'participant',
      prizeAmount: req.body.prizeAmount ? Number(req.body.prizeAmount) : 0,
      prizeCategory: req.body.prizeCategory ? String(req.body.prizeCategory).trim() : '',
      verificationProof: req.body.verificationProof ? String(req.body.verificationProof).trim() : '',
      verified: !!req.body.verificationProof,
      verifiedAt: req.body.verificationProof ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const participantsRef = hackathonRef.collection('participants');
    const participantRef = await participantsRef.add(participantData);

    res.status(201).json({
      success: true,
      data: {
        id: participantRef.id,
        ...participantData
      }
    });

  } catch (error) {
    console.error(`Error adding participant to hackathon ${hackathonId}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function handleUpdateParticipant(req, res, hackathonRef, hackathonId) {
  try {
    const { userId, participationStatus } = req.body;

    if (!userId || !participationStatus) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'participationStatus']
      });
    }

    const participantsRef = hackathonRef.collection('participants');

    const querySnapshot = await participantsRef
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const participantDoc = querySnapshot.docs[0];

    const updateData = {
      participationStatus: String(participationStatus).trim(),
      prizeAmount: req.body.prizeAmount ? Number(req.body.prizeAmount) : 0,
      prizeCategory: req.body.prizeCategory ? String(req.body.prizeCategory).trim() : '',
      updatedAt: new Date().toISOString()
    };

    if (req.body.verificationProof) {
      updateData.verificationProof = String(req.body.verificationProof).trim();
      updateData.verified = true;
      updateData.verifiedAt = new Date().toISOString();
    }

    await participantDoc.ref.update(updateData);

    const updatedDoc = await participantDoc.ref.get();

    res.status(200).json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    console.error(`Error updating participant in hackathon ${hackathonId}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function handlePayoutTimeline(req, res, hackathonId) {
  try {
    const hackathonDoc = await db.collection('hackathons').doc(hackathonId).get();

    if (!hackathonDoc.exists) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const hackathonData = hackathonDoc.data();
    const hackathonName = hackathonData.name;

    const claims = [];

    for (const collection of ECOSYSTEM_COLLECTIONS) {
      const snapshot = await db.collection(collection)
        .where('hackathons', '!=', null)
        .select('name', 'slug', 'title', 'hackathons', 'owners')
        .get();

      snapshot.forEach(doc => {
        const project = doc.data();
        const projectHackathons = Array.isArray(project.hackathons) ? project.hackathons : [];

        projectHackathons.forEach(claim => {
          if (!claim.name) return;

          if (claim.name.trim().toLowerCase() !== hackathonName.trim().toLowerCase()) return;

          if (claim.outcome !== 'winner' && claim.outcome !== 'finalist') return;

          claims.push({
            projectSlug: project.slug || doc.id,
            projectName: project.title || project.name || doc.id,
            winnerAddress: claim.winnerAddress || null,
            prizeAmount: claim.payoutAmount || claim.prizeAmount || 0,
            claimOutcome: claim.outcome,
            hackathonEndDate: claim.hackathonEndDate || null,
            payoutAt: claim.payoutAt || null,
            payoutVerifiedAt: claim.payoutVerifiedAt || null,
            payoutTxHash: claim.payoutTxHash || null,
            payoutActualAmount: claim.payoutActualAmount || null,
            payoutConfidence: claim.payoutConfidence || null,
            payoutAttestationId: claim.payoutAttestationId || null,
          });
        });
      });
    }

    const attestationIds = claims
      .map(c => c.payoutAttestationId)
      .filter(Boolean);

    if (attestationIds.length > 0) {
      const attestationSnapshot = await db.collection('payoutAttestations')
        .where('__name__', 'in', attestationIds)
        .get();

      const attestationMap = {};
      attestationSnapshot.forEach(doc => {
        attestationMap[doc.id] = doc.data();
      });

      claims.forEach(claim => {
        if (claim.payoutAttestationId && attestationMap[claim.payoutAttestationId]) {
          const att = attestationMap[claim.payoutAttestationId];
          claim.attestation = att;
        }
      });
    }

    const timeline = claims.map(claim => {
      const paidAt = claim.payoutVerifiedAt || claim.payoutAt || null;
      // Latency is measured from when the win was declared, matching the
      // on-chain declaredAt → paidAt anchor in HackathonRegistry.
      // hackathonEndDate is only a fallback for claims that predate
      // winDeclaredAt — it overstates latency, so new claims must set the field.
      const declaredAt = claim.winDeclaredAt || claim.hackathonEndDate || null;
      let payoutLatencyDays = null;

      if (declaredAt && paidAt) {
        const diffMs = new Date(paidAt).getTime() - new Date(declaredAt).getTime();
        if (diffMs >= 0) {
          payoutLatencyDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        }
      }

      const verified = claim.attestation?.verification?.verified === true
        || claim.payoutConfidence >= 90;

      const confidence = claim.attestation?.verification?.confidence
        || (claim.payoutConfidence >= 90 ? 'high' : claim.payoutConfidence >= 50 ? 'medium' : 'low');

      return {
        projectSlug: claim.projectSlug,
        projectName: claim.projectName,
        winnerAddress: claim.winnerAddress,
        prizeAmount: claim.prizeAmount,
        claimOutcome: claim.claimOutcome,
        declaredAt,
        paidAt,
        payoutLatencyDays,
        verified,
        confidence,
        payoutTxHash: claim.payoutTxHash || claim.attestation?.verification?.payoutTxHash || null,
        attestationId: claim.payoutAttestationId || null,
      };
    });

    timeline.sort((a, b) => {
      if (a.paidAt && !b.paidAt) return -1;
      if (!a.paidAt && b.paidAt) return 1;
      if (a.payoutLatencyDays !== null && b.payoutLatencyDays !== null) {
        return a.payoutLatencyDays - b.payoutLatencyDays;
      }
      return 0;
    });

    const totalWinners = timeline.length;
    const paidWinners = timeline.filter(t => t.paidAt !== null).length;
    const totalPrizeAmount = timeline.reduce((sum, t) => sum + t.prizeAmount, 0);

    const latencies = timeline
      .filter(t => t.payoutLatencyDays !== null)
      .map(t => t.payoutLatencyDays);

    const avgPayoutDays = latencies.length > 0
      ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10
      : null;

    const payoutCompletionRate = totalWinners > 0
      ? Math.round((paidWinners / totalWinners) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        hackathonName,
        totalWinners,
        paidWinners,
        totalPrizeAmount,
        avgPayoutDays,
        payoutCompletionRate,
        latencyBasis: 'winDeclaredAt',
        timeline,
      },
    });

  } catch (error) {
    console.error(`Error fetching payout timeline for hackathon ${hackathonId}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}
