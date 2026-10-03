import { realCircleService } from "../../../services/RealCircleService";
import { withApiMiddleware, validateRequiredFields, parseQueryParams } from "../../../utils/apiMiddleware";
import { serviceRegistry } from "../../../services/ServiceRegistry";
import { ApiResponse } from "../../../utils/apiResponse";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns { uid } on success, or null on failure.
 * Used to gate money-movement endpoints (wallet creation, transaction creation, transfers).
 */
async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const { auth } = await import('@/lib/firebase/serverOnly');
    const decodedToken = await auth.verifyIdToken(idToken);
    return { uid: decodedToken.uid };
  } catch {
    return null;
  }
}

/**
 * Check if the authenticated user is an admin.
 * Returns { uid, isAdmin } on success, or null on failure.
 */
async function verifyAdmin(req) {
  const decoded = await verifyAuthToken(req);
  if (!decoded) return null;
  try {
    const { db } = await import('@/lib/firebase/serverOnly');
    const adminDoc = await db.collection('admins').doc(decoded.uid).get();
    return { uid: decoded.uid, isAdmin: adminDoc.exists };
  } catch {
    return { uid: decoded.uid, isAdmin: false };
  }
}

/**
 * Send a 401 response for unauthenticated requests.
 */
function unauthorized(res) {
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

const handler = withApiMiddleware(async (req, res) => {
  const slug = req.query.slug || [];
  const parts = Array.isArray(slug) ? slug : [];

  if (parts.length === 0) {
    return res.status(404).json({ error: "Not found" });
  }

  const resource = parts[0];

  switch (resource) {
    case "config":
      return handleConfig(req, res);
    case "status":
      return handleStatus(req, res);
    case "transactions":
      return handleTransactions(req, res);
    case "transfer":
      return handleTransfer(req, res);
    case "wallets":
      return handleWallets(req, res, parts);
    default:
      return res.status(404).json({ error: `Unknown resource: ${resource}` });
  }
}, {
  rateLimit: 60,
  rateLimitKey: "CIRCLE_API",
});

async function handleConfig(req, res) {
  const { walletSetId, environment, configured, clientConfigured } = realCircleService.getConfig().data;

  if (!clientConfigured) {
    return res.status(500).json({
      success: false,
      error: 'Circle client not configured'
    });
  }

  const supportedTokens = process.env.CIRCLE_SUPPORTED_TOKENS
    ? process.env.CIRCLE_SUPPORTED_TOKENS.split(',')
    : ['USDC', 'ETH', 'MATIC'];

  const supportedBlockchains = process.env.CIRCLE_SUPPORTED_BLOCKCHAINS
    ? process.env.CIRCLE_SUPPORTED_BLOCKCHAINS.split(',')
    : ['ARC', 'ETH', 'MATIC', 'AVAX', 'ARB'];

  const warnings = [];
  if (!walletSetId) {
    warnings.push('Circle Wallet Set ID not configured');
  }

  const config = {
    walletSetId,
    entitySecretConfigured: !!process.env.CIRCLE_ENTITY_SECRET,
    environment,
    configured,
    clientConfigured,
    supportedTokens,
    supportedBlockchains,
    tokenInfo: {
      USDC: { name: 'USD Coin', decimals: 6, chains: ['ARC', 'ETH', 'MATIC', 'AVAX', 'ARB'], isStablecoin: true },
      ETH: { name: 'Ethereum', decimals: 18, chains: ['ETH'] },
      MATIC: { name: 'Polygon', decimals: 18, chains: ['MATIC'] },
    },
    lastUpdated: new Date().toISOString(),
    developerMode: environment !== 'production'
  };

  return res.status(200).json({
    success: true,
    data: config,
    warnings: warnings.length > 0 ? warnings : undefined
  });
}

async function handleStatus(req, res) {
  try {
    const serviceStatus = serviceRegistry.getServiceStatus();
    const circleService = serviceRegistry.getCircleService();

    if (!circleService.isConfigured()) {
      return res.status(500).json(
        ApiResponse.error("Circle API not properly configured", "Status Check").toJSON()
      );
    }

    const pingResult = await circleService.ping();

    return res.status(200).json(
      ApiResponse.success({
        serviceStatus: serviceStatus.circle,
        ping: pingResult.data?.message || "OK",
        services: serviceStatus,
      }, "Circle Status Check").toJSON()
    );
  } catch (error) {
    return res.status(500).json(
      ApiResponse.error(error.message || "Circle API status check failed", "Status Check").toJSON()
    );
  }
}

async function handleTransactions(req, res) {
  if (req.method === 'GET') {
    const params = parseQueryParams(req.query, { stringParams: ['id'] });
    const { id } = params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Transaction id is required'
      });
    }

    try {
      const result = await realCircleService.getTransactionStatus(id);
      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get transaction'
      });
    }
  }

  if (req.method === 'POST') {
    // Authenticate: only logged-in users can create transactions
    const decoded = await verifyAuthToken(req);
    if (!decoded) return unauthorized(res);

    try {
      validateRequiredFields(req.body, ['walletId', 'destinationAddress', 'amount']);

      const { walletId, tokenId, destinationAddress, amount, feeLevel, contractAddress, calldata } = req.body;

      // A logged-in caller may not spend from an arbitrary Circle wallet. Only
      // wallets the server itself controls are spendable here; user-initiated
      // transfers must be signed by the user's own key, not proxied through
      // this route.
      if (!realCircleService.isServerControlledWallet(walletId)) {
        return res.status(403).json({
          success: false,
          error: 'Wallet is not server-controlled; user transfers must be signed client-side'
        });
      }

      const result = await realCircleService.createTransaction({ walletId, tokenId, destinationAddress, amount, feeLevel, contractAddress, calldata });

      return res.status(201).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create transaction'
      });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

async function handleTransfer(req, res) {
  const { db, auth } = await import('@/lib/firebase/serverOnly');
  const SOURCE_WALLET_ID = process.env.CIRCLE_PAYOUT_WALLET_ID || process.env.CIRCLE_AGENT_WALLET_ID;

  async function verifyTesterWalletAddress(destinationAddress) {
    return realCircleService.validateWalletAddress(destinationAddress);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { payoutId, testerId, amount, campaignId, walletId } = req.body;

    if (!payoutId || !testerId || !amount || !campaignId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const authToken = req.headers.authorization?.split('Bearer ')[1];
    if (!authToken) {
      return res.status(401).json({ error: 'Missing authorization' });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(authToken);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const campaignDoc = await db.collection('TestingCampaigns').doc(campaignId).get();
    if (!campaignDoc.exists) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaignDoc.data();
    const isOwner = campaign.creatorId === decodedToken.uid;
    const adminDoc = await db.collection('admins').doc(decodedToken.uid).get();
    const isAdmin = adminDoc.exists;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to approve payouts' });
    }

    const testerDoc = await db.collection('users').doc(testerId).get();
    if (!testerDoc.exists) {
      return res.status(404).json({ error: 'Tester not found' });
    }

    const testerData = testerDoc.data();
    const destinationAddress = testerData.circleWalletAddress || testerData.walletAddress;

    if (!destinationAddress) {
      return res.status(400).json({ error: 'Tester has no wallet address registered' });
    }

    const walletValid = await verifyTesterWalletAddress(destinationAddress);
    if (!walletValid) {
      return res.status(400).json({ error: 'Tester wallet verification failed' });
    }

    const sourceWalletId = walletId || SOURCE_WALLET_ID;
    if (!sourceWalletId) {
      return res.status(500).json({ error: 'No Circle source wallet configured' });
    }

    const result = await realCircleService.createTransaction({
      walletId: sourceWalletId,
      amount: amount.toString(),
      destinationAddress,
      feeLevel: 'MEDIUM',
      metadata: { payoutId, testerId, campaignId, createdBy: decodedToken.uid }
    });

    const transferId = result.data?.id || result.data?.transaction?.id;

    await db.collection('PayoutLogs').add({
      payoutId, testerId, campaignId, amount, transferId,
      walletId: sourceWalletId, status: 'initiated',
      createdBy: decodedToken.uid, createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ transferId, status: 'initiated' });
  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json({ error: 'Transfer failed', message: error.message });
  }
}

async function handleWallets(req, res, parts) {
  const walletId = parts[1];

  if (parts.length === 2 && parts[2] === "balances") {
    return handleBalances(req, res, walletId);
  }

  if (parts.length >= 2 && walletId) {
    return handleSingleWallet(req, res, walletId);
  }

  if (parts.length === 1) {
    return handleListCreateWallets(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}

async function handleListCreateWallets(req, res) {
  try {
    if (req.method === "GET") {
      const walletSetId = req.query.walletSetId;
      const result = await realCircleService.getWallets(walletSetId);

      return res.status(200).json({
        success: true,
        data: result.data,
      });
    } else if (req.method === "POST") {
      // Authenticate: only logged-in users can create wallets
      const decoded = await verifyAuthToken(req);
      if (!decoded) return unauthorized(res);

      const { metadata } = req.body;
      const config = {
        name: metadata?.name || "Developer Wallet",
        description: metadata?.description || "Wallet for developer funding",
        userId: metadata?.userId,
        metadata: metadata || {},
      };

      const result = await realCircleService.createWallet(config);

      return res.status(201).json({
        success: true,
        data: result.data,
      });
    } else {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Circle Wallets API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message?.includes("403") || error.message?.includes("Request failed with status code 403")
        ? "Circle API key accepted but wallet set not found in production. Create a new wallet set at https://developers.circle.com."
        : error.message || "Internal server error",
      details: error.details || {},
    });
  }
}

async function handleSingleWallet(req, res, id) {
  if (!id) {
    return res.status(400).json({ success: false, error: 'Wallet ID is required' });
  }

  if (req.method === 'GET') {
    try {
      const response = await realCircleService.getWalletById(id);
      return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to get wallet' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      validateRequiredFields(req.body, ['metadata']);
      return res.status(501).json({
        success: false,
        error: 'Wallet metadata updates are not supported by RealCircleService yet',
        data: { walletId: id, metadata: req.body.metadata }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to update wallet metadata' });
    }
  }

  if (req.method === 'DELETE') {
    return res.status(501).json({ success: false, error: 'Wallet deletion is not supported' });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

async function handleBalances(req, res, id) {
  if (!id) {
    return res.status(400).json({ success: false, error: 'Wallet ID is required' });
  }

  const params = parseQueryParams(req.query, { stringParams: ['tokenId'] });

  try {
    const response = await realCircleService.getWalletBalances(id);
    const rawBalances = response.data?.tokenBalances || response.data?.balances || [];

    const filteredBalances = params.tokenId
      ? rawBalances.filter(balance => balance.token?.id === params.tokenId || balance.tokenId === params.tokenId)
      : rawBalances;

    const formattedBalances = filteredBalances.map(balance => {
      const symbol = balance.token?.symbol || balance.symbol || 'UNKNOWN';
      const amount = balance.amount || balance.balance || '0';
      const decimals = symbol === 'USDC' ? 6 : 18;
      const numericAmount = parseFloat(amount) / Math.pow(10, decimals);
      const displayAmount = numericAmount.toFixed(decimals === 6 ? 2 : 4);

      return {
        ...balance,
        displayAmount,
        formattedAmount: `${displayAmount} ${symbol}`,
        blockchain: balance.blockchain || balance.chain || 'ETH'
      };
    });

    const totalBalances = formattedBalances.reduce((acc, balance) => {
      const symbol = balance.token?.symbol || balance.symbol || 'UNKNOWN';
      if (!acc[symbol]) acc[symbol] = 0;
      acc[symbol] += parseFloat(balance.displayAmount || 0);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: { walletId: id, balances: formattedBalances, totalBalances, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to get wallet balances' });
  }
}
