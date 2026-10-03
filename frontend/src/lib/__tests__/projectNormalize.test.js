/**
 * Regression tests for hackathon claim verification-status integrity.
 *
 * A builder must not be able to inherit `payout_verified` (or its payout
 * attestation) by duplicating an already-verified claim's name and URL.
 */

import { describe, it, expect } from 'vitest';
import { mergeHackathonsWithVerification } from '../projects/projectNormalize';

const VERIFIED = {
  name: 'ETHGlobal Online 2025',
  url: 'https://ethglobal.com/showcase/12345',
  outcome: 'winner',
  verificationStatus: 'payout_verified',
  payoutVerifiedAt: '2025-12-01T00:00:00.000Z',
  payoutAttestationId: 'att_real_1',
  payoutActualAmount: '5000',
  payoutTxHash: '0xrealhash',
};

describe('mergeHackathonsWithVerification', () => {
  it('drops verification fields the user tries to self-assign', () => {
    const incoming = [
      {
        name: 'ETHGlobal Online 2025',
        url: 'https://ethglobal.com/showcase/12345',
        outcome: 'winner',
        verificationStatus: 'payout_verified',
        payoutVerifiedAt: '2030-01-01T00:00:00.000Z',
      },
    ];

    const result = mergeHackathonsWithVerification(incoming, []);

    expect(result[0].verificationStatus).toBeUndefined();
    expect(result[0].payoutVerifiedAt).toBeUndefined();
  });

  it('does not inherit a verified status by duplicating name and url alone', () => {
    // Same name+url as the verified claim, but no claim id or payout tx hash
    // of its own — the exact shape a builder could clone.
    const incoming = [
      {
        name: 'ETHGlobal Online 2025',
        url: 'https://ethglobal.com/showcase/12345',
        outcome: 'winner',
      },
    ];

    const result = mergeHackathonsWithVerification(incoming, [VERIFIED]);

    expect(result[0].verificationStatus).toBeUndefined();
    expect(result[0].payoutAttestationId).toBeUndefined();
    expect(result[0].payoutVerifiedAt).toBeUndefined();
  });

  it('does not inherit when the clone declares an unrelated payout wallet', () => {
    const incoming = [
      {
        name: 'ETHGlobal Online 2025',
        url: 'https://ethglobal.com/showcase/12345',
        outcome: 'winner',
        payoutWallet: '0xsomeoneelse',
        payoutAt: '2025-11-01',
      },
    ];

    const result = mergeHackathonsWithVerification(incoming, [VERIFIED]);

    expect(result[0].verificationStatus).toBeUndefined();
  });

  it('preserves verification when the same claim is resubmitted with its tx hash', () => {
    const incoming = [
      {
        name: 'ETHGlobal Online 2025',
        url: 'https://ethglobal.com/showcase/12345',
        outcome: 'winner',
        payoutTxHash: '0xrealhash',
      },
    ];

    const result = mergeHackathonsWithVerification(incoming, [VERIFIED]);

    expect(result[0].verificationStatus).toBe('payout_verified');
    expect(result[0].payoutAttestationId).toBe('att_real_1');
  });

  it('preserves verification when correlated by claim id', () => {
    const withId = { ...VERIFIED, claimId: 'claim_abc' };
    const incoming = [
      {
        claimId: 'claim_abc',
        name: 'A Completely Different Hackathon',
        url: 'https://example.com/other',
        outcome: 'winner',
      },
    ];

    const result = mergeHackathonsWithVerification(incoming, [withId]);

    expect(result[0].verificationStatus).toBe('payout_verified');
  });

  it('leaves an unrelated new claim unverified', () => {
    const incoming = [
      {
        name: 'Some Other Hackathon',
        url: 'https://example.com/other',
        outcome: 'finalist',
      },
    ];

    const result = mergeHackathonsWithVerification(incoming, [VERIFIED]);

    expect(result[0].verificationStatus).toBeUndefined();
  });
});
