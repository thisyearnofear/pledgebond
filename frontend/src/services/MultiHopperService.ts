/**
 * MultiHopperService — the single boundary between PledgeBond and MultiHopper.
 *
 * MultiHopper is the Solana transfer/routing rail used *after* PledgeBond has
 * decided a payment is due. This service owns every MultiHopper API call so
 * routes/components never scatter credentials or endpoint details.
 *
 * Behaviour rules (from docs/MULTIHOPPER_PLAN.md):
 * - Fail closed: any onboarding, route-creation, or settlement error surfaces
 *   as a thrown error — callers never get a "succeeded anyway" result.
 * - Never store secrets client-side. All config is server env only.
 * - Mock mode requires MULTIHOPPER_MOCK=1 explicitly, or a non-production
 *   environment with no API key — production with no key throws.
 * - Only store: integration identifier, route ids, destination wallets,
 *   public tx signatures, status, failure data. Nothing else leaves the
 *   campaign record.
 *
 * The real API surface below is provisional — MultiHopper production
 * onboarding will confirm exact endpoints/fields. Keep all of it inside
 * `_request` and the two public methods so the seam stays one file wide.
 */

const API_URL = (process.env.MULTIHOPPER_API_URL || "https://api.multihopper.io/v1").replace(/\/$/, "");
const API_KEY = process.env.MULTIHOPPER_API_KEY || "";
const INTEGRATION_ID = process.env.MULTIHOPPER_INTEGRATION_ID || "";
const MOCK_FLAG = process.env.MULTIHOPPER_MOCK === "1" || process.env.MULTIHOPPER_MOCK === "true";

/** How long a mock route takes to "settle" — enough for a demo refresh cycle. */
const MOCK_SETTLE_MS = 30_000;

export interface RouteRecipient {
  wallet: string;
  amount: number;
}

export interface StoredRoute {
  provider: "multihopper";
  integrationId: string | null;
  routeId: string;
  routeType: "multi_send" | "standard";
  status: "submitted" | "settling" | "settled" | "failed";
  createdAt: string;
  mock: boolean;
  failure?: string | null;
}

export interface RouteTransfer {
  wallet: string;
  amount: number;
  status: "pending" | "settled" | "failed";
  signature: string | null;
}

export interface RouteStatusResult {
  status: StoredRoute["status"];
  transfers: RouteTransfer[];
  signatures: string[];
}

function isMock(): boolean {
  if (MOCK_FLAG) return true;
  // Dev convenience: no key configured locally falls back to mock.
  // In production a missing key fails closed instead.
  if (!API_KEY && process.env.NODE_ENV !== "production") return true;
  return false;
}

export function isConfigured(): boolean {
  return isMock() || Boolean(API_KEY && INTEGRATION_ID);
}

export function getIntegrationId(): string | null {
  return INTEGRATION_ID || null;
}

async function _request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_KEY) {
    throw new Error("MultiHopper API key is not configured");
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(INTEGRATION_ID ? { "X-Integration-Id": INTEGRATION_ID } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MultiHopper ${init.method || "GET"} ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Create a transfer route for an approved payout campaign.
 * Multi-Send when there is more than one recipient.
 */
export async function createRoute(args: {
  campaignId: string;
  asset: string;
  recipients: RouteRecipient[];
  businessPurpose: string;
}): Promise<StoredRoute> {
  const { campaignId, asset, recipients, businessPurpose } = args;
  const routeType = recipients.length > 1 ? "multi_send" : "standard";
  const createdAt = new Date().toISOString();

  if (isMock()) {
    return {
      provider: "multihopper",
      integrationId: INTEGRATION_ID || "mock-integration",
      routeId: `mh_mock_${campaignId}`,
      routeType,
      status: "submitted",
      createdAt,
      mock: true,
    };
  }

  const body = await _request<{ routeId: string; status?: string }>("/routes", {
    method: "POST",
    body: JSON.stringify({
      type: routeType,
      asset,
      transfers: recipients.map((r) => ({ destination: r.wallet, amount: r.amount })),
      memo: businessPurpose,
      idempotencyKey: campaignId,
      integrationId: INTEGRATION_ID || undefined,
    }),
  });

  if (!body || !body.routeId) {
    throw new Error("MultiHopper route creation returned no routeId");
  }

  return {
    provider: "multihopper",
    integrationId: INTEGRATION_ID || null,
    routeId: body.routeId,
    routeType,
    status: "submitted",
    createdAt,
    mock: false,
  };
}

/**
 * Reconcile a stored route's status. `recipients` is the campaign's recipient
 * list so transfer-level results can be aligned to wallets.
 */
export async function getRouteStatus(
  route: StoredRoute,
  recipients: RouteRecipient[]
): Promise<RouteStatusResult> {
  if (route.mock || isMock()) {
    const elapsed = Date.now() - new Date(route.createdAt).getTime();
    const settled = elapsed >= MOCK_SETTLE_MS;
    const transfers: RouteTransfer[] = recipients.map((r) => ({
      wallet: r.wallet,
      amount: r.amount,
      status: settled ? "settled" : "pending",
      signature: settled ? `mock_sig_${route.routeId}_${r.wallet.slice(0, 8)}` : null,
    }));
    return {
      status: settled ? "settled" : "settling",
      transfers,
      signatures: transfers.map((t) => t.signature).filter((s): s is string => Boolean(s)),
    };
  }

  const body = await _request<{
    status?: string;
    transfers?: Array<{ destination: string; amount?: number; status?: string; signature?: string }>;
    signatures?: string[];
  }>(`/routes/${encodeURIComponent(route.routeId)}`);

  const rawStatus = (body.status || "").toLowerCase();
  const status: StoredRoute["status"] =
    rawStatus === "settled" || rawStatus === "complete" || rawStatus === "completed"
      ? "settled"
      : rawStatus === "failed" || rawStatus === "error"
        ? "failed"
        : rawStatus === "settling" || rawStatus === "processing"
          ? "settling"
          : "submitted";

  const transfers: RouteTransfer[] = recipients.map((r) => {
    const t = (body.transfers || []).find((x) => x.destination === r.wallet);
    const ts = (t?.status || "").toLowerCase();
    return {
      wallet: r.wallet,
      amount: r.amount,
      status: ts === "settled" || ts === "complete" ? "settled" : ts === "failed" ? "failed" : "pending",
      signature: t?.signature || null,
    };
  });

  const signatures =
    body.signatures && body.signatures.length
      ? body.signatures
      : transfers.map((t) => t.signature).filter((s): s is string => Boolean(s));

  return { status, transfers, signatures };
}
