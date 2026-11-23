/**
 * Client helpers for the payout-campaign API. Every call attaches the
 * Firebase ID token when the user is signed in.
 */

async function request(currentUser, path, { method = "GET", body } = {}) {
  const token = currentUser ? await currentUser.getIdToken() : null;
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const listCampaigns = (user, all = false) =>
  request(user, `/api/payout-campaigns${all ? "?all=1" : ""}`);

export const createCampaign = (user, campaign) =>
  request(user, "/api/payout-campaigns", { method: "POST", body: campaign });

export const getCampaign = (user, id, wallet = null) =>
  request(user, `/api/payout-campaigns/${id}${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ""}`);

export const transitionCampaign = (user, id, action, campaign = null) =>
  request(user, `/api/payout-campaigns/${id}`, {
    method: "PUT",
    body: campaign ? { action, campaign } : { action },
  });

export const createPayoutRoute = (user, id) =>
  request(user, `/api/payout-campaigns/${id}/route`, { method: "POST" });

export const reconcilePayoutRoute = (user, id) =>
  request(user, `/api/payout-campaigns/${id}/route`);

/**
 * Parse a recipients textarea: one entry per line as `wallet, amount`
 * (optional third field becomes the note).
 */
export function parseRecipients(text) {
  const errors = [];
  const recipients = [];
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const [wallet, amount, ...rest] = line.split(",").map((s) => s.trim());
      const n = Number(amount);
      if (!wallet || wallet.length < 32 || wallet.length > 64) {
        errors.push(`line ${i + 1}: invalid wallet`);
        return;
      }
      if (!Number.isFinite(n) || n <= 0) {
        errors.push(`line ${i + 1}: amount must be a positive number`);
        return;
      }
      const note = rest.join(", ").trim();
      recipients.push({ wallet, amount: n, ...(note ? { note } : {}) });
    });
  return { recipients, errors };
}
