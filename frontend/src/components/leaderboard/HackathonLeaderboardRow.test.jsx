/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/badges/computeBadges', () => ({
  computeLeaderboardBadges: () => [],
}));

vi.mock('@/components/common/ProofBadge', () => ({
  ProofBadgeGroup: () => null,
}));

import HackathonLeaderboardRow from './HackathonLeaderboardRow';

describe('HackathonLeaderboardRow', () => {
  const baseEntry = {
    name: 'ETHGlobal',
    ecosystem: 'base',
    totalProjects: 50,
    winners: 5,
    builderCount: 100,
    payoutCompletionRate: 90,
    score: 95,
  };

  it('renders the name, ecosystem badge, and stats', () => {
    render(<HackathonLeaderboardRow entry={baseEntry} rank={1} />);
    expect(screen.getByText('ETHGlobal')).toBeInTheDocument();
    expect(screen.getByText('base')).toBeInTheDocument();
    expect(screen.getByText(/50 projects · 5 winners · 100 builders/)).toBeInTheDocument();
  });

  it('renders 🥇 for rank 1', () => {
    const { container } = render(<HackathonLeaderboardRow entry={baseEntry} rank={1} />);
    expect(container.textContent).toContain('🥇');
  });

  it('renders the reputation score with trophy icon', () => {
    render(<HackathonLeaderboardRow entry={baseEntry} rank={1} />);
    expect(screen.getByText('reputation')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
  });

  it('uses emerald color and "lightning fast" label when avgPayoutDays <= 7', () => {
    const { container } = render(
      <HackathonLeaderboardRow entry={{ ...baseEntry, avgPayoutDays: 5 }} rank={1} />
    );
    expect(container.innerHTML).toMatch(/text-emerald-700/);
    expect(screen.getByText('lightning fast')).toBeInTheDocument();
  });

  it('uses green color and "fast" label when 8 <= avgPayoutDays <= 30', () => {
    const { container } = render(
      <HackathonLeaderboardRow entry={{ ...baseEntry, avgPayoutDays: 20 }} rank={1} />
    );
    expect(container.innerHTML).toMatch(/text-green-700/);
    expect(screen.getByText('fast')).toBeInTheDocument();
  });

  it('uses amber color and "moderate" label when 31 <= avgPayoutDays <= 90', () => {
    const { container } = render(
      <HackathonLeaderboardRow entry={{ ...baseEntry, avgPayoutDays: 60 }} rank={1} />
    );
    expect(container.innerHTML).toMatch(/text-amber-700/);
    expect(screen.getByText('moderate')).toBeInTheDocument();
  });

  it('uses red color and "slow" label when avgPayoutDays > 90', () => {
    const { container } = render(
      <HackathonLeaderboardRow entry={{ ...baseEntry, avgPayoutDays: 180 }} rank={1} />
    );
    expect(container.innerHTML).toMatch(/text-red-600/);
    expect(screen.getByText('slow')).toBeInTheDocument();
  });

  it('renders "—" and "payout speed" when avgPayoutDays is null', () => {
    render(<HackathonLeaderboardRow entry={{ ...baseEntry, avgPayoutDays: null }} rank={1} />);
    expect(screen.getByText('payout speed')).toBeInTheDocument();
  });

  it('uses green color for payoutCompletionRate >= 80', () => {
    const { container } = render(
      <HackathonLeaderboardRow entry={{ ...baseEntry, payoutCompletionRate: 85, avgPayoutDays: 5 }} rank={1} />
    );
    expect(container.innerHTML).toMatch(/text-green-700/);
  });

  it('uses amber color for payoutCompletionRate 50-79', () => {
    const { container } = render(
      <HackathonLeaderboardRow entry={{ ...baseEntry, payoutCompletionRate: 60 }} rank={1} />
    );
    expect(container.innerHTML).toMatch(/text-amber-700/);
  });

  it('uses red color for payoutCompletionRate < 50', () => {
    const { container } = render(
      <HackathonLeaderboardRow entry={{ ...baseEntry, payoutCompletionRate: 30 }} rank={1} />
    );
    expect(container.innerHTML).toMatch(/text-red-600/);
  });

  it('pluralizes "project" / "winner" / "builder" for counts > 1', () => {
    render(<HackathonLeaderboardRow entry={{ ...baseEntry, avgPayoutDays: 5 }} rank={1} />);
    expect(screen.getByText(/50 projects/)).toBeInTheDocument();
    expect(screen.getByText(/5 winners/)).toBeInTheDocument();
    expect(screen.getByText(/100 builders/)).toBeInTheDocument();
  });

  it('singularizes for counts of 1', () => {
    const entry = { ...baseEntry, totalProjects: 1, winners: 1, builderCount: 1 };
    render(<HackathonLeaderboardRow entry={entry} rank={1} />);
    expect(screen.getByText(/1 project · 1 winner · 1 builder/)).toBeInTheDocument();
  });
});
