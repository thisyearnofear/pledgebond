/**
 * Client-safe USDC/currency formatting helpers.
 *
 * Extracted from lib/usdcPayments.js so client components can import them
 * without dragging the server-only RealCircleService (firebase-admin)
 * chain into the browser bundle.
 *
 * Keep this file dependency-free — no service, store, or node-only imports.
 */

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatUSDC = (amount) => usdFormatter.format(amount);
