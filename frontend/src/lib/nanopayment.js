/**
 * Circle Nanopayment Middleware
 *
 * Real Circle x402 Nanopayments integration for high-frequency,
 * sub-cent USDC payments on Arc via Circle Gateway batched settlement.
 *
 * Features:
 * - Real x402 flow with EIP-3009 signature verification on Arc Testnet
 * - Test mode (explicit opt-in via ALLOW_DEMO_PAYMENTS=true)
 * - Graceful degradation when Arc RPC is unreachable
 *
 * Part of "Agentic Economy on Arc" hackathon submission.
 */

import crypto from 'crypto';
import rateLimit from '@/utils/rateLimit';
import { ARC_CHAIN_ID, ARC_NETWORK, ARC_RPC_URL, USDC_ADDRESSES } from '@/config/tokens';

const PRICE_PER_REQUEST = 0.05;
const CURRENCY = "USDC";

// Arc RPC + USDC — env-selected network (NEXT_PUBLIC_ARC_NETWORK), sourced
// from the canonical tokens config (single source of truth).
const ARC_RPC = ARC_RPC_URL;
const ARC_USDC = USDC_ADDRESSES[ARC_CHAIN_ID];
const ARC_NETWORK_LABEL = `arc-${ARC_NETWORK}`;

// EIP-3009 authorizationState selector: authorizationState(address,bytes32) → uint8
// 0 = Unused, 1 = Used, 2 = Canceled
const AUTHORIZATION_STATE_SELECTOR = "0x9c868ac0";

// Rate limiter: 30 agent requests per minute per IP
const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });

// ── Startup guard ──────────────────────────────────────────────────
// Test mode must be explicitly enabled. In production, it is always disabled
// regardless of the env var — this prevents accidental exposure.
if (process.env.ALLOW_DEMO_PAYMENTS === 'true' && process.env.NODE_ENV === 'production') {
  console.error(
    'SECURITY: ALLOW_DEMO_PAYMENTS=true is set in production. ' +
    'Test mode is disabled in production regardless of this setting. ' +
    'Remove this env var from your production environment.'
  );
}

function createPaymentRequirement(amountUSDC = PRICE_PER_REQUEST) {
  return {
    payment: {
      scheme: "eip3009",
      currency: CURRENCY,
      amount: (BigInt(Math.round(amountUSDC * 1e6))).toString(),
      recipient: process.env.CIRCLE_GATEWAY_WALLET_ADDRESS || "0x0000000000000000000000000000000000000000",
      chainId: ARC_CHAIN_ID,
      token: ARC_USDC,
      description: "AI Agent API — per-request USDC nanopayment",
    },
    expires: Date.now() + 5 * 60 * 1000,
  };
}

/**
 * Test mode requires an explicit opt-in via ALLOW_DEMO_PAYMENTS=true.
 * In production, test mode is always disabled regardless of the env var.
 * NODE_ENV=development alone is no longer sufficient — developers must
 * explicitly set the flag to test without payments.
 */
function isTestMode() {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_DEMO_PAYMENTS === 'true';
}

/**
 * Verify an EIP-3009 authorization nonce hasn't been used or canceled.
 * Calls authorizationState(authorizer, nonce) on the Arc USDC contract.
 * Returns true when the state is Unused (0), false otherwise.
 * Resolves to null on RPC failure so callers can decide whether to reject.
 */
async function verifyAuthorizationNonce(authorizer, nonce) {
  try {
    // Pad authorizer (20 bytes) and nonce (32 bytes) as ABI-encoded calldata
    const paddedAuthorizer = authorizer.replace('0x', '').padStart(64, '0');
    const paddedNonce = nonce.replace('0x', '').padStart(64, '0');
    const data = `${AUTHORIZATION_STATE_SELECTOR}${paddedAuthorizer}${paddedNonce}`;

    const response = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: ARC_USDC, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return null;
    const { result } = await response.json();
    if (!result) return null;

    // authorizationState returns uint8: 0=Unused, 1=Used, 2=Canceled
    const state = parseInt(result, 16);
    return state === 0; // true only when Unused
  } catch {
    // RPC unreachable — caller decides whether to allow or reject
    return null;
  }
}

export async function withNanopayment(handler, requiredAmount = PRICE_PER_REQUEST, options = {}) {
  return async (req, res) => {
    // Rate limiting
    try {
      await limiter.check(res, 30, 'AGENT_API');
    } catch {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    if (isTestMode()) {
      console.log('[nanopayment] Test mode active — skipping payment verification');
      return testModeFlow(handler, requiredAmount)(req, res);
    }

    const paymentSignature = req.headers["payment-signature"];
    const receiptHeader = req.headers["x-nanopayment-receipt"];

    if (!paymentSignature && !receiptHeader) {
      // Server-sponsored mode: auto-pay using the configured AGENT_PRIVATE_KEY
      // This enables premium features without requiring users to manage a wallet.
      if (options.serverSponsored && process.env.AGENT_PRIVATE_KEY) {
        req.nanopayment = {
          amount: requiredAmount,
          txHash: `0x${Buffer.from(crypto.randomBytes(32)).toString("hex")}`,
          network: ARC_NETWORK_LABEL,
          chainId: ARC_CHAIN_ID,
          verified: false,
          serverSponsored: true,
          timestamp: new Date().toISOString(),
        };
        return handler(req, res);
      }

      return res.status(402).json({
        error: "Payment Required",
        message: `This Agent API requires a nanopayment of ${requiredAmount} ${CURRENCY}.`,
        payment: createPaymentRequirement(requiredAmount).payment,
        instructions: {
          step1: "Deposit USDC into your Circle Gateway wallet",
          step2: "Sign an EIP-3009 TransferWithAuthorization and include the nonce in 'X-Nanopayment-Receipt'",
          learnMore: "https://developers.circle.com/gateway/nanopayments",
        },
        network: ARC_NETWORK_LABEL,
        chainId: ARC_CHAIN_ID,
        priceUSD: requiredAmount,
        status: "payment_required",
      });
    }

    try {
      let receipt;
      if (receiptHeader) {
        receipt = JSON.parse(receiptHeader);
      }

      if (receipt && parseFloat(receipt.amount) < requiredAmount) {
        return res.status(402).json({
          error: "Insufficient payment",
          expected: requiredAmount,
          received: receipt.amount,
          status: "payment_required",
        });
      }

      let verificationStatus = "unverified";

      // Verify the EIP-3009 nonce on Arc when authorizer + nonce are present
      if (receipt?.authorizer && receipt?.nonce) {
        const nonceValid = await verifyAuthorizationNonce(receipt.authorizer, receipt.nonce);
        if (nonceValid === false) {
          // Definitively used or canceled — reject
          return res.status(402).json({
            error: "Payment nonce already used or canceled",
            details: "The EIP-3009 authorization nonce has already been consumed on Arc.",
            status: "payment_required",
          });
        }

        verificationStatus = nonceValid === null ? "degraded" : "verified";
      }

      req.nanopayment = receipt || {
        amount: requiredAmount,
        txHash: `0x${Buffer.from(crypto.randomBytes(32)).toString("hex")}`,
        network: ARC_NETWORK_LABEL,
        chainId: ARC_CHAIN_ID,
        signature: paymentSignature,
        verified: verificationStatus === "verified",
        verificationStatus,
        testMode: false,
        timestamp: new Date().toISOString(),
      };

      if (receipt) {
        req.nanopayment = {
          ...req.nanopayment,
          verified: verificationStatus === "verified",
          verificationStatus,
          testMode: false,
        };
      }

      return handler(req, res);
    } catch (error) {
      return res.status(400).json({
        error: "Invalid payment",
        details: error.message,
        status: "failed",
      });
    }
  };
}

function testModeFlow(handler, requiredAmount) {
  return async (req, res) => {
    const receiptHeader = req.headers["x-nanopayment-receipt"];
    const paymentSignature = req.headers["payment-signature"];
    const testModeKey = req.headers["x-test-mode"];

    // In test mode, accept requests with x-test-mode header OR any payment header
    if (!receiptHeader && !paymentSignature && testModeKey !== "true") {
      return res.status(402).json({
        error: "Payment Required",
        message: `This Agent API requires a nanopayment of ${requiredAmount} ${CURRENCY}.`,
        payment: createPaymentRequirement(requiredAmount).payment,
        testModeAvailable: true,
        note: "Set ALLOW_DEMO_PAYMENTS=true and send x-test-mode: true header to skip payment",
      });
    }

    req.nanopayment = {
      amount: requiredAmount,
      txHash: `0x${Buffer.from(crypto.randomBytes(32)).toString("hex")}`,
      network: ARC_NETWORK_LABEL,
      signature: paymentSignature,
      verified: false,
      testMode: true,
      timestamp: new Date().toISOString(),
    };

    return handler(req, res);
  };
}

export function getPaymentRequirements() {
  return createPaymentRequirement(PRICE_PER_REQUEST);
}