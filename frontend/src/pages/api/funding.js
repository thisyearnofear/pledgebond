import { usdcPaymentService } from '../../lib/usdcPayments';
import { realCircleService } from '../../services/RealCircleService';

import { withApiMiddleware, isAdmin } from '../../utils/apiMiddleware';
import { db } from '@/lib/firebase/serverOnly';
import { logActivity } from '../../utils/activityLogger';
import { socialSharingService } from '../../services/SocialSharingService';

async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, ...data } = req.body;

    // For admin actions, authenticate and check admin status
    const adminActions = new Set(['approveTesterReward']);
    let userId = null;
    if (adminActions.has(action)) {
      const { uid, isAdmin: admin } = await isAdmin(req, (await import('@/lib/firebase/serverOnly')).auth, db);
      if (!admin) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      userId = uid;
    }

    switch (action) {
      case 'createWallet':
        const wallet = await usdcPaymentService.createWallet(data.userId);
        return res.status(200).json({ success: true, wallet });

      case 'getBalance':
        const balance = await usdcPaymentService.getWalletBalance(data.walletId);
        return res.status(200).json({ success: true, balance });

      case 'getFundingHistory':
        const history = await usdcPaymentService.getFundingHistory(data.developerAddress);
        return res.status(200).json({ success: true, history });

      case 'checkConfiguration':
        const isConfigured = usdcPaymentService.isConfigured();
        const environment = usdcPaymentService.getEnvironment();
        
        return res.status(200).json({ 
          success: true, 
          configured: isConfigured,
          environment,
          message: isConfigured 
            ? `Circle API configured for ${environment} environment`
            : 'Circle API not configured'
        });

      case 'getTransferStatus':
        const status = await usdcPaymentService.getTransferStatus(data.transferId);
        return res.status(200).json({ success: true, status });

      case 'approveTesterReward': {
        const { feedbackId, projectSlug, taskId, sourceWalletId, destinationAddress, amount } = data;
        if (!feedbackId || !projectSlug || !taskId || !destinationAddress) {
          return res.status(400).json({ error: 'Missing required fields for approveTesterReward' });
        }
        // The source wallet is never taken from the request body: an admin
        // approving a reward must not be able to spend an arbitrary wallet,
        // and the reward must always come from the payout wallet.
        const payoutWalletId = process.env.CIRCLE_PAYOUT_WALLET_ID;
        if (!payoutWalletId) {
          return res.status(500).json({ error: 'Payout wallet not configured' });
        }
        if (sourceWalletId && sourceWalletId !== payoutWalletId) {
          return res.status(400).json({ error: 'Invalid source wallet for tester reward' });
        }
        if (!realCircleService.isServerControlledWallet(payoutWalletId)) {
          return res.status(500).json({ error: 'Payout wallet is not server-controlled' });
        }
        // Validate feedback exists and matches project/task
        const fbSnap = await db.collection('feedback').doc(feedbackId).get();
        if (!fbSnap.exists) {
          return res.status(404).json({ error: 'Feedback not found' });
        }
        const fb = fbSnap.data();
        if (fb.projectSlug !== projectSlug || fb.taskId !== taskId) {
          return res.status(400).json({ error: 'Feedback does not match project/task' });
        }
        // Validate task exists and get reward default
        const projSnap = await db.collection('projects').doc(projectSlug).get();
        if (!projSnap.exists) {
          return res.status(404).json({ error: 'Project not found' });
        }
        const proj = projSnap.data();
        const task = (proj.testerTasks || []).find(t => t.id === taskId);
        if (!task) {
          return res.status(400).json({ error: 'Invalid task for project' });
        }
        const payoutAmount = typeof amount === 'number' && amount > 0 ? amount : Number(task.rewardUSDC || 0);
        if (!payoutAmount || payoutAmount <= 0) {
          return res.status(400).json({ error: 'Invalid payout amount' });
        }
        // Optional budget check/deduct if project has budgetRemainingUSDC
        if (typeof proj.budgetRemainingUSDC === 'number') {
          if (payoutAmount > proj.budgetRemainingUSDC) {
            return res.status(400).json({ error: 'Insufficient project budget' });
          }
        }

        // Transfer
        const transfer = await usdcPaymentService.transferUSDCWithReason(
          payoutWalletId,
          destinationAddress,
          payoutAmount,
          `tester_reward:${projectSlug}:${taskId}:${feedbackId}`,
          { testerId: destinationAddress, projectSlug }
        );

        // Deduct budget
        if (typeof proj.budgetRemainingUSDC === 'number') {
          await db.collection('projects').doc(projectSlug).set({ budgetRemainingUSDC: proj.budgetRemainingUSDC - payoutAmount }, { merge: true });
        }

        // Mark feedback as accepted
        await db.collection('feedback').doc(feedbackId).set({ status: 'accepted', acceptedAt: new Date().toISOString(), approvedBy: userId }, { merge: true });

        // Log to engagement feed
        await logActivity({
          type: "milestone_verified",
          projectSlug: projectSlug,
          projectName: proj.name,
          userHandle: destinationAddress,
          description: `Tester was rewarded ${payoutAmount} USDC for completing a task on ${proj.name}!`,
          amount: payoutAmount,
          ecosystem: proj.ecosystem
        });

        // Trigger viral celebration snap
        await socialSharingService.shareCelebration('payout', proj, { amount: payoutAmount });

        return res.status(200).json({ success: true, transfer });
      }

      case 'bulkApproveTesterRewards': {
        const { items, sourceWalletId } = data;
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'Missing items' });
        }
        const results = [];
        for (const it of items) {
          try {
            const { feedbackId, projectSlug, taskId, destinationAddress, amount } = it;
            if (!feedbackId || !projectSlug || !taskId || !sourceWalletId || !destinationAddress) {
              results.push({ feedbackId, ok: false, error: 'Missing required fields' });
              continue;
            }
            const fbSnap = await db.collection('feedback').doc(feedbackId).get();
            if (!fbSnap.exists) { results.push({ feedbackId, ok: false, error: 'Feedback not found' }); continue; }
            const fb = fbSnap.data();
            if (fb.projectSlug !== projectSlug || fb.taskId !== taskId) { results.push({ feedbackId, ok: false, error: 'Feedback does not match project/task' }); continue; }
            const projSnap = await db.collection('projects').doc(projectSlug).get();
            if (!projSnap.exists) { results.push({ feedbackId, ok: false, error: 'Project not found' }); continue; }
            const proj = projSnap.data();
            const task = (proj.testerTasks || []).find(t => t.id === taskId);
            if (!task) { results.push({ feedbackId, ok: false, error: 'Invalid task for project' }); continue; }
            const payoutAmount = typeof amount === 'number' && amount > 0 ? amount : Number(task.rewardUSDC || 0);
            if (!payoutAmount || payoutAmount <= 0) { results.push({ feedbackId, ok: false, error: 'Invalid payout amount' }); continue; }
            if (typeof proj.budgetRemainingUSDC === 'number' && payoutAmount > proj.budgetRemainingUSDC) {
              results.push({ feedbackId, ok: false, error: 'Insufficient project budget' });
              continue;
            }
            const transfer = await usdcPaymentService.transferUSDCWithReason(sourceWalletId, destinationAddress, payoutAmount, `tester_reward:${projectSlug}:${taskId}:${feedbackId}`);
            if (typeof proj.budgetRemainingUSDC === 'number') {
              await db.collection('projects').doc(projectSlug).set({ budgetRemainingUSDC: proj.budgetRemainingUSDC - payoutAmount }, { merge: true });
            }
            await db.collection('feedback').doc(feedbackId).set({ status: 'accepted', acceptedAt: new Date().toISOString(), approvedBy: userId }, { merge: true });
            results.push({ feedbackId, ok: true, transfer });
          } catch (e) {
            results.push({ feedbackId: it?.feedbackId, ok: false, error: e?.message || 'Error' });
          }
        }
        return res.status(200).json({ success: true, results });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Funding API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
